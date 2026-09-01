import asyncio
import logging

from app.intelligence.llm.client import llm_client
from app.memory.service import MemoryService, memory_service

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a helpful WhatsApp customer-support assistant.\n\n"
    "Answer the user's question clearly and concisely.\n\n"
    "Do not invent company-specific information.\n\n"
    "If you do not know something, say that you do not have enough information.\n\n"
    "Keep responses suitable for WhatsApp."
)


class ConversationOrchestrator:
    def __init__(self, client=llm_client, memory: MemoryService | None = None):
        self.client = client
        self.memory = memory or memory_service

    async def generate_response(self, user_id: str, message: str) -> str:
        clean_message = (message or "").strip()
        if not clean_message:
            raise ValueError("Message cannot be empty.")

        # 1. Load previous conversation history for this user
        try:
            history = await self.memory.get_history(user_id)
        except Exception as exc:
            logger.error("[Orchestrator] Failed to load history for user %s: %s", user_id, exc)
            history = []

        # 2. Build the LLM messages: system prompt + history + current message
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history)
        messages.append({"role": "user", "content": clean_message})

        # 3. Call the LLM
        response = await asyncio.to_thread(self.client.generate_response, messages)

        # 4. Save the user message and assistant response
        try:
            await self.memory.save_message(user_id, "user", clean_message)
            await self.memory.save_message(user_id, "assistant", response)
        except Exception as exc:
            logger.error("[Orchestrator] Failed to save messages for user %s: %s", user_id, exc)

        # 5. Return the AI response
        return response


conversation_orchestrator = ConversationOrchestrator()

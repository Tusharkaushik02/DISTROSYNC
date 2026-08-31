import asyncio

from app.intelligence.llm.client import llm_client


SYSTEM_PROMPT = (
    "You are a helpful WhatsApp customer-support assistant.\n\n"
    "Answer the user's question clearly and concisely.\n\n"
    "Do not invent company-specific information.\n\n"
    "If you do not know something, say that you do not have enough information.\n\n"
    "Keep responses suitable for WhatsApp."
)


class ConversationOrchestrator:
    def __init__(self, client=llm_client):
        self.client = client

    async def generate_response(self, message: str) -> str:
        clean_message = (message or "").strip()
        if not clean_message:
            raise ValueError("Message cannot be empty.")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": clean_message},
        ]

        return await asyncio.to_thread(self.client.generate_response, messages)


conversation_orchestrator = ConversationOrchestrator()

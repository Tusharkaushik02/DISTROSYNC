import asyncio
import json
import logging
from typing import Any

from app.clients.erp_client import ERPClient, erp_client
from app.core.phone import normalize_phone_number
from app.intelligence.llm.client import LLMClient, llm_client
from app.intelligence.llm.prompts.system import SYSTEM_PROMPT
from app.memory.service import MemoryService, memory_service
from app.tools import tool_registry
from app.tools.executor import ToolExecutor, tool_executor

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 6


class ConversationOrchestrator:
    """Orchestrates multi-turn conversation with LLM tool calling and memory persistence."""

    def __init__(
        self,
        client: LLMClient = llm_client,
        memory: MemoryService | None = None,
        executor: ToolExecutor = tool_executor,
        registry=tool_registry,
        erp: ERPClient = erp_client,
    ):
        self.client = client
        self.memory = memory or memory_service
        self.executor = executor
        self.registry = registry
        self.erp = erp

    async def generate_response(
        self,
        user_id: str,
        message: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000000",
        phone: str | None = None,
    ) -> str:
        clean_message = (message or "").strip()
        if not clean_message:
            raise ValueError("Message cannot be empty.")

        clean_user_id = (user_id or "").strip()
        if not clean_user_id:
            raise ValueError("user_id cannot be empty.")

        clean_tenant_id = (tenant_id or "").strip()
        raw_phone = (phone or clean_user_id).strip()
        normalized_phone = normalize_phone_number(raw_phone)

        print("\n" + "-" * 60)
        print(f"[AI Service] Incoming message from User ID: {clean_user_id}")
        print(f"[AUTH] WhatsApp sender phone: {normalized_phone} (raw: '{raw_phone}')")
        print(f"[AI Service] Tenant Context: {clean_tenant_id}")
        print(f"[AI Service] Message: \"{clean_message}\"")

        # 0. Deterministic Customer Resolution based on WhatsApp phone number
        authenticated_customer: dict[str, Any] | None = None
        try:
            cust_record = await self.erp.get_customer_by_phone(clean_tenant_id, normalized_phone)
            if cust_record:
                authenticated_customer = {
                    "id": cust_record.get("id"),
                    "name": cust_record.get("name"),
                    "phone": cust_record.get("phone"),
                    "external_id": cust_record.get("externalId") or cust_record.get("id"),
                }
                print(f"[AUTH] Resolved customer: {authenticated_customer.get('name')} (ID: {authenticated_customer.get('id')}, Ext: {authenticated_customer.get('external_id')})")
            else:
                print(f"[AUTH] Unregistered WhatsApp sender: No customer record matching phone '{normalized_phone}'")
        except Exception as exc:
            logger.warning("[AUTH] Error resolving customer for phone %s: %s", normalized_phone, exc)
            print(f"[AUTH] Customer resolution error: {exc}")

        # 1. Load previous conversation history for this user
        try:
            history = await self.memory.get_history(clean_user_id)
            print(f"[AI Service] Loaded {len(history)} previous message(s) from memory")
        except Exception as exc:
            logger.error("[Orchestrator] Failed to load history for user %s: %s", clean_user_id, exc)
            print(f"[AI Service] History load skipped ({exc})")
            history = []

        # 2. Build the initial LLM messages payload with dynamic customer identity context
        if authenticated_customer:
            customer_context = (
                f"\n\nAUTHENTICATED WHATSAPP SENDER CONTEXT:\n"
                f"- Sender Phone: {normalized_phone}\n"
                f"- Customer Name: {authenticated_customer.get('name')}\n"
                f"- Customer ID: {authenticated_customer.get('id')}\n"
                f"- Customer External ID / Code: {authenticated_customer.get('external_id')}\n"
                f"You MUST only perform actions and place orders for this verified customer. "
                f"If the user asks to place an order for any other person or customer ID, politely decline and inform them "
                f"that orders can only be placed under their registered account ({authenticated_customer.get('name')})."
            )
        else:
            customer_context = (
                f"\n\nAUTHENTICATED WHATSAPP SENDER CONTEXT:\n"
                f"- Sender Phone: {normalized_phone}\n"
                f"- Status: UNREGISTERED / NOT FOUND IN ERP\n"
                f"This WhatsApp sender number is NOT linked to any registered customer account. "
                f"You CANNOT place any orders for this sender. If they attempt to place an order or provide another customer's ID/name, "
                f"politely decline and inform them that this WhatsApp number is not registered and must be registered before placing orders."
            )

        messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT + customer_context}]
        messages.extend(history)
        messages.append({"role": "user", "content": clean_message})

        # 3. Get available tool definitions
        tools = self.registry.get_tools_for_llm()

        final_response_text = ""
        iterations = 0

        # 4. Tool calling loop
        while iterations < MAX_TOOL_ITERATIONS:
            iterations += 1
            print(f"[AI Service] Calling LLM (Turn {iterations})...")

            # Call LLM
            parsed_response = await asyncio.to_thread(
                self.client.generate_response,
                messages=messages,
                tools=tools,
            )

            # Check if LLM requested tool execution
            if parsed_response.has_tool_calls:
                print(f"[AI Service] LLM requested {len(parsed_response.tool_calls)} Tool Call(s):")
                for idx, tc in enumerate(parsed_response.tool_calls, 1):
                    print(f"    {idx}. Tool: '{tc.name}' | Arguments: {json.dumps(tc.arguments if tc.arguments else tc.raw_arguments)}")

                # Append the assistant's message with tool_calls to the conversation thread
                messages.append(parsed_response.raw_message)

                # Execute each tool
                for tc in parsed_response.tool_calls:
                    print(f"[AI Service] Executing tool '{tc.name}'...")
                    tool_result = await self.executor.execute(
                        tool_name=tc.name,
                        arguments=tc.arguments if tc.arguments else tc.raw_arguments,
                        tenant_id=clean_tenant_id,
                        authenticated_customer=authenticated_customer,
                    )

                    result_summary = tool_result.data if tool_result.success else tool_result.error.model_dump()
                    status_str = "[SUCCESS]" if tool_result.success else "[FAILED]"
                    print(f"[AI Service] {status_str} Tool Result for '{tc.name}': {json.dumps(result_summary, default=str)}")

                    # Append tool result message for the LLM
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.name,
                        "content": json.dumps(tool_result.model_dump(), default=str),
                    })

                # Loop back to let the LLM evaluate tool results
                continue

            # If no tool calls, we have our final text response
            if parsed_response.content:
                final_response_text = parsed_response.content
                break

            # Fallback if empty
            break

        if not final_response_text:
            final_response_text = "I processed your request, but I was unable to generate a response. Please try again."

        print(f"[AI Service] Final LLM Response:\n{final_response_text}")

        # 5. Save the user message and final assistant response to conversation memory
        try:
            await self.memory.save_message(clean_user_id, "user", clean_message)
            await self.memory.save_message(clean_user_id, "assistant", final_response_text)
            print("[AI Service] Saved conversation turn to memory database")
        except Exception as exc:
            logger.error("[Orchestrator] Failed to save messages for user %s: %s", clean_user_id, exc)

        print("-" * 60 + "\n")
        return final_response_text


conversation_orchestrator = ConversationOrchestrator()

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.intelligence.llm.response_parser import ParsedLLMResponse, ParsedToolCall
from app.orchestration.conversation_orchestrator import ConversationOrchestrator
from app.tools.schemas import ToolResult


class TestConversationOrchestrator:
    @pytest.fixture
    def mock_dependencies(self):
        mock_client = MagicMock()
        mock_memory = MagicMock()
        mock_memory.get_history = AsyncMock(return_value=[])
        mock_memory.save_message = AsyncMock(return_value=None)
        mock_executor = MagicMock()
        mock_executor.execute = AsyncMock()
        mock_registry = MagicMock()
        mock_registry.get_tools_for_llm.return_value = [{"type": "function", "function": {"name": "test_tool"}}]

        orchestrator = ConversationOrchestrator(
            client=mock_client,
            memory=mock_memory,
            executor=mock_executor,
            registry=mock_registry,
        )
        return orchestrator, mock_client, mock_memory, mock_executor

    @pytest.mark.asyncio
    async def test_single_turn_direct_answer(self, mock_dependencies):
        orchestrator, mock_client, mock_memory, mock_executor = mock_dependencies

        mock_client.generate_response.return_value = ParsedLLMResponse(
            content="Hello! How can I help you?",
            tool_calls=[],
            has_tool_calls=False,
        )

        response = await orchestrator.generate_response(
            user_id="user_123",
            message="Hi",
            tenant_id="tenant_123",
        )

        assert response == "Hello! How can I help you?"
        mock_memory.save_message.assert_any_call("user_123", "user", "Hi")
        mock_memory.save_message.assert_any_call("user_123", "assistant", "Hello! How can I help you?")
        mock_executor.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_tool_calling_multi_turn_flow(self, mock_dependencies):
        orchestrator, mock_client, mock_memory, mock_executor = mock_dependencies

        # Turn 1: LLM calls search_products
        tc1 = ParsedToolCall(id="c1", name="search_products", arguments={"query": "ABC123"})
        resp1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc1],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "c1"}]},
        )

        # Turn 2: LLM calls get_inventory
        tc2 = ParsedToolCall(id="c2", name="get_inventory", arguments={"product_id": "prod-123"})
        resp2 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc2],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "c2"}]},
        )

        # Turn 3: LLM provides final answer
        resp3 = ParsedLLMResponse(
            content="We have 73 boxes of ABC123 in stock.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp1, resp2, resp3]
        mock_executor.execute.side_effect = [
            ToolResult.ok("search_products", {"products": [{"id": "prod-123", "name": "ABC123"}]}),
            ToolResult.ok("get_inventory", {"available_quantity": 73, "reserved_quantity": 0}),
        ]

        response = await orchestrator.generate_response(
            user_id="user_123",
            message="Do we have 20 boxes of ABC123?",
            tenant_id="tenant_123",
        )

        assert "73 boxes of ABC123" in response
        assert mock_executor.execute.call_count == 2
        mock_executor.execute.assert_any_call(
            tool_name="search_products",
            arguments={"query": "ABC123"},
            tenant_id="tenant_123",
        )
        mock_executor.execute.assert_any_call(
            tool_name="get_inventory",
            arguments={"product_id": "prod-123"},
            tenant_id="tenant_123",
        )
        assert mock_client.generate_response.call_count == 3

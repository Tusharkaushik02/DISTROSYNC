import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.clients.erp_client import erp_client
from app.core.exceptions import ERPServiceError
from app.intelligence.llm.client import LLMClient
from app.intelligence.llm.response_parser import ParsedLLMResponse, ParsedToolCall
from app.orchestration.conversation_orchestrator import ConversationOrchestrator
from app.tools import tool_registry
from app.tools.executor import ToolExecutor


@pytest.fixture
def mock_orchestrator():
    mock_client = MagicMock(spec=LLMClient)
    mock_memory = MagicMock()
    mock_memory.get_history = AsyncMock(return_value=[])
    mock_memory.save_message = AsyncMock(return_value=None)
    executor = ToolExecutor(registry=tool_registry)

    orchestrator = ConversationOrchestrator(
        client=mock_client,
        memory=mock_memory,
        executor=executor,
        registry=tool_registry,
    )
    return orchestrator, mock_client


class TestEndToEndToolScenarios:
    """End-to-end integration tests for the full LLM -> Tool Registry -> ERP -> Response flow."""

    tenant_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    customer_id = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
    product_id = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
    order_id = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

    @pytest.mark.asyncio
    async def test_scenario_1_check_stock(self, mock_orchestrator):
        """TEST 1: 'Do we have 20 boxes of ABC123?'

        Flow: LLM calls search_products -> ERP returns product -> LLM calls get_inventory ->
        ERP returns stock -> LLM answers 'Yes, we have 73 boxes of ABC123 available.'
        """
        orchestrator, mock_client = mock_orchestrator

        # 1. LLM requests search_products("ABC123")
        tc_search = ParsedToolCall(
            id="call_1",
            name="search_products",
            arguments={"query": "ABC123", "limit": 5},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_1"}]},
        )

        # 2. LLM requests get_inventory(product_id)
        tc_inv = ParsedToolCall(
            id="call_2",
            name="get_inventory",
            arguments={"product_id": self.product_id},
        )
        resp_turn2 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_inv],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_2"}]},
        )

        # 3. LLM returns final natural language response
        resp_turn3 = ParsedLLMResponse(
            content="Yes, we have 73 boxes of ABC123 in stock.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2, resp_turn3]

        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search, \
             patch.object(erp_client, "get_inventory", new_callable=AsyncMock) as mock_inv:

            mock_search.return_value = [
                {
                    "id": self.product_id,
                    "sku": "ABC123",
                    "name": "ABC123 Energy Drink",
                    "unit": "box",
                    "price": 50.0,
                    "active": True,
                    "availableQuantity": 73,
                }
            ]

            mock_inv.return_value = {
                "productId": self.product_id,
                "availableQuantity": 73,
                "reservedQuantity": 5,
            }

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="Do we have 20 boxes of ABC123?",
                tenant_id=self.tenant_id,
            )

            assert "73 boxes of ABC123" in response
            mock_search.assert_called_once_with(
                tenant_id=self.tenant_id,
                query="ABC123",
                limit=5,
            )
            mock_inv.assert_called_once_with(
                tenant_id=self.tenant_id,
                product_id=self.product_id,
            )

    @pytest.mark.asyncio
    async def test_scenario_2_create_order_success(self, mock_orchestrator):
        """TEST 2: 'Create an order for 20 boxes of ABC123'

        Flow: LLM resolves product -> LLM checks customer -> LLM creates order in ERP ->
        ERP performs transactional order creation & inventory reservation -> LLM confirms.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_create = ParsedToolCall(
            id="call_create",
            name="create_order",
            arguments={
                "customer_id": self.customer_id,
                "items": [{"product_id": self.product_id, "quantity": 20}],
            },
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_create],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_create"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content=f"Your order for 20 boxes of ABC123 has been created successfully! Order ID: {self.order_id}, Total: ₹1000.00.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "get_customer_by_phone", new_callable=AsyncMock) as mock_get_phone, \
             patch.object(erp_client, "create_order", new_callable=AsyncMock) as mock_create:
            mock_get_phone.return_value = {
                "id": self.customer_id,
                "name": "John Doe",
                "phone": "+919876543210",
                "externalId": "CUST-001",
            }
            mock_create.return_value = {
                "id": self.order_id,
                "status": "CONFIRMED",
                "totalAmount": 1000.0,
                "customer": {"id": self.customer_id, "name": "John Doe"},
                "items": [{"productId": self.product_id, "quantity": 20, "unitPrice": 50}],
            }

            response = await orchestrator.generate_response(
                user_id="+919876543210",
                message="Create an order for 20 boxes of ABC123",
                tenant_id=self.tenant_id,
                phone="+919876543210",
            )

            assert "created successfully" in response
            assert self.order_id in response
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_scenario_3_insufficient_inventory(self, mock_orchestrator):
        """TEST 3: 'Create an order for 999999 boxes of ABC123'

        Expected: ERP rejects order due to INSUFFICIENT_INVENTORY -> LLM receives structured error
        and responds explaining insufficient stock without stack traces.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_create = ParsedToolCall(
            id="call_huge",
            name="create_order",
            arguments={
                "customer_id": self.customer_id,
                "items": [{"product_id": self.product_id, "quantity": 999999}],
            },
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_create],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_huge"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="I cannot place the order because there are only 73 boxes of ABC123 available in stock, but you requested 999999.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "get_customer_by_phone", new_callable=AsyncMock) as mock_get_phone, \
             patch.object(erp_client, "create_order", new_callable=AsyncMock) as mock_create:
            mock_get_phone.return_value = {
                "id": self.customer_id,
                "name": "John Doe",
                "phone": "+919876543210",
                "externalId": "CUST-001",
            }
            mock_create.side_effect = ERPServiceError(
                "Insufficient stock for ABC123",
                error_code="INSUFFICIENT_INVENTORY",
                details={"requestedQuantity": 999999, "availableQuantity": 73},
            )

            response = await orchestrator.generate_response(
                user_id="+919876543210",
                message="Create an order for 999999 boxes of ABC123",
                tenant_id=self.tenant_id,
                phone="+919876543210",
            )

            assert "only 73 boxes of ABC123 available" in response or "cannot place" in response

    @pytest.mark.asyncio
    async def test_scenario_4_cancel_valid_order(self, mock_orchestrator):
        """TEST 4: 'Cancel order <valid order>'

        Expected: ERP updates status to CANCELLED -> LLM confirms cancellation.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_cancel = ParsedToolCall(
            id="call_cancel",
            name="cancel_order",
            arguments={"order_id": self.order_id},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_cancel],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_cancel"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content=f"Order {self.order_id} has been cancelled successfully.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "update_order_status", new_callable=AsyncMock) as mock_status:
            mock_status.return_value = {
                "orderId": self.order_id,
                "status": "CANCELLED",
                "updatedAt": "2026-09-02T12:00:00Z",
            }

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message=f"Cancel order {self.order_id}",
                tenant_id=self.tenant_id,
            )

            assert "cancelled successfully" in response
            mock_status.assert_called_once_with(
                tenant_id=self.tenant_id,
                order_id=self.order_id,
                status="CANCELLED",
            )

    @pytest.mark.asyncio
    async def test_scenario_5_cancel_non_cancellable_order(self, mock_orchestrator):
        """TEST 5: 'Cancel an order that is not cancellable / not found'

        Expected: ERP returns ORDER_NOT_FOUND or error -> LLM explains failure politely.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_cancel = ParsedToolCall(
            id="call_bad_cancel",
            name="cancel_order",
            arguments={"order_id": "nonexistent-id"},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_cancel],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_bad_cancel"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="I could not cancel the order because order nonexistent-id was not found.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "update_order_status", new_callable=AsyncMock) as mock_status:
            mock_status.side_effect = ERPServiceError(
                "Order with id nonexistent-id not found",
                error_code="ORDER_NOT_FOUND",
                status_code=404,
            )

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="Cancel order nonexistent-id",
                tenant_id=self.tenant_id,
            )

            assert "not found" in response

    @pytest.mark.asyncio
    async def test_scenario_6_unknown_product_sku(self, mock_orchestrator):
        """TEST 6: Unknown/nonexistent SKU

        Expected: search_products returns empty array -> LLM informs user that product was not found.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search = ParsedToolCall(
            id="call_search_unknown",
            name="search_products",
            arguments={"query": "UNKNOWN_SKU_999"},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_search_unknown"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="I could not find any product matching 'UNKNOWN_SKU_999' in the catalog.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = []

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="Do you have UNKNOWN_SKU_999?",
                tenant_id=self.tenant_id,
            )

            assert "could not find" in response

    @pytest.mark.asyncio
    async def test_scenario_7_ambiguous_product_name(self, mock_orchestrator):
        """TEST 7: Ambiguous product name

        Expected: search_products returns multiple items -> LLM asks user for clarification.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search = ParsedToolCall(
            id="call_search_shampoo",
            name="search_products",
            arguments={"query": "blue shampoo"},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_search_shampoo"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="I found 2 matching products:\n1. Blue Shampoo 250ml\n2. Blue Shampoo 500ml\nWhich one would you like?",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                {"id": "p1", "name": "Blue Shampoo 250ml", "sku": "SHP-250", "price": 150, "availableQuantity": 30},
                {"id": "p2", "name": "Blue Shampoo 500ml", "sku": "SHP-500", "price": 280, "availableQuantity": 15},
            ]

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="I want to buy blue shampoo",
                tenant_id=self.tenant_id,
            )

            assert "Blue Shampoo 250ml" in response
            assert "Blue Shampoo 500ml" in response
            assert "Which one" in response

    @pytest.mark.asyncio
    async def test_scenario_8_typo_out_of_stock_alternative(self, mock_orchestrator):
        """TEST 8: Typo in search query ('blu shampoo') where product is out of stock

        Expected: search_products resolves 'blu shampoo' to Blue Shampoo (out_of_stock)
        and Yellow Shampoo (in_stock). LLM informs user Blue Shampoo is unavailable
        and suggests Yellow Shampoo.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search = ParsedToolCall(
            id="call_typo_search",
            name="search_products",
            arguments={"query": "blu shampoo", "limit": 5},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_typo_search"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="Blue Shampoo is currently unavailable. We do have Yellow Shampoo available. Would you like to order the Yellow Shampoo instead?",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                {"id": "p1", "name": "Blue Shampoo", "sku": "SHMP-BLU", "active": True, "availableQuantity": 0},
                {"id": "p2", "name": "Yellow Shampoo", "sku": "SHMP-YEL", "active": True, "availableQuantity": 25},
            ]

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="I want blu shampoo",
                tenant_id=self.tenant_id,
            )

            assert "Blue Shampoo is currently unavailable" in response
            assert "Yellow Shampoo" in response

    @pytest.mark.asyncio
    async def test_scenario_9_customer_semantic_search(self, mock_orchestrator):
        """TEST 9: Customer search with typo ('Jon Doe')

        Expected: LLM calls search_customers -> resolves to 'John Doe Wholesale' -> LLM answers.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search_cust = ParsedToolCall(
            id="call_cust_search",
            name="search_customers",
            arguments={"query": "Jon Doe", "limit": 5},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search_cust],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_cust_search"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="Found customer *John Doe Wholesale* (Phone: +919876543210).",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "search_customers", new_callable=AsyncMock) as mock_search_cust:
            mock_search_cust.return_value = [
                {"id": self.customer_id, "name": "John Doe Wholesale", "phone": "+919876543210", "externalId": "EXT-1"}
            ]

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="Find customer details for Jon Doe",
                tenant_id=self.tenant_id,
            )

            assert "John Doe Wholesale" in response

    @pytest.mark.asyncio
    async def test_scenario_10_order_semantic_search(self, mock_orchestrator):
        """TEST 10: Order search with natural language ('shampoo order')

        Expected: LLM calls search_orders -> resolves to the order -> LLM confirms status.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search_order = ParsedToolCall(
            id="call_order_search",
            name="search_orders",
            arguments={"query": "shampoo order", "limit": 5},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search_order],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_order_search"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content=f"Your order *{self.order_id}* containing Blue Shampoo is currently *CONFIRMED*.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        with patch.object(erp_client, "search_orders", new_callable=AsyncMock) as mock_search_orders:
            mock_search_orders.return_value = [
                {
                    "id": self.order_id,
                    "status": "CONFIRMED",
                    "totalAmount": 300.0,
                    "customer": {"id": self.customer_id, "name": "John Doe"},
                    "items": [{"productId": self.product_id, "sku": "SHMP-BLU", "productName": "Blue Shampoo", "quantity": 2}],
                }
            ]

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="Where is my shampoo order?",
                tenant_id=self.tenant_id,
            )

            assert self.order_id in response
            assert "CONFIRMED" in response

    @pytest.mark.asyncio
    async def test_scenario_11_search_knowledge_base_policy(self, mock_orchestrator):
        """TEST 11: RAG Knowledge Base search for company policy.

        Expected: LLM calls search_knowledge_base -> RAG hybrid search returns document chunks ->
        LLM answers using retrieved policy information.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search_rag = ParsedToolCall(
            id="call_rag_1",
            name="search_knowledge_base",
            arguments={"query": "return policy for damaged items", "top_k": 3},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search_rag],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_rag_1"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="According to our company policy, damaged goods must be reported within 48 hours for a free replacement.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = [[0.1] * 384]

        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = [
            {
                "text": "Damaged goods must be reported within 48 hours for a free replacement.",
                "score": 0.88,
                "filename": "return_policy.pdf",
                "page_number": 1,
                "chunk_index": 0,
                "document_id": "doc-policy-1",
            }
        ]

        with patch("app.tools.catalog_tools.get_embedding_service", return_value=mock_embedder), \
             patch("app.tools.catalog_tools.get_vector_store", return_value=mock_store):

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="What is the return policy for damaged items?",
                tenant_id=self.tenant_id,
            )

            assert "48 hours" in response
            assert "replacement" in response
            mock_store.hybrid_search.assert_called_once()

    @pytest.mark.asyncio
    async def test_scenario_12_search_knowledge_base_no_results(self, mock_orchestrator):
        """TEST 12: RAG Knowledge Base search with no matches.

        Expected: LLM calls search_knowledge_base -> RAG returns empty results ->
        LLM states it could not find the information rather than hallucinating.
        """
        orchestrator, mock_client = mock_orchestrator

        tc_search_rag = ParsedToolCall(
            id="call_rag_2",
            name="search_knowledge_base",
            arguments={"query": "spaceship rental policy"},
        )
        resp_turn1 = ParsedLLMResponse(
            content=None,
            tool_calls=[tc_search_rag],
            has_tool_calls=True,
            raw_message={"role": "assistant", "tool_calls": [{"id": "call_rag_2"}]},
        )
        resp_turn2 = ParsedLLMResponse(
            content="I searched our company knowledge base, but could not find any information regarding spaceship rental policy.",
            tool_calls=[],
            has_tool_calls=False,
        )

        mock_client.generate_response.side_effect = [resp_turn1, resp_turn2]

        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = [[0.1] * 384]

        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = []

        with patch("app.tools.catalog_tools.get_embedding_service", return_value=mock_embedder), \
             patch("app.tools.catalog_tools.get_vector_store", return_value=mock_store):

            response = await orchestrator.generate_response(
                user_id="user_whatsapp_1",
                message="What is your spaceship rental policy?",
                tenant_id=self.tenant_id,
            )

            assert "could not find" in response


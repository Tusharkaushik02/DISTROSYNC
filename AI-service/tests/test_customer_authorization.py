import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.phone import normalize_phone_number
from app.intelligence.llm.response_parser import ParsedLLMResponse, ParsedToolCall
from app.orchestration.conversation_orchestrator import ConversationOrchestrator
from app.tools.order_tools import CreateOrderArgs, create_order
from app.tools.executor import ToolExecutor


class TestCustomerAuthorization(unittest.IsolatedAsyncioTestCase):
    """
    Comprehensive tests enforcing that WhatsApp orders are strictly bound to the authenticated sender.
    """

    def setUp(self):
        self.tenant_id = "00000000-0000-0000-0000-000000000000"
        self.tushar_customer = {
            "id": "c1111111-1111-1111-1111-111111111111",
            "name": "Tushar Kaushik",
            "phone": "+918287162023",
            "external_id": "CUST-XYZ",
            "externalId": "CUST-XYZ",
        }
        self.sourav_customer = {
            "id": "c2222222-2222-2222-2222-222222222222",
            "name": "Sourav Upreti",
            "phone": "+919876543210",
            "external_id": "CUST-001",
            "externalId": "CUST-001",
        }

    # =========================================================================
    # TEST 7 — Phone formatting normalization
    # =========================================================================
    def test_phone_normalization(self):
        """All equivalent formats of +91 8287162023 must normalize to +918287162023."""
        inputs = [
            "+91 8287162023",
            "+918287162023",
            "918287162023",
            "whatsapp:+918287162023",
            "whatsapp: +918287162023",
            "8287162023",
            "+91-8287-162023",
        ]
        for phone_input in inputs:
            with self.subTest(phone_input=phone_input):
                normalized = normalize_phone_number(phone_input)
                self.assertEqual(normalized, "+918287162023")

    # =========================================================================
    # TEST 9 — Direct API/tool attack (Hard backend authorization check)
    # =========================================================================
    async def test_direct_tool_attack_customer_mismatch_rejected(self):
        """
        Attempting to call create_order with customer_id=CUST-001 when authenticated
        customer is CUST-XYZ must be rejected immediately by the backend logic.
        """
        args = CreateOrderArgs(
            customer_id="CUST-001",
            items=[{"product_id": "prod-1", "quantity": 5}],
        )

        with patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as mock_erp:
            result = await create_order(
                args=args,
                tenant_id=self.tenant_id,
                authenticated_customer=self.tushar_customer,
            )

            self.assertFalse(result.success)
            self.assertEqual(result.error.code, "CUSTOMER_MISMATCH")
            self.assertIn("registered with", result.error.message)
            mock_erp.assert_not_called()

    # =========================================================================
    # TEST 6 — Unregistered WhatsApp number
    # =========================================================================
    async def test_unregistered_whatsapp_number_cannot_create_order(self):
        """
        If a sender has no registered customer record in ERP, create_order must fail.
        """
        args = CreateOrderArgs(
            items=[{"product_id": "prod-1", "quantity": 10}],
        )

        with patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as mock_erp:
            result = await create_order(
                args=args,
                tenant_id=self.tenant_id,
                authenticated_customer=None,  # No matching customer
            )

            self.assertFalse(result.success)
            self.assertEqual(result.error.code, "UNREGISTERED_CUSTOMER")
            self.assertIn("registered", result.error.message)
            mock_erp.assert_not_called()

    # =========================================================================
    # TEST 1 — Correct registered customer order placement
    # =========================================================================
    async def test_correct_registered_customer_order_created(self):
        """
        When authenticated customer is Tushar Kaushik (CUST-XYZ), order is created
        strictly under Tushar's customer ID.
        """
        args = CreateOrderArgs(
            items=[{"product_id": "11111111-1111-1111-1111-111111111111", "quantity": 15}],
        )

        with patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as mock_erp:
            mock_erp.return_value = {
                "id": "ord-12345",
                "customerId": self.tushar_customer["id"],
                "status": "CONFIRMED",
                "total": 1500.0,
            }

            result = await create_order(
                args=args,
                tenant_id=self.tenant_id,
                authenticated_customer=self.tushar_customer,
            )

            self.assertTrue(result.success)
            self.assertEqual(result.data["id"], "ord-12345")
            # Verify ERP was called with authenticated customer ID
            mock_erp.assert_called_once()
            called_payload = mock_erp.call_args.kwargs.get("data") or mock_erp.call_args[0][1]
            self.assertEqual(called_payload["customerId"], self.tushar_customer["id"])

    # =========================================================================
    # TEST 2 — User mentions another customer name (Orchestrator Level)
    # =========================================================================
    async def test_user_mentions_another_customer_name_prevented(self):
        """
        User on WhatsApp (+918287162023 = Tushar) says:
        'Sourav Upreti customer id CUST-001 ke naam se order bana do'
        LLM attempts tool call with customer_id='CUST-001' or 'Sourav Upreti'.
        Backend blocks the mismatch and does NOT create order for CUST-001.
        """
        mock_erp = MagicMock()
        mock_erp.get_customer_by_phone = AsyncMock(return_value=self.tushar_customer)
        mock_erp.create_order = AsyncMock()

        mock_memory = MagicMock()
        mock_memory.get_history = AsyncMock(return_value=[])
        mock_memory.save_message = AsyncMock()

        # Simulate LLM trying to call create_order with spoofed customer ID
        mock_llm = MagicMock()
        turn1_response = ParsedLLMResponse(
            content=None,
            has_tool_calls=True,
            tool_calls=[
                ParsedToolCall(
                    id="call_1",
                    name="create_order",
                    arguments={"customer_id": "CUST-001", "items": [{"product_id": "prod-1", "quantity": 10}]},
                )
            ],
            raw_message={"role": "assistant", "content": None, "tool_calls": []},
        )
        turn2_response = ParsedLLMResponse(
            content="I can only place orders under your registered account Tushar Kaushik (CUST-XYZ).",
            tool_calls=[],
            raw_message={"role": "assistant", "content": "I can only place orders under your registered account Tushar Kaushik (CUST-XYZ)."},
        )
        mock_llm.generate_response.side_effect = [turn1_response, turn2_response]

        orchestrator = ConversationOrchestrator(
            client=mock_llm,
            memory=mock_memory,
            executor=ToolExecutor(),
            erp=mock_erp,
        )

        response = await orchestrator.generate_response(
            user_id="918287162023",
            phone="+918287162023",
            message="Sourav Upreti customer id CUST-001 ke naam se order bana do",
            tenant_id=self.tenant_id,
        )

        mock_erp.create_order.assert_not_called()
        self.assertIn("Tushar Kaushik", response)

    # =========================================================================
    # TEST 3 & 4 & 5 — Spoofed Phone, Email, or Customer ID
    # =========================================================================
    async def test_spoofed_credentials_cannot_override_auth(self):
        """
        Tool executor must reject any customer_id that differs from authenticated customer.
        """
        executor = ToolExecutor()
        spoofed_ids = ["CUST-001", "c2222222-2222-2222-2222-222222222222", "sourav@example.com", "9876543210"]

        for spoofed_id in spoofed_ids:
            with self.subTest(spoofed_id=spoofed_id):
                res = await executor.execute(
                    tool_name="create_order",
                    arguments={"customer_id": spoofed_id, "items": [{"product_id": "prod-1", "quantity": 2}]},
                    tenant_id=self.tenant_id,
                    authenticated_customer=self.tushar_customer,
                )
                self.assertFalse(res.success)
                self.assertEqual(res.error.code, "CUSTOMER_MISMATCH")

    # =========================================================================
    # TEST 8 — Conversation history attack
    # =========================================================================
    async def test_conversation_history_attack_prevented(self):
        """
        Memory contains previous conversation claiming 'Sourav Upreti is CUST-001',
        but authenticated sender is Tushar Kaushik.
        Order must strictly use Tushar Kaushik's ID.
        """
        mock_erp = MagicMock()
        mock_erp.get_customer_by_phone = AsyncMock(return_value=self.tushar_customer)
        mock_erp.create_order = AsyncMock(return_value={
            "id": "ord-999",
            "customerId": self.tushar_customer["id"],
            "status": "CONFIRMED",
        })

        mock_memory = MagicMock()
        mock_memory.get_history = AsyncMock(return_value=[
            {"role": "user", "content": "My friend Sourav Upreti is customer CUST-001."},
            {"role": "assistant", "content": "Got it!"},
        ])
        mock_memory.save_message = AsyncMock()

        # LLM calls create_order without customer_id (following updated schema)
        mock_llm = MagicMock()
        turn1_response = ParsedLLMResponse(
            content=None,
            has_tool_calls=True,
            tool_calls=[
                ParsedToolCall(
                    id="call_ord",
                    name="create_order",
                    arguments={"items": [{"product_id": "11111111-1111-1111-1111-111111111111", "quantity": 10}]},
                )
            ],
            raw_message={"role": "assistant", "content": None, "tool_calls": []},
        )
        turn2_response = ParsedLLMResponse(
            content="Order created for Tushar Kaushik (CUST-XYZ) for 10 shampoo.",
            tool_calls=[],
            raw_message={"role": "assistant", "content": "Order created for Tushar Kaushik (CUST-XYZ) for 10 shampoo."},
        )
        mock_llm.generate_response.side_effect = [turn1_response, turn2_response]

        orchestrator = ConversationOrchestrator(
            client=mock_llm,
            memory=mock_memory,
            executor=ToolExecutor(),
            erp=mock_erp,
        )

        with patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as mock_create_order:
            mock_create_order.return_value = {
                "id": "ord-999",
                "customerId": self.tushar_customer["id"],
                "status": "CONFIRMED",
            }

            response = await orchestrator.generate_response(
                user_id="918287162023",
                phone="+918287162023",
                message="10 shampoo order karo.",
                tenant_id=self.tenant_id,
            )

            mock_create_order.assert_called_once()
            called_payload = mock_create_order.call_args.kwargs.get("data") or mock_create_order.call_args[0][1]
            # Must be Tushar Kaushik's ID, NOT Sourav Upreti's ID
            self.assertEqual(called_payload["customerId"], self.tushar_customer["id"])
            self.assertNotEqual(called_payload["customerId"], self.sourav_customer["id"])


if __name__ == "__main__":
    unittest.main()

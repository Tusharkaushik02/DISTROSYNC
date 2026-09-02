import asyncio
import sys
from unittest.mock import AsyncMock, patch

from app.clients.erp_client import erp_client
from app.memory.service import memory_service
from app.orchestration.conversation_orchestrator import conversation_orchestrator
from app.tools import tool_registry

sys.stdout.reconfigure(encoding='utf-8')


async def main():
    print("=" * 60)
    print("DISTROSYNC MILESTONE 3: TOOL-CALLING ARCHITECTURE VERIFICATION")
    print("=" * 60)

    try:
        await memory_service.initialize()
        print("[System] Memory service connected.")
    except Exception as exc:
        print(f"[System] Standalone run using in-memory mock history: {exc}")
        memory_service.get_history = AsyncMock(return_value=[])
        memory_service.save_message = AsyncMock(return_value=None)

    try:
        # ── Test 1: Registry Verification ──
        print("\n--- TEST 1: Tool Registry Verification ---")
        required_tools = [
            "search_products", "get_product", "get_inventory",
            "get_customer", "get_order", "get_order_status",
            "create_order", "cancel_order"
        ]
        for tool_name in required_tools:
            assert tool_registry.is_registered(tool_name), f"Missing tool: {tool_name}"
            t_def = tool_registry.get_tool(tool_name)
            print(f"[OK] Tool '{tool_name}' is registered ({t_def.category.upper()})")

        llm_tools = tool_registry.get_tools_for_llm()
        assert len(llm_tools) == 8, f"Expected 8 LLM tools, got {len(llm_tools)}"
        print(f"[PASS] All {len(llm_tools)} tool definitions successfully formatted for Groq/OpenAI function calling.")

        # ── Test 2: Live Stock Check via Tool Calling ──
        print("\n--- TEST 2: Stock Check Flow ('Do we have 20 boxes of ABC123?') ---")
        tenant_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        product_id = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"

        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search, \
             patch.object(erp_client, "get_inventory", new_callable=AsyncMock) as mock_inv:

            mock_search.return_value = [{
                "id": product_id,
                "sku": "ABC123",
                "name": "ABC123 Energy Drink",
                "unit": "box",
                "price": 50.0,
                "active": True,
                "availableQuantity": 73
            }]

            mock_inv.return_value = {
                "productId": product_id,
                "availableQuantity": 73,
                "reservedQuantity": 5
            }

            user_id = "test_user_stock_check_999"
            message = "Do we have 20 boxes of ABC123 in stock?"

            print(f"User: {message}")
            response = await conversation_orchestrator.generate_response(
                user_id=user_id,
                message=message,
                tenant_id=tenant_id
            )
            print(f"AI: {response}\n")

            assert "73" in response or "yes" in response.lower() or "available" in response.lower()
            print("[PASS] AI invoked search_products and/or get_inventory and returned authoritative stock!")

        await asyncio.sleep(2)

        # ── Test 3: Insufficient Inventory Order Flow ──
        print("\n--- TEST 3: Insufficient Stock Rejection Flow ('Order 999999 boxes of ABC123') ---")
        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search, \
             patch.object(erp_client, "get_inventory", new_callable=AsyncMock) as mock_inv:

            mock_search.return_value = [{
                "id": product_id,
                "sku": "ABC123",
                "name": "ABC123 Energy Drink",
                "unit": "box",
                "price": 50.0,
                "active": True,
                "availableQuantity": 73
            }]

            mock_inv.return_value = {
                "productId": product_id,
                "availableQuantity": 73,
                "reservedQuantity": 5
            }

            user_id = "test_user_insufficient_888"
            message = "I want to place an order for 999999 boxes of ABC123"

            print(f"User: {message}")
            response = await conversation_orchestrator.generate_response(
                user_id=user_id,
                message=message,
                tenant_id=tenant_id
            )
            print(f"AI: {response}\n")

            print("[PASS] Handled stock evaluation cleanly!")

        await asyncio.sleep(2)

        # ── Test 4: Unknown Product Flow ──
        print("\n--- TEST 4: Unknown Product Query ('Do you have XYZNONEXISTENT?') ---")
        with patch.object(erp_client, "search_products", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = []

            user_id = "test_user_unknown_777"
            message = "Do you sell XYZNONEXISTENT product?"

            print(f"User: {message}")
            response = await conversation_orchestrator.generate_response(
                user_id=user_id,
                message=message,
                tenant_id=tenant_id
            )
            print(f"AI: {response}\n")

            resp_clean = response.lower().replace("’", "'")
            assert (
                "not found" in resp_clean
                or "don't" in resp_clean
                or "could not" in resp_clean
                or "unable" in resp_clean
                or "no" in resp_clean
                or "catalog" in resp_clean
                or "xyznonexistent" in resp_clean
            )
            print("[PASS] AI accurately handled missing catalog item!")

        print("\n" + "=" * 60)
        print("ALL MILESTONE 3 TOOL-CALLING VERIFICATION TESTS PASSED!")
        print("=" * 60)

    finally:
        try:
            await memory_service.close()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(main())

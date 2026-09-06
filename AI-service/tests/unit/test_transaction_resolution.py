from unittest.mock import AsyncMock, patch

import pytest

from app.tools.customer_tools import search_customers
from app.tools.order_tools import create_order, search_orders
from app.tools.product_tools import search_products
from app.tools.schemas import (
    CreateOrderArgs,
    CreateOrderItemInput,
    SearchCustomersArgs,
    SearchOrdersArgs,
    SearchProductsArgs,
)


TENANT_ID = "tenant-1"
CUSTOMER_ID = "11111111-1111-1111-1111-111111111111"
PRODUCT_ID = "22222222-2222-2222-2222-222222222222"


@pytest.mark.asyncio
async def test_all_three_search_tools_use_shared_resolution_layer():
    with patch("app.tools.product_tools.erp_client.search_products", new_callable=AsyncMock) as product_search:
        product_search.return_value = [
            {"id": PRODUCT_ID, "sku": "SHMP-BLU-001", "name": "Blue Shampoo", "availableQuantity": 4}
        ]
        result = await search_products(SearchProductsArgs(query="bleu shampoo", limit=5), TENANT_ID)
        assert result.success
        assert result.data["matches"][0]["id"] == PRODUCT_ID
        assert result.data["matches"][0]["confidence"] == "high"

    with patch("app.tools.customer_tools.erp_client.search_customers", new_callable=AsyncMock) as customer_search:
        customer_search.return_value = [
            {"id": CUSTOMER_ID, "name": "John Doe Wholesale", "phone": "+919876543210"}
        ]
        result = await search_customers(SearchCustomersArgs(query="Jon Doe", limit=5), TENANT_ID)
        assert result.success
        assert result.data["matches"][0]["id"] == CUSTOMER_ID

    with patch("app.tools.order_tools.erp_client.search_orders", new_callable=AsyncMock) as order_search:
        order_search.return_value = [
            {
                "id": "44444444-4444-4444-4444-444444444444",
                "status": "CONFIRMED",
                "customer": {"id": CUSTOMER_ID, "name": "John Doe Wholesale"},
                "items": [{"productName": "Blue Shampoo", "sku": "SHMP-BLU-001", "quantity": 1}],
                "totalAmount": 150,
            }
        ]
        result = await search_orders(SearchOrdersArgs(query="bleu shampoo order", limit=5), TENANT_ID)
        assert result.success
        assert result.data["matches"][0]["id"] == "44444444-4444-4444-4444-444444444444"


@pytest.mark.asyncio
async def test_create_order_resolves_names_to_canonical_ids_before_write():
    with patch("app.tools.customer_tools.erp_client.search_customers", new_callable=AsyncMock) as customer_search, \
         patch("app.tools.product_tools.erp_client.search_products", new_callable=AsyncMock) as product_search, \
         patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as create:
        customer_search.return_value = [
            {"id": CUSTOMER_ID, "name": "John Doe Wholesale", "phone": "+919876543210"}
        ]
        product_search.return_value = [
            {
                "id": PRODUCT_ID,
                "sku": "SHMP-BLU-001",
                "name": "Blue Shampoo",
                "active": True,
                "availableQuantity": 7,
                "price": 150,
            }
        ]
        create.return_value = {"id": "order-1", "status": "CONFIRMED", "totalAmount": 150}

        result = await create_order(
            CreateOrderArgs(
                customer_id="John Doe Wholesale",
                items=[CreateOrderItemInput(product_id="SHMP-BLU-001", quantity=1)],
            ),
            TENANT_ID,
            authenticated_customer={"id": CUSTOMER_ID, "name": "John Doe Wholesale"},
        )

        assert result.success
        assert create.await_args.kwargs["data"] == {
            "customerId": CUSTOMER_ID,
            "items": [{"productId": PRODUCT_ID, "quantity": 1}],
        }


@pytest.mark.asyncio
async def test_create_order_does_not_silently_replace_out_of_stock_product():
    with patch("app.tools.customer_tools.erp_client.search_customers", new_callable=AsyncMock) as customer_search, \
         patch("app.tools.product_tools.erp_client.search_products", new_callable=AsyncMock) as product_search, \
         patch("app.tools.order_tools.erp_client.create_order", new_callable=AsyncMock) as create:
        customer_search.return_value = [{"id": CUSTOMER_ID, "name": "John Doe Wholesale"}]
        product_search.return_value = [
            {
                "id": PRODUCT_ID,
                "sku": "SHMP-BLU-001",
                "name": "Blue Shampoo",
                "active": True,
                "availableQuantity": 0,
            },
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "sku": "SHMP-YEL-001",
                "name": "Yellow Shampoo",
                "active": True,
                "availableQuantity": 10,
            },
        ]

        result = await create_order(
            CreateOrderArgs(
                customer_id=CUSTOMER_ID,
                items=[CreateOrderItemInput(product_id="blue shampoo", quantity=1)],
            ),
            TENANT_ID,
            authenticated_customer={"id": CUSTOMER_ID, "name": "John Doe Wholesale"},
        )

        assert not result.success
        assert result.error.code == "INSUFFICIENT_INVENTORY"
        create.assert_not_awaited()

import pytest
from unittest.mock import AsyncMock, patch

from app.tools.order_tools import update_order
from app.tools.product_tools import search_products
from app.tools.schemas import SearchProductsArgs, UpdateOrderArgs


@pytest.mark.asyncio
async def test_update_order_tool_success():
    mock_order = {
        "id": "11111111-1111-1111-1111-111111111111",
        "status": "CONFIRMED",
        "totalAmount": 500,
        "shippingAddress": "456 Market St",
        "customer": {"name": "Metro Retail"},
        "items": [],
        "updatedAt": "2026-09-07T10:00:00Z",
    }

    with patch("app.clients.erp_client.erp_client.update_order", new_callable=AsyncMock) as mock_update:
        mock_update.return_value = mock_order

        args = UpdateOrderArgs(
            order_id="11111111-1111-1111-1111-111111111111",
            shipping_address="456 Market St",
        )
        result = await update_order(args=args, tenant_id="tenant-1")

        assert result.success is True
        assert result.tool_name == "update_order"
        assert result.data["shipping_address"] == "456 Market St"
        assert result.data["status"] == "CONFIRMED"
        mock_update.assert_called_once_with(
            tenant_id="tenant-1",
            order_id="11111111-1111-1111-1111-111111111111",
            data={"shippingAddress": "456 Market St"},
        )


@pytest.mark.asyncio
async def test_update_order_tool_no_fields():
    args = UpdateOrderArgs(
        order_id="11111111-1111-1111-1111-111111111111",
        shipping_address=None,
    )
    result = await update_order(args=args, tenant_id="tenant-1")

    assert result.success is False
    assert result.error.code == "NO_FIELDS_TO_UPDATE"


@pytest.mark.asyncio
async def test_semantic_product_search_with_category_and_tags():
    mock_catalog = [
        {
            "id": "prod-cola-1",
            "sku": "COLA-500",
            "name": "Classic Cola 500ml",
            "description": "Carbonated beverage",
            "category": "Beverages",
            "tags": ["cold drink", "soft drink", "soda", "cola"],
            "unit": "bottle",
            "price": 40.0,
            "availableQuantity": 100,
            "reservedQuantity": 0,
            "active": True,
        }
    ]

    with patch("app.clients.erp_client.erp_client.search_products", new_callable=AsyncMock) as mock_search, \
         patch("app.clients.erp_client.erp_client.list_products", new_callable=AsyncMock) as mock_list:
        # ERP search returns matching product via category/tags
        mock_search.return_value = mock_catalog
        mock_list.return_value = mock_catalog

        args = SearchProductsArgs(query="cold drinks", limit=5)
        result = await search_products(args=args, tenant_id="tenant-1")

        assert result.success is True
        assert result.data["count"] > 0
        matches = result.data["matches"]
        assert len(matches) > 0
        assert matches[0]["id"] == "prod-cola-1"
        assert matches[0]["confidence"] in ("high", "medium")

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from app.clients.erp_client import ERPClient
from app.core.exceptions import ERPServiceError


class TestERPClient:
    def setup_method(self):
        self.client = ERPClient(
            base_url="http://mock-erp:4002",
            api_key="test-api-key",
            timeout=5.0,
        )

    @pytest.mark.asyncio
    async def test_search_products_success(self):
        mock_response = httpx.Response(
            status_code=200,
            json={
                "success": True,
                "data": [
                    {"id": "p1", "sku": "ABC123", "name": "Test Product", "price": 100}
                ],
            },
            request=httpx.Request("GET", "http://mock-erp:4002/api/v1/products/search"),
        )

        with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response

            products = await self.client.search_products(
                tenant_id="tenant-uuid-1",
                query="ABC123",
                limit=5,
            )

            assert len(products) == 1
            assert products[0]["sku"] == "ABC123"

            # Check headers
            call_kwargs = mock_req.call_args[1]
            assert call_kwargs["headers"]["x-service-key"] == "test-api-key"
            assert call_kwargs["headers"]["x-tenant-id"] == "tenant-uuid-1"

    @pytest.mark.asyncio
    async def test_get_inventory_success(self):
        mock_response = httpx.Response(
            status_code=200,
            json={
                "success": True,
                "data": {
                    "productId": "p1",
                    "availableQuantity": 73,
                    "reservedQuantity": 5,
                },
            },
            request=httpx.Request("GET", "http://mock-erp:4002/api/v1/inventory/p1"),
        )

        with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response

            inv = await self.client.get_inventory(
                tenant_id="tenant-uuid-1",
                product_id="p1",
            )

            assert inv["availableQuantity"] == 73
            assert inv["reservedQuantity"] == 5

    @pytest.mark.asyncio
    async def test_erp_error_raises_custom_exception(self):
        mock_response = httpx.Response(
            status_code=400,
            json={
                "success": False,
                "error": {
                    "code": "INSUFFICIENT_INVENTORY",
                    "message": "Stock not available",
                    "details": {"requested": 20, "available": 5},
                },
            },
            request=httpx.Request("POST", "http://mock-erp:4002/api/v1/orders"),
        )

        with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response

            with pytest.raises(ERPServiceError) as exc_info:
                await self.client.create_order(
                    tenant_id="tenant-uuid-1",
                    data={"customerId": "c1", "items": [{"productId": "p1", "quantity": 20}]},
                )

            assert exc_info.value.code == "INSUFFICIENT_INVENTORY"
            assert "Stock not available" in str(exc_info.value)
            assert exc_info.value.details == {"requested": 20, "available": 5}

    @pytest.mark.asyncio
    async def test_erp_connection_error_handling(self):
        with patch("httpx.AsyncClient.request", side_effect=httpx.ConnectError("Failed to connect")):
            with pytest.raises(ERPServiceError) as exc_info:
                await self.client.get_product("tenant-uuid-1", "p1")

            assert exc_info.value.code == "ERP_UNAVAILABLE"
            assert exc_info.value.status_code == 503

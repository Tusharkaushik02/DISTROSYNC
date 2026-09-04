import logging
from typing import Any
import httpx

from app.core.config import settings
from app.core.exceptions import ERPServiceError

logger = logging.getLogger(__name__)


class ERPClient:
    """Async client for interacting with the ERP Service REST APIs."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float | None = None,
    ):
        self.base_url = (base_url or settings.ERP_SERVICE_URL).rstrip("/")
        self.api_key = api_key or settings.ERP_SERVICE_API_KEY
        self.timeout = timeout or settings.ERP_TIMEOUT_SECONDS

    def _get_headers(self, tenant_id: str, idempotency_key: str | None = None) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "x-service-key": self.api_key,
            "x-tenant-id": tenant_id,
        }
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        tenant_id: str,
        *,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = self._get_headers(tenant_id, idempotency_key)

        print(f"[ERP Client] 🌐 {method} {url} (Tenant: {tenant_id})")
        logger.info(
            "[ERPClient] %s %s | Tenant: %s",
            method,
            path,
            tenant_id,
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                )
        except httpx.ConnectError as exc:
            logger.error("[ERPClient] Connection failed for %s %s: %s", method, url, exc)
            raise ERPServiceError(
                "Unable to connect to ERP service. Service may be down.",
                error_code="ERP_UNAVAILABLE",
                status_code=503,
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error("[ERPClient] Request timed out for %s %s: %s", method, url, exc)
            raise ERPServiceError(
                "ERP service request timed out.",
                error_code="ERP_TIMEOUT",
                status_code=504,
            ) from exc
        except Exception as exc:
            logger.error("[ERPClient] Unexpected error calling %s %s: %s", method, url, exc)
            raise ERPServiceError(
                f"Failed to communicate with ERP service: {str(exc)}",
                error_code="ERP_COMMUNICATION_ERROR",
                status_code=502,
            ) from exc

        try:
            body = response.json()
        except Exception as exc:
            logger.error("[ERPClient] Malformed JSON from ERP %s: %s", response.status_code, exc)
            raise ERPServiceError(
                "ERP returned an unparseable response.",
                error_code="ERP_MALFORMED_RESPONSE",
                status_code=502,
            ) from exc

        if not response.is_success or not body.get("success", False):
            error_data = body.get("error", {})
            error_code = error_data.get("code", "ERP_ERROR")
            error_message = error_data.get("message", f"ERP request failed with status {response.status_code}")
            error_details = error_data.get("details")

            logger.warning(
                "[ERPClient] ERP returned error: code=%s, status=%s, message=%s",
                error_code,
                response.status_code,
                error_message,
            )
            raise ERPServiceError(
                error_message,
                error_code=error_code,
                status_code=response.status_code,
                details=error_details,
            )

        return body.get("data")

    # ── Product APIs ──────────────────────────────────────────────────

    async def search_products(self, tenant_id: str, query: str, limit: int = 10) -> list[dict]:
        """Search products by name, SKU, or description."""
        result = await self._request(
            "GET",
            "/api/v1/products/search",
            tenant_id,
            params={"q": query, "limit": limit},
        )
        return result or []

    async def list_products(self, tenant_id: str, limit: int = 100, skip: int = 0) -> list[dict]:
        """List products for tenant."""
        result = await self._request(
            "GET",
            "/api/v1/products",
            tenant_id,
            params={"take": limit, "skip": skip},
        )
        return result or []

    async def get_product(self, tenant_id: str, product_id: str) -> dict:
        """Get product details by product ID."""
        return await self._request("GET", f"/api/v1/products/{product_id}", tenant_id)

    # ── Inventory APIs ────────────────────────────────────────────────

    async def get_inventory(self, tenant_id: str, product_id: str) -> dict:
        """Get inventory level for a product."""
        return await self._request("GET", f"/api/v1/inventory/{product_id}", tenant_id)

    # ── Customer APIs ─────────────────────────────────────────────────

    async def get_customer(self, tenant_id: str, customer_id: str) -> dict:
        """Get customer by customer ID."""
        return await self._request("GET", f"/api/v1/customers/{customer_id}", tenant_id)

    async def get_customer_by_phone(self, tenant_id: str, phone: str) -> dict:
        """Get customer by phone number."""
        return await self._request("GET", f"/api/v1/customers/by-phone/{phone}", tenant_id)

    async def list_customers(self, tenant_id: str, limit: int = 100, skip: int = 0) -> list[dict]:
        """List customers for tenant."""
        result = await self._request(
            "GET",
            "/api/v1/customers",
            tenant_id,
            params={"take": limit, "skip": skip},
        )
        return result or []

    async def search_customers(self, tenant_id: str, query: str, limit: int = 20) -> list[dict]:
        """Search customers by name, phone, or external ID."""
        result = await self._request(
            "GET",
            "/api/v1/customers/search",
            tenant_id,
            params={"q": query, "limit": limit},
        )
        return result or []

    # ── Order APIs ────────────────────────────────────────────────────

    async def get_order(self, tenant_id: str, order_id: str) -> dict:
        """Get full order details by order ID."""
        return await self._request("GET", f"/api/v1/orders/{order_id}", tenant_id)

    async def get_order_status(self, tenant_id: str, order_id: str) -> dict:
        """Get status of an order."""
        return await self._request("GET", f"/api/v1/orders/{order_id}/status", tenant_id)

    async def list_orders(
        self,
        tenant_id: str,
        limit: int = 100,
        skip: int = 0,
        customer_id: str | None = None,
    ) -> list[dict]:
        """List orders for tenant."""
        params: dict[str, Any] = {"take": limit, "skip": skip}
        if customer_id:
            params["customerId"] = customer_id
        result = await self._request(
            "GET",
            "/api/v1/orders",
            tenant_id,
            params=params,
        )
        return result or []

    async def search_orders(
        self,
        tenant_id: str,
        query: str,
        limit: int = 20,
        customer_id: str | None = None,
    ) -> list[dict]:
        """Search orders by ID, status, customer, or product items."""
        params: dict[str, Any] = {"q": query, "limit": limit}
        if customer_id:
            params["customerId"] = customer_id
        result = await self._request(
            "GET",
            "/api/v1/orders/search",
            tenant_id,
            params=params,
        )
        return result or []

    async def create_order(
        self,
        tenant_id: str,
        data: dict,
        idempotency_key: str | None = None,
    ) -> dict:
        """Create a new order and reserve inventory transactionally."""
        return await self._request(
            "POST",
            "/api/v1/orders",
            tenant_id,
            json_data=data,
            idempotency_key=idempotency_key,
        )

    async def update_order_status(self, tenant_id: str, order_id: str, status: str) -> dict:
        """Update order status (e.g. CANCELLED)."""
        return await self._request(
            "PATCH",
            f"/api/v1/orders/{order_id}/status",
            tenant_id,
            json_data={"status": status},
        )


erp_client = ERPClient()

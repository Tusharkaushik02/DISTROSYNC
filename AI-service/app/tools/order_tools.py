import logging
from typing import Any
from uuid import UUID

from app.clients.erp_client import erp_client
from app.core.config import settings
from app.search.semantic_search_service import semantic_search_service
from app.tools.product_tools import search_products
from app.tools.customer_tools import search_customers
from app.tools.schemas import (
    CancelOrderArgs,
    CreateOrderArgs,
    GetOrderArgs,
    GetOrderStatusArgs,
    SearchCustomersArgs,
    SearchOrdersArgs,
    SearchProductsArgs,
    ToolResult,
)

logger = logging.getLogger(__name__)


def _is_uuid(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _single_high_confidence_match(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return a match only when the shared resolver says it is unambiguous."""
    if not data or data.get("confidence_level") != "high":
        return None
    matches = data.get("matches") or []
    # A high-confidence winner may have weaker alternatives in the result set
    # (for example, Blue Shampoo and a less-similar Yellow Shampoo). The shared
    # resolver lowers confidence when candidates are genuinely close.
    if not matches or matches[0].get("confidence") != "high":
        return None
    return matches[0]


async def search_orders(
    args: SearchOrdersArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Search orders in ERP using multi-stage semantic entity resolution."""
    candidates_by_id: dict[str, dict[str, Any]] = {}

    search_kwargs: dict[str, Any] = {
        "tenant_id": tenant_id,
        "query": args.query,
        "limit": args.limit,
    }
    if args.customer_id:
        search_kwargs["customer_id"] = args.customer_id
    searched = await erp_client.search_orders(**search_kwargs)
    for o in (searched or []):
        if o.get("id"):
            candidates_by_id[o["id"]] = o

    if not candidates_by_id:
        try:
            listed = await erp_client.list_orders(
                tenant_id=tenant_id,
                customer_id=args.customer_id,
                limit=100,
            )
            for o in (listed or []):
                if o.get("id"):
                    candidates_by_id[o["id"]] = o
        except Exception as exc:
            logger.debug("[OrderTools] list_orders error: %s", exc)

    candidates = list(candidates_by_id.values())

    # Build enriched text candidates for matching
    prepared_candidates = []
    for c in candidates:
        cust = c.get("customer") or {}
        cust_name = cust.get("name", "")
        cust_phone = cust.get("phone", "")
        item_names = " ".join(
            item.get("productName") or item.get("product", {}).get("name", "")
            for item in c.get("items", [])
        )
        item_skus = " ".join(
            item.get("sku") or item.get("product", {}).get("sku", "")
            for item in c.get("items", [])
        )
        status = c.get("status", "")

        prepared_candidates.append({
            **c,
            "name": f"Order {c.get('id', '')[:8]} - {status}",
            "search_summary": f"Order {c.get('id')} {status} {cust_name} {cust_phone} {item_names} {item_skus}".strip(),
            "customer_name": cust_name,
            "items_summary": f"{item_names} {item_skus}".strip(),
        })

    search_result = await semantic_search_service.resolve_entities(
        query=args.query,
        candidates=prepared_candidates,
        entity_type="order",
        limit=args.limit,
        exact_match_fields=["id"],
        text_fields=["id", "status", "customer_name", "items_summary", "search_summary"],
        description_field="items_summary",
    )

    matches_data = []
    for m in search_result.matches:
        matches_data.append({
            "id": m.id,
            "status": m.metadata.get("status"),
            "total_amount": m.metadata.get("totalAmount"),
            "customer": m.metadata.get("customer"),
            "items": m.metadata.get("items", []),
            "created_at": m.metadata.get("createdAt"),
            "similarity_score": m.similarity_score,
            "confidence": m.confidence,
            "match_strategy": m.match_strategy,
        })

    return ToolResult.ok(
        tool_name="search_orders",
        data={
            "query": args.query,
            "count": len(matches_data),
            "confidence_level": search_result.confidence_level,
            "matches": matches_data,
            "orders": matches_data,
            "resolution": {
                "resolved_entity_id": matches_data[0]["id"] if matches_data else None,
                "confidence": search_result.confidence_level,
                "ambiguous": search_result.confidence_level == "medium",
            },
        },
    )


async def get_order(
    args: GetOrderArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Retrieve full order details by order ID or natural language query."""
    try:
        order = await erp_client.get_order(
            tenant_id=tenant_id,
            order_id=args.order_id,
        )
        return ToolResult.ok(
            tool_name="get_order",
            data={
                "id": order.get("id"),
                "status": order.get("status"),
                "total_amount": order.get("totalAmount"),
                "customer": order.get("customer"),
                "items": order.get("items", []),
                "created_at": order.get("createdAt"),
                "updated_at": order.get("updatedAt"),
            },
        )
    except Exception:
        # If ID lookup failed, attempt semantic resolution
        res = await search_orders(
            args=SearchOrdersArgs(query=args.order_id, limit=settings.SEMANTIC_SEARCH_TOP_K),
            tenant_id=tenant_id,
        )
        top = _single_high_confidence_match(res.data if res.success else None)
        if top:
            return ToolResult.ok(
                tool_name="get_order",
                data={
                    "id": top.get("id"),
                    "status": top.get("status"),
                    "total_amount": top.get("total_amount"),
                    "customer": top.get("customer"),
                    "items": top.get("items", []),
                    "created_at": top.get("created_at"),
                    "confidence": top.get("confidence"),
                    "similarity_score": top.get("similarity_score"),
                },
            )
        return ToolResult.fail(
            tool_name="get_order",
            code="ORDER_NOT_FOUND",
            message="Could not resolve the requested order with sufficient confidence.",
        )


async def get_order_status(
    args: GetOrderStatusArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Retrieve the current status of an order."""
    try:
        status_info = await erp_client.get_order_status(
            tenant_id=tenant_id,
            order_id=args.order_id,
        )
        return ToolResult.ok(
            tool_name="get_order_status",
            data={
                "order_id": status_info.get("orderId", args.order_id),
                "status": status_info.get("status"),
                "updated_at": status_info.get("updatedAt"),
            },
        )
    except Exception:
        # Fall back to semantic resolution
        res = await search_orders(
            args=SearchOrdersArgs(query=args.order_id, limit=settings.SEMANTIC_SEARCH_TOP_K),
            tenant_id=tenant_id,
        )
        top = _single_high_confidence_match(res.data if res.success else None)
        if top:
            return ToolResult.ok(
                tool_name="get_order_status",
                data={
                    "order_id": top.get("id"),
                    "status": top.get("status"),
                    "updated_at": top.get("created_at"),
                },
            )
        return ToolResult.fail(
            tool_name="get_order_status",
            code="ORDER_NOT_FOUND",
            message="Could not resolve the requested order with sufficient confidence.",
        )


async def create_order(
    args: CreateOrderArgs,
    tenant_id: str,
    authenticated_customer: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Create an ERP order strictly bound to the authenticated WhatsApp customer.

    Security & Authorization Rules:
    1. An unregistered WhatsApp sender (authenticated_customer is None) is strictly rejected.
    2. If the LLM or user supplies a customer_id that differs from authenticated_customer.id / external_id,
       the request is blocked with CUSTOMER_MISMATCH.
    3. The order customer ID is unconditionally bound to authenticated_customer["id"].
    """
    # ── 1. Hard Check: Authenticated Customer Required ────────────────────────
    if not authenticated_customer or not authenticated_customer.get("id"):
        logger.warning("[ORDER] Attempted order creation without authenticated customer identity")
        print("[ORDER] [BLOCKED] Unregistered WhatsApp customer cannot create orders")
        return ToolResult.fail(
            tool_name="create_order",
            code="UNREGISTERED_CUSTOMER",
            message="I couldn't find a customer account registered with this WhatsApp number. I can't place an order until this number is registered with a customer account.",
        )

    auth_cust_id = str(authenticated_customer["id"]).strip()
    auth_cust_name = authenticated_customer.get("name", "Registered Customer")
    auth_cust_code = str(authenticated_customer.get("external_id") or "").strip()

    # ── 2. Hard Check: Validate requested customer_id against authenticated identity ──
    requested_cust_id = (args.customer_id or "").strip()
    if requested_cust_id:
        is_exact_id = requested_cust_id == auth_cust_id
        is_exact_code = bool(auth_cust_code and (requested_cust_id.lower() == auth_cust_code.lower()))

        if not is_exact_id and not is_exact_code:
            logger.warning(
                "[ORDER] BLOCKED customer mismatch: requested='%s', authorized='%s' (%s)",
                requested_cust_id,
                auth_cust_id,
                auth_cust_name,
            )
            print(f"[ORDER] Requested customer: {requested_cust_id}")
            print(f"[ORDER] Authorized customer: {auth_cust_id} ({auth_cust_name})")
            print("[ORDER] [BLOCKED] customer mismatch")
            return ToolResult.fail(
                tool_name="create_order",
                code="CUSTOMER_MISMATCH",
                message=f"Your WhatsApp number is registered with {auth_cust_name} ({auth_cust_code or auth_cust_id}), so I can only place orders under that customer account. I cannot place an order under another customer's account.",
                details={
                    "requested_customer": requested_cust_id,
                    "authorized_customer_id": auth_cust_id,
                    "authorized_customer_name": auth_cust_name,
                },
            )

    # ── 3. Unconditionally inject the authoritative customer ID ──────────────
    customer_id = auth_cust_id
    print(f"[ORDER] Authorized customer: {auth_cust_id} ({auth_cust_name})")

    # ── 4. Resolve Products & Quantities ─────────────────────────────────────
    resolved_items = []
    for item in args.items:
        product_id = item.product_id
        if not _is_uuid(product_id):
            product_result = await search_products(
                args=SearchProductsArgs(query=product_id, limit=settings.SEMANTIC_SEARCH_TOP_K),
                tenant_id=tenant_id,
            )
            product_match = _single_high_confidence_match(product_result.data if product_result.success else None)
            if not product_match:
                return ToolResult.fail(
                    tool_name="create_order",
                    code="PRODUCT_RESOLUTION_REQUIRED",
                    message=f"The product reference '{product_id}' is ambiguous or could not be resolved. Please provide the product SKU or clarify the product.",
                )
            if product_match.get("availability") == "out_of_stock" and product_match.get("quantity", 0) <= 0:
                return ToolResult.fail(
                    tool_name="create_order",
                    code="INSUFFICIENT_INVENTORY",
                    message=f"{product_match.get('name', 'The requested product')} is currently unavailable and cannot be ordered.",
                    details={
                        "productId": product_match.get("id"),
                        "sku": product_match.get("sku"),
                        "availableQuantity": product_match.get("quantity", 0),
                    },
                )
            product_id = product_match["id"]
        resolved_items.append({"productId": product_id, "quantity": item.quantity})

    payload = {
        "customerId": customer_id,
        "items": resolved_items,
    }

    order = await erp_client.create_order(
        tenant_id=tenant_id,
        data=payload,
        idempotency_key=idempotency_key,
    )

    print(f"[ORDER] [OK] Order created successfully ID: {order.get('id')} for customer: {auth_cust_name}")

    return ToolResult.ok(
        tool_name="create_order",
        data={
            "id": order.get("id"),
            "status": order.get("status"),
            "total_amount": order.get("totalAmount"),
            "customer": order.get("customer"),
            "items": order.get("items", []),
            "created_at": order.get("createdAt"),
        },
    )


async def cancel_order(
    args: CancelOrderArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Resolve a human-readable order reference before cancelling it."""
    order_id = args.order_id
    if not _is_uuid(order_id):
        result = await search_orders(
            args=SearchOrdersArgs(query=order_id, limit=settings.SEMANTIC_SEARCH_TOP_K),
            tenant_id=tenant_id,
        )
        match = _single_high_confidence_match(result.data if result.success else None)
        if not match:
            return ToolResult.fail(
                tool_name="cancel_order",
                code="ORDER_RESOLUTION_REQUIRED",
                message="The order reference is ambiguous or could not be resolved. Please provide the order ID or clarify the order.",
            )
        order_id = match["id"]

    updated = await erp_client.update_order_status(
        tenant_id=tenant_id,
        order_id=order_id,
        status="CANCELLED",
    )
    return ToolResult.ok(
        tool_name="cancel_order",
        data={
            "order_id": updated.get("orderId", order_id),
            "status": updated.get("status"),
            "updated_at": updated.get("updatedAt"),
        },
    )

import logging
from app.clients.erp_client import erp_client
from app.tools.schemas import (
    CancelOrderArgs,
    CreateOrderArgs,
    GetOrderArgs,
    GetOrderStatusArgs,
    ToolResult,
)

logger = logging.getLogger(__name__)


async def get_order(
    args: GetOrderArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve full order details by order ID."""
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


async def get_order_status(
    args: GetOrderStatusArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve the current status of an order."""
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


async def create_order(
    args: CreateOrderArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Create a new order in ERP and atomically reserve inventory."""
    payload = {
        "customerId": args.customer_id,
        "items": [
            {
                "productId": item.product_id,
                "quantity": item.quantity,
            }
            for item in args.items
        ],
    }

    order = await erp_client.create_order(
        tenant_id=tenant_id,
        data=payload,
        idempotency_key=idempotency_key,
    )

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
) -> ToolResult:
    """Cancel an existing order in ERP."""
    updated = await erp_client.update_order_status(
        tenant_id=tenant_id,
        order_id=args.order_id,
        status="CANCELLED",
    )
    return ToolResult.ok(
        tool_name="cancel_order",
        data={
            "order_id": updated.get("orderId", args.order_id),
            "status": updated.get("status"),
            "updated_at": updated.get("updatedAt"),
        },
    )

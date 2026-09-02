import logging
from app.clients.erp_client import erp_client
from app.tools.schemas import GetInventoryArgs, ToolResult

logger = logging.getLogger(__name__)


async def get_inventory(
    args: GetInventoryArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve available and reserved inventory for a product."""
    inventory = await erp_client.get_inventory(
        tenant_id=tenant_id,
        product_id=args.product_id,
    )
    return ToolResult.ok(
        tool_name="get_inventory",
        data={
            "product_id": inventory.get("productId", args.product_id),
            "available_quantity": inventory.get("availableQuantity", 0),
            "reserved_quantity": inventory.get("reservedQuantity", 0),
        },
    )

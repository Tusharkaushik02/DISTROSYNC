import logging
from app.clients.erp_client import erp_client
from app.tools.schemas import GetCustomerArgs, ToolResult

logger = logging.getLogger(__name__)


async def get_customer(
    args: GetCustomerArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve customer information by customer ID or phone number."""
    if not args.customer_id and not args.phone:
        return ToolResult.fail(
            tool_name="get_customer",
            code="MISSING_CUSTOMER_IDENTIFIER",
            message="Either customer_id or phone must be provided to get customer details.",
        )

    if args.customer_id:
        customer = await erp_client.get_customer(
            tenant_id=tenant_id,
            customer_id=args.customer_id,
        )
    else:
        customer = await erp_client.get_customer_by_phone(
            tenant_id=tenant_id,
            phone=args.phone,  # type: ignore
        )

    return ToolResult.ok(
        tool_name="get_customer",
        data={
            "id": customer.get("id"),
            "name": customer.get("name"),
            "phone": customer.get("phone"),
            "external_id": customer.get("externalId"),
        },
    )

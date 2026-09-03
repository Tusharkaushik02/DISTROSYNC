import logging
from app.clients.erp_client import erp_client
from app.tools.schemas import GetProductArgs, SearchProductsArgs, ToolResult

logger = logging.getLogger(__name__)


async def search_products(
    args: SearchProductsArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Search products in ERP by query string."""
    products = await erp_client.search_products(
        tenant_id=tenant_id,
        query=args.query,
        limit=args.limit,
    )
    # Normalize product results for the LLM
    normalized = []
    for p in products:
        normalized.append({
            "id": p.get("id"),
            "sku": p.get("sku"),
            "name": p.get("name"),
            "description": p.get("description"),
            "unit": p.get("unit"),
            "price": p.get("price"),
            "active": p.get("active"),
            "availability_status": "available" if p.get("active", False) else "out_of_stock",
            "available_quantity": p.get("availableQuantity", 0),
        })

    return ToolResult.ok(
        tool_name="search_products",
        data={"query": args.query, "count": len(normalized), "products": normalized},
    )


async def get_product(
    args: GetProductArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve detailed product information by product ID."""
    product = await erp_client.get_product(
        tenant_id=tenant_id,
        product_id=args.product_id,
    )
    return ToolResult.ok(
        tool_name="get_product",
        data={
            "id": product.get("id"),
            "sku": product.get("sku"),
            "name": product.get("name"),
            "description": product.get("description"),
            "unit": product.get("unit"),
            "price": product.get("price"),
            "active": product.get("active"),
            "availability_status": "available" if product.get("active", False) else "out_of_stock",
            "available_quantity": product.get("availableQuantity", 0),
            "reserved_quantity": product.get("reservedQuantity", 0),
        },
    )

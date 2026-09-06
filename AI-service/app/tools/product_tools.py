import logging
from typing import Any

from app.clients.erp_client import erp_client
from app.search.semantic_search_service import semantic_search_service
from app.tools.schemas import GetProductArgs, SearchProductsArgs, ToolResult

logger = logging.getLogger(__name__)


async def search_products(
    args: SearchProductsArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Search products in ERP using multi-stage semantic entity resolution."""
    candidates_by_id: dict[str, dict[str, Any]] = {}

    # 1. Fetch the authoritative candidate pool from ERP. The ERP search is
    # intentionally the first call so identifiers are resolved without a
    # semantic pass. Search errors are surfaced; an empty result may use the
    # catalog list as a fuzzy-search fallback.
    searched = await erp_client.search_products(
        tenant_id=tenant_id,
        query=args.query,
        limit=args.limit,
    )
    for p in (searched or []):
        if p.get("id"):
            candidates_by_id[p["id"]] = p

    # If search_products returned no candidates and query might be fuzzy, try listing catalog
    if not candidates_by_id:
        try:
            listed = await erp_client.list_products(tenant_id=tenant_id, limit=100)
            for p in (listed or []):
                if p.get("id"):
                    candidates_by_id[p["id"]] = p
        except Exception as exc:
            logger.debug("[ProductTools] list_products error: %s", exc)

    candidates = list(candidates_by_id.values())

    # 2. Run multi-stage semantic resolution (exact -> normalized -> fuzzy -> vector)
    search_result = await semantic_search_service.resolve_entities(
        query=args.query,
        candidates=candidates,
        entity_type="product",
        limit=args.limit,
        exact_match_fields=["id", "sku"],
        text_fields=["name", "sku"],
        description_field="description",
    )

    # 3. Format structured matches and backwards-compatible products list
    matches_data = []
    normalized_products = []

    for m in search_result.matches:
        match_dict = {
            "id": m.id,
            "sku": m.sku,
            "name": m.name,
            "description": m.description,
            "availability": m.availability,
            "quantity": m.quantity,
            "similarity_score": m.similarity_score,
            "confidence": m.confidence,
            "match_strategy": m.match_strategy,
            "unit": m.metadata.get("unit", "unit"),
            "price": m.metadata.get("price", 0.0),
            "active": m.metadata.get("active", True),
        }
        matches_data.append(match_dict)
        normalized_products.append({
            "id": m.id,
            "sku": m.sku,
            "name": m.name,
            "description": m.description,
            "unit": m.metadata.get("unit", "unit"),
            "price": m.metadata.get("price", 0.0),
            "active": m.metadata.get("active", True),
            "availability_status": "available" if m.availability == "in_stock" else "out_of_stock",
            "available_quantity": m.quantity,
            "similarity_score": m.similarity_score,
            "confidence": m.confidence,
        })

    # 4. Check for similar in-stock alternative if top match is unavailable
    suggested_alternative = None
    if matches_data and matches_data[0]["availability"] == "out_of_stock":
        for alt in matches_data[1:]:
            if alt["availability"] == "in_stock" and alt["quantity"] > 0:
                suggested_alternative = {
                    "id": alt["id"],
                    "sku": alt["sku"],
                    "name": alt["name"],
                    "available_quantity": alt["quantity"],
                    "price": alt["price"],
                }
                break

    return ToolResult.ok(
        tool_name="search_products",
        data={
            "query": args.query,
            "count": len(matches_data),
            "confidence_level": search_result.confidence_level,
            "matches": matches_data,
            "products": normalized_products,
            "suggested_alternative": suggested_alternative,
            "resolution": {
                "resolved_entity_id": matches_data[0]["id"] if matches_data else None,
                "resolved_sku": matches_data[0]["sku"] if matches_data else None,
                "confidence": search_result.confidence_level,
                "ambiguous": search_result.confidence_level == "medium",
            },
        },
    )


async def get_product(
    args: GetProductArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Retrieve detailed product information by product ID or canonical identifier."""
    product = await erp_client.get_product(
        tenant_id=tenant_id,
        product_id=args.product_id,
    )
    quantity = product.get("availableQuantity", 0) or 0
    active = product.get("active", False)
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
            "availability_status": "available" if active and quantity > 0 else "out_of_stock",
            "available_quantity": quantity,
            "reserved_quantity": product.get("reservedQuantity", 0),
        },
    )

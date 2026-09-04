import logging
from typing import Any

from app.clients.erp_client import erp_client
from app.core.config import settings
from app.search.semantic_search_service import semantic_search_service
from app.tools.schemas import GetCustomerArgs, SearchCustomersArgs, ToolResult

logger = logging.getLogger(__name__)


async def search_customers(
    args: SearchCustomersArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Search customers in ERP using multi-stage semantic entity resolution."""
    candidates_by_id: dict[str, dict[str, Any]] = {}

    searched = await erp_client.search_customers(
        tenant_id=tenant_id,
        query=args.query,
        limit=args.limit,
    )
    for c in (searched or []):
        if c.get("id"):
            candidates_by_id[c["id"]] = c

    if not candidates_by_id:
        try:
            listed = await erp_client.list_customers(tenant_id=tenant_id, limit=100)
            for c in (listed or []):
                if c.get("id"):
                    candidates_by_id[c["id"]] = c
        except Exception as exc:
            logger.debug("[CustomerTools] list_customers error: %s", exc)

    candidates = list(candidates_by_id.values())

    search_result = await semantic_search_service.resolve_entities(
        query=args.query,
        candidates=candidates,
        entity_type="customer",
        limit=args.limit,
        exact_match_fields=["id", "phone", "externalId"],
        text_fields=["name", "phone", "externalId"],
        description_field=None,
    )

    matches_data = []
    for m in search_result.matches:
        matches_data.append({
            "id": m.id,
            "name": m.name,
            "phone": m.metadata.get("phone"),
            "external_id": m.metadata.get("externalId"),
            "similarity_score": m.similarity_score,
            "confidence": m.confidence,
            "match_strategy": m.match_strategy,
        })

    return ToolResult.ok(
        tool_name="search_customers",
        data={
            "query": args.query,
            "count": len(matches_data),
            "confidence_level": search_result.confidence_level,
            "matches": matches_data,
            "customers": matches_data,
            "resolution": {
                "resolved_entity_id": matches_data[0]["id"] if matches_data else None,
                "confidence": search_result.confidence_level,
                "ambiguous": search_result.confidence_level == "medium",
            },
        },
    )


async def get_customer(
    args: GetCustomerArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
) -> ToolResult:
    """Retrieve customer information by customer ID, phone number, or natural language name."""
    if not args.customer_id and not args.phone and not args.name:
        return ToolResult.fail(
            tool_name="get_customer",
            code="MISSING_CUSTOMER_IDENTIFIER",
            message="A customer ID, phone number, or name must be provided to get customer details.",
        )

    if args.customer_id:
        try:
            customer = await erp_client.get_customer(
                tenant_id=tenant_id,
                customer_id=args.customer_id,
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
        except Exception:
            # A model may place a human-readable customer reference in the
            # customer_id field. Resolve it through the shared search path.
            lookup_query = args.customer_id
        else:
            lookup_query = None
    else:
        lookup_query = None

    if args.phone:
        try:
            customer = await erp_client.get_customer_by_phone(
                tenant_id=tenant_id,
                phone=args.phone,
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
        except Exception:
            # Fall back to semantic resolution below if phone wasn't exact match
            pass

    # If name or fuzzy phone provided, use semantic search resolution
    lookup_query = lookup_query or args.name or args.phone
    if lookup_query:
        search_res = await search_customers(
            args=SearchCustomersArgs(query=lookup_query, limit=settings.SEMANTIC_SEARCH_TOP_K),
            tenant_id=tenant_id,
        )
        if search_res.success and search_res.data and search_res.data.get("matches"):
            top = search_res.data["matches"][0]
            if search_res.data.get("confidence_level") == "high" and top.get("confidence") == "high":
                return ToolResult.ok(
                    tool_name="get_customer",
                    data={
                        "id": top.get("id"),
                        "name": top.get("name"),
                        "phone": top.get("phone"),
                        "external_id": top.get("external_id"),
                        "confidence": top.get("confidence"),
                        "similarity_score": top.get("similarity_score"),
                    },
                )

    return ToolResult.fail(
        tool_name="get_customer",
        code="CUSTOMER_NOT_FOUND",
        message="Could not resolve customer by ID, phone, or name.",
    )

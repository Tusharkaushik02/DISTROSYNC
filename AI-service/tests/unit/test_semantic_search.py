import pytest
from unittest.mock import MagicMock

from app.core.config import settings
from app.search.schemas import SemanticSearchResult
from app.search.semantic_search_service import (
    SemanticSearchService,
    compute_fuzzy_score,
    normalize_text,
)


@pytest.fixture
def mock_products():
    return [
        {
            "id": "prod-1",
            "sku": "SHMP-BLU-001",
            "name": "Blue Shampoo",
            "description": "Revitalizing blue hair shampoo with ocean minerals for daily hair care",
            "active": True,
            "availableQuantity": 0,  # out of stock
            "price": 150.0,
            "unit": "bottle",
        },
        {
            "id": "prod-2",
            "sku": "SHMP-YEL-001",
            "name": "Yellow Shampoo",
            "description": "Nourishing yellow shampoo with chamomile and honey extract",
            "active": True,
            "availableQuantity": 25,  # in stock
            "price": 140.0,
            "unit": "bottle",
        },
        {
            "id": "prod-3",
            "sku": "SHMP-DND-001",
            "name": "Anti-Dandruff Shampoo",
            "description": "Medicated anti-dandruff shampoo with tea tree oil",
            "active": True,
            "availableQuantity": 10,  # in stock
            "price": 200.0,
            "unit": "bottle",
        },
        {
            "id": "prod-4",
            "sku": "DRNK-ENG-001",
            "name": "ABC123 Energy Drink",
            "description": "Caffeinated taurine energy drink in 250ml can",
            "active": True,
            "availableQuantity": 50,
            "price": 60.0,
            "unit": "can",
        },
    ]


@pytest.fixture
def mock_customers():
    return [
        {
            "id": "cust-1",
            "name": "John Doe Wholesale",
            "phone": "+919876543210",
            "externalId": "EXT-1001",
        },
        {
            "id": "cust-2",
            "name": "Acme Retail Stores",
            "phone": "+919123456780",
            "externalId": "EXT-1002",
        },
    ]


@pytest.fixture
def mock_orders():
    return [
        {
            "id": "ord-1",
            "status": "CONFIRMED",
            "totalAmount": 300.0,
            "customer": {"id": "cust-1", "name": "John Doe Wholesale"},
            "items": [
                {"productId": "prod-1", "sku": "SHMP-BLU-001", "productName": "Blue Shampoo", "quantity": 2}
            ],
            "createdAt": "2026-09-01T10:00:00Z",
        },
        {
            "id": "ord-2",
            "status": "DELIVERED",
            "totalAmount": 120.0,
            "customer": {"id": "cust-2", "name": "Acme Retail Stores"},
            "items": [
                {"productId": "prod-4", "sku": "DRNK-ENG-001", "productName": "ABC123 Energy Drink", "quantity": 2}
            ],
            "createdAt": "2026-08-25T14:00:00Z",
        },
    ]


class TestNormalizationAndFuzzy:
    def test_normalize_text(self):
        assert normalize_text("Blue Shampoo!") == "blue shampoo"
        assert normalize_text("  SHMP-BLU-001  ") == "shmp blu 001"
        assert normalize_text("") == ""

    def test_fuzzy_score_typos(self):
        # "blu shampoo" vs "Blue Shampoo"
        score_blu = compute_fuzzy_score("blu shampoo", "Blue Shampoo")
        assert score_blu >= 0.85

        # "shampu blue" vs "Blue Shampoo" (token reordering)
        score_reorder = compute_fuzzy_score("shampu blue", "Blue Shampoo")
        assert score_reorder >= 0.85

        # "blue shamppo" vs "Blue Shampoo"
        score_shamppo = compute_fuzzy_score("blue shamppo", "Blue Shampoo")
        assert score_shamppo >= 0.85

        # "bleu shampoo" vs "Blue Shampoo"
        score_bleu = compute_fuzzy_score("bleu shampoo", "Blue Shampoo")
        assert score_bleu >= 0.85


class TestSemanticSearchService:
    @pytest.mark.asyncio
    async def test_exact_sku_match(self, mock_products):
        service = SemanticSearchService()
        result: SemanticSearchResult = await service.resolve_entities(
            query="SHMP-BLU-001",
            candidates=mock_products,
            entity_type="product",
            limit=5,
            exact_match_fields=["id", "sku"],
            text_fields=["name", "sku"],
        )

        assert result.total_matches >= 1
        top = result.matches[0]
        assert top.sku == "SHMP-BLU-001"
        assert top.id == "prod-1"
        assert top.similarity_score == 1.0
        assert top.match_strategy == "exact_match"
        assert top.confidence == "high"
        assert result.confidence_level == "high"

    @pytest.mark.asyncio
    async def test_normalized_exact_match(self, mock_products):
        service = SemanticSearchService()
        result = await service.resolve_entities(
            query="blue shampoo",
            candidates=mock_products,
            entity_type="product",
            limit=5,
            exact_match_fields=["id", "sku"],
            text_fields=["name", "sku"],
        )

        assert result.total_matches >= 1
        top = result.matches[0]
        assert top.id == "prod-1"
        assert top.name == "Blue Shampoo"
        assert top.similarity_score == 0.98
        assert top.match_strategy == "normalized_exact"
        assert top.confidence == "high"

    @pytest.mark.asyncio
    async def test_fuzzy_match_typos(self, mock_products):
        service = SemanticSearchService()

        # Test various spelling mistakes
        typos = ["blu shampoo", "shampu blue", "blue shamppo", "bleu shampoo"]
        for typo in typos:
            result = await service.resolve_entities(
                query=typo,
                candidates=mock_products,
                entity_type="product",
                limit=5,
                exact_match_fields=["id", "sku"],
                text_fields=["name", "sku"],
            )
            assert result.total_matches >= 1, f"Failed for typo: {typo}"
            top = result.matches[0]
            assert top.id == "prod-1", f"Expected prod-1 for {typo}, got {top.id} ({top.name})"
            assert top.similarity_score >= 0.80
            assert top.confidence in ["high", "medium"]

    @pytest.mark.asyncio
    async def test_out_of_stock_and_similar_product_identification(self, mock_products):
        service = SemanticSearchService()
        result = await service.resolve_entities(
            query="blue shampoo",
            candidates=mock_products,
            entity_type="product",
            limit=5,
        )

        # Top match should be Blue Shampoo (out of stock)
        top = result.matches[0]
        assert top.id == "prod-1"
        assert top.availability == "out_of_stock"
        assert top.quantity == 0

        # An alternative candidate should exist in matches that is in stock
        alternatives = [m for m in result.matches[1:] if m.availability == "in_stock"]
        assert len(alternatives) > 0

    @pytest.mark.asyncio
    async def test_ambiguity_handling(self, mock_products):
        service = SemanticSearchService()
        result = await service.resolve_entities(
            query="shampoo",
            candidates=mock_products,
            entity_type="product",
            limit=5,
        )

        # Multiple shampoo products should be matched
        shampoo_matches = [m for m in result.matches if "shampoo" in m.name.lower()]
        assert len(shampoo_matches) >= 2
        # When multiple close matches exist, confidence level flags ambiguity
        assert result.confidence_level in ["medium", "high"]

    @pytest.mark.asyncio
    async def test_customer_semantic_search(self, mock_customers):
        service = SemanticSearchService()

        # Typo in customer name: "Jon Doe"
        res_typo = await service.resolve_entities(
            query="Jon Doe",
            candidates=mock_customers,
            entity_type="customer",
            exact_match_fields=["id", "phone", "externalId"],
            text_fields=["name", "phone", "externalId"],
        )
        assert res_typo.total_matches >= 1
        assert res_typo.matches[0].id == "cust-1"
        assert res_typo.matches[0].name == "John Doe Wholesale"

        # Exact phone lookup
        res_phone = await service.resolve_entities(
            query="+919876543210",
            candidates=mock_customers,
            entity_type="customer",
            exact_match_fields=["id", "phone", "externalId"],
            text_fields=["name", "phone", "externalId"],
        )
        assert res_phone.total_matches >= 1
        assert res_phone.matches[0].id == "cust-1"
        assert res_phone.matches[0].similarity_score == 1.0

    @pytest.mark.asyncio
    async def test_order_semantic_search(self, mock_orders):
        service = SemanticSearchService()
        # Enriched candidates
        prepared = []
        for o in mock_orders:
            cust_name = o["customer"]["name"]
            item_names = " ".join(item["productName"] for item in o["items"])
            prepared.append({
                **o,
                "name": f"Order {o['id']}",
                "search_text": f"{o['id']} {o['status']} {cust_name} {item_names}",
            })

        # Search by item name: "blue shampoo order"
        result = await service.resolve_entities(
            query="blue shampoo order",
            candidates=prepared,
            entity_type="order",
            exact_match_fields=["id"],
            text_fields=["search_text", "name"],
        )
        assert result.total_matches >= 1
        assert result.matches[0].id == "ord-1"

    @pytest.mark.asyncio
    async def test_low_confidence_when_no_match(self, mock_products):
        service = SemanticSearchService()
        result = await service.resolve_entities(
            query="complete gibberish nonexistent xyz999",
            candidates=mock_products,
            entity_type="product",
            limit=5,
        )
        assert result.total_matches == 0 or result.confidence_level in ["low", "none"]

    @pytest.mark.asyncio
    async def test_observability_logging(self, mock_products):
        service = SemanticSearchService()
        logged_entries = []

        service._log_resolution = lambda **kwargs: logged_entries.append(kwargs)

        await service.resolve_entities(
            query="blu shampoo",
            candidates=mock_products,
            entity_type="product",
        )

        assert len(logged_entries) == 1
        entry = logged_entries[0]
        assert entry["original_query"] == "blu shampoo"
        assert entry["entity_type"] == "product"
        assert entry["matched_id"] == "prod-1"
        assert entry["similarity_score"] > 0.8
        assert "confidence" in entry
        assert "strategy" in entry

"""Shared entity resolution for ERP-backed search tools.

The ERP owns the candidate records and their authoritative state. This module
only ranks records supplied by a tool; it never invents an entity or performs a
database lookup itself. The ranking pipeline is deterministic when a dense
embedding model is unavailable, while still allowing the existing embedding
service to be enabled.
"""

from collections import Counter
import difflib
import json
import logging
import re
import unicodedata
from typing import Any, Callable

from app.core.config import settings
from app.search.schemas import EntityMatch, ResolutionLogEntry, SemanticSearchResult

logger = logging.getLogger(__name__)


# These words describe the request rather than the entity. They are removed
# only for ranking; the original query is retained in results and logs.
QUERY_STOP_WORDS = frozenset(
    {
        "a", "about", "an", "and", "any", "are", "can", "could", "details",
        "do", "find", "for", "get", "have", "i", "in", "information", "is",
        "it", "me", "my", "of", "on", "one", "please", "product", "products",
        "purchase", "search", "show", "some", "stock", "tell", "that", "the",
        "there", "this", "to", "want", "we", "what", "where", "which", "would",
        "you", "buy", "need", "like", "looking", "order", "orders", "item", "items",
        "know", "sku", "id", "identifier", "number", "code", "don", "dont", "not",
    }
)


def normalize_text(text: str) -> str:
    """Return a case/punctuation/whitespace-normalized representation."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", str(text)).casefold()
    cleaned = re.sub(r"[^\w\s]", " ", normalized, flags=re.UNICODE)
    return " ".join(cleaned.split())


def _query_text_for_matching(query: str) -> str:
    normalized = normalize_text(query)
    meaningful_tokens = [
        token for token in normalized.split()
        if len(token) > 1 and token not in QUERY_STOP_WORDS
    ]
    return " ".join(meaningful_tokens) or normalized


def _token_sort_ratio(query: str, target: str) -> float:
    return difflib.SequenceMatcher(
        None,
        " ".join(sorted(query.split())),
        " ".join(sorted(target.split())),
    ).ratio()


def compute_fuzzy_score(query: str, target: str) -> float:
    """Compute a typo/order-tolerant score in the range ``0..1``."""
    norm_q = _query_text_for_matching(query)
    norm_t = normalize_text(target)

    if not norm_q or not norm_t:
        return 0.0
    if norm_q == norm_t:
        return 1.0

    direct_ratio = difflib.SequenceMatcher(None, norm_q, norm_t).ratio()
    token_sort_ratio = _token_sort_ratio(norm_q, norm_t)

    q_tokens = norm_q.split()
    t_tokens = norm_t.split()
    token_scores = [
        max((difflib.SequenceMatcher(None, qt, tt).ratio() for tt in t_tokens), default=0.0)
        for qt in q_tokens
    ]
    token_avg = sum(token_scores) / len(token_scores) if token_scores else 0.0
    exact_token_coverage = sum(token in t_tokens for token in q_tokens) / max(len(q_tokens), 1)

    containment_bonus = 0.0
    if norm_q in norm_t:
        containment_bonus = 0.15
    elif any(len(token) > 2 and token in norm_t for token in q_tokens):
        containment_bonus = 0.08

    score = max(
        direct_ratio,
        token_sort_ratio,
        token_avg * 0.9,
        exact_token_coverage * 0.82,
    ) + containment_bonus
    return min(1.0, round(score, 4))


def _vectorize_text(text: str) -> Counter[str]:
    """Build a small local character/token vector for semantic fallback."""
    value = f" {_query_text_for_matching(text)} "
    grams = [value[index : index + 3] for index in range(max(0, len(value) - 2))]
    grams.extend(value.split())
    return Counter(grams)


def _counter_cosine(left: Counter[str], right: Counter[str]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(value * right.get(key, 0) for key, value in left.items())
    left_norm = sum(value * value for value in left.values()) ** 0.5
    right_norm = sum(value * value for value in right.values()) ** 0.5
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def compute_semantic_vector_score(query: str, target: str) -> float:
    """Compute local vector similarity when dense embeddings are unavailable."""
    return round(max(0.0, min(1.0, _counter_cosine(_vectorize_text(query), _vectorize_text(target)))), 4)


def compute_cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity for normalized dense vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    return max(0.0, min(1.0, round(dot_product, 4)))


class SemanticSearchService:
    """Reusable exact, normalized, fuzzy, and vector entity resolver."""

    def __init__(self, embedding_service_getter: Callable[[], Any] | None = None):
        # A getter is an explicit dependency-injection hook. The default dense
        # model path is opt-in because model startup is expensive; local vector
        # fallback remains available for every request.
        self._embedding_service_getter = embedding_service_getter
        self._embedding_service = None
        self._embedding_attempted = False

    def _get_embedding_service(self):
        if self._embedding_attempted:
            return self._embedding_service
        self._embedding_attempted = True

        if self._embedding_service_getter is None and not settings.SEMANTIC_SEARCH_ENABLE_EMBEDDINGS:
            return None

        try:
            if self._embedding_service_getter is not None:
                self._embedding_service = self._embedding_service_getter()
            else:
                from app.intelligence.embeddings.embedding_service import EmbeddingService

                self._embedding_service = EmbeddingService()
        except Exception as exc:
            logger.warning("[SemanticSearch] Dense embedding service unavailable: %s", exc)
            self._embedding_service = None
        return self._embedding_service

    @staticmethod
    def _as_quantity(value: Any) -> int:
        try:
            return max(0, int(value or 0))
        except (TypeError, ValueError):
            return 0

    def _evaluate_availability(
        self,
        entity: dict[str, Any],
        custom_evaluator: Callable[[dict[str, Any]], tuple[str, int]] | None = None,
    ) -> tuple[str, int]:
        """Read availability only from fields supplied by the ERP."""
        if custom_evaluator is not None:
            return custom_evaluator(entity)

        inventory = entity.get("inventory") or {}
        has_quantity = any(
            key in entity or key in inventory
            for key in ("availableQuantity", "available_quantity", "quantity")
        )
        has_inventory_state = bool(inventory) or "active" in entity or "availability" in entity
        quantity_value = entity.get("availableQuantity")
        if quantity_value is None:
            quantity_value = entity.get("available_quantity")
        if quantity_value is None:
            quantity_value = entity.get("quantity")
        if quantity_value is None:
            quantity_value = inventory.get("availableQuantity", inventory.get("available_quantity", 0))
        quantity = self._as_quantity(quantity_value)

        explicit_status = str(
            entity.get("availability", entity.get("availability_status", ""))
        ).casefold()
        if explicit_status in {"in_stock", "available", "in stock"}:
            return "in_stock", quantity
        if explicit_status in {"out_of_stock", "unavailable", "out of stock"}:
            return "out_of_stock", quantity
        if not has_quantity and not has_inventory_state:
            return "unknown", 0
        if entity.get("active", True) is False or quantity <= 0:
            return "out_of_stock", quantity
        return "in_stock", quantity

    def _build_match(
        self,
        candidate: dict[str, Any],
        score: float,
        strategy: str,
        description_field: str | None,
        availability_evaluator: Callable[[dict[str, Any]], tuple[str, int]] | None,
    ) -> EntityMatch:
        availability, quantity = self._evaluate_availability(candidate, availability_evaluator)
        high_threshold = settings.SEMANTIC_SEARCH_HIGH_THRESHOLD
        medium_threshold = settings.SEMANTIC_SEARCH_MEDIUM_THRESHOLD
        confidence = "high" if score >= high_threshold else "medium" if score >= medium_threshold else "low"
        excluded = {"id", "sku", "name", "title"}
        if description_field:
            excluded.add(description_field)
        return EntityMatch(
            id=str(candidate.get("id", "")),
            sku=candidate.get("sku"),
            name=candidate.get("name") or candidate.get("title") or str(candidate.get("id", "")),
            description=candidate.get(description_field) if description_field else None,
            availability=availability,
            quantity=quantity,
            similarity_score=round(max(0.0, min(1.0, score)), 4),
            confidence=confidence,
            match_strategy=strategy,
            metadata={key: value for key, value in candidate.items() if key not in excluded},
        )

    async def resolve_entities(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        entity_type: str,
        limit: int = 5,
        exact_match_fields: list[str] | None = None,
        text_fields: list[str] | None = None,
        description_field: str | None = "description",
        availability_evaluator: Callable[[dict[str, Any]], tuple[str, int]] | None = None,
    ) -> SemanticSearchResult:
        """Resolve a query against ERP candidates using one shared pipeline."""
        clean_query = (query or "").strip()
        normalized_query = normalize_text(clean_query)
        matching_query = _query_text_for_matching(clean_query)
        normalized_matching_query = normalize_text(matching_query)
        exact_fields = exact_match_fields or ["id", "sku", "phone", "externalId"]
        text_flds = text_fields or ["name", "sku", "title"]
        max_results = max(1, limit)

        if not clean_query or not candidates:
            self._log_resolution(
                original_query=clean_query,
                normalized_query=normalized_query,
                entity_type=entity_type,
                matched_id=None,
                matched_sku=None,
                similarity_score=0.0,
                strategy="none",
                confidence="none",
                alternatives=[],
                final_resolution="no_candidates_or_empty_query",
            )
            return SemanticSearchResult(
                query=clean_query,
                entity_type=entity_type,
                total_matches=0,
                confidence_level="none",
                matches=[],
            )

        def candidate_id(candidate: dict[str, Any]) -> str:
            return str(candidate.get("id", ""))

        # Stage 1: canonical ID/SKU and other configured identifiers. An exact
        # identifier is authoritative and short-circuits fuzzy/vector retrieval.
        exact_matches: list[dict[str, Any]] = []
        exact_ids: set[str] = set()
        for candidate in candidates:
            for field in exact_fields:
                value = candidate.get(field)
                if value is not None and str(value).strip().casefold() == clean_query.casefold():
                    if candidate_id(candidate) not in exact_ids:
                        exact_matches.append(candidate)
                        exact_ids.add(candidate_id(candidate))
                    break

        if exact_matches:
            matches = [
                self._build_match(candidate, 1.0, "exact_match", description_field, availability_evaluator)
                for candidate in exact_matches[:max_results]
            ]
            self._log_resolution(
                original_query=clean_query,
                normalized_query=normalized_query,
                entity_type=entity_type,
                matched_id=matches[0].id,
                matched_sku=matches[0].sku,
                similarity_score=1.0,
                strategy="exact_match",
                confidence="high",
                alternatives=[match.model_dump() for match in matches[1:]],
                final_resolution="resolved_exact_identifier",
            )
            return SemanticSearchResult(
                query=clean_query,
                entity_type=entity_type,
                total_matches=len(matches),
                confidence_level="high",
                matches=matches,
            )

        # Stage 2: normalized exact text. Keep those records in the ranked pool
        # so an unavailable exact name can still expose a suggested alternative.
        ranked_items: list[tuple[dict[str, Any], float, str]] = []
        seen_ids: set[str] = set()
        for candidate in candidates:
            for field in text_flds:
                value = candidate.get(field)
                if value and normalize_text(str(value)) == normalized_matching_query:
                    ranked_items.append((candidate, 0.98, "normalized_exact"))
                    seen_ids.add(candidate_id(candidate))
                    break

        # Stage 3: fuzzy matching plus local vector similarity for remaining
        # records. The optional dense model augments this fallback when enabled.
        scored_remaining: list[dict[str, Any]] = []
        for candidate in candidates:
            if candidate_id(candidate) in seen_ids:
                continue
            primary_text = " ".join(
                str(candidate.get(field, "")) for field in text_flds if candidate.get(field)
            ).strip()
            field_texts = [str(candidate.get(field, "")) for field in text_flds if candidate.get(field)]
            description = (
                str(candidate.get(description_field, ""))
                if description_field and candidate.get(description_field)
                else ""
            )
            full_text = f"{primary_text} {description}".strip()
            # Score each searchable field independently so a long SKU does not
            # dilute a strong name match (or a customer name match).
            fuzzy_score = max(
                (compute_fuzzy_score(clean_query, field_text) for field_text in field_texts),
                default=compute_fuzzy_score(clean_query, primary_text or full_text),
            )
            local_vector_score = compute_semantic_vector_score(clean_query, full_text or primary_text)
            final_score = (
                fuzzy_score
                if fuzzy_score >= settings.SEMANTIC_SEARCH_HIGH_THRESHOLD
                else round(0.65 * fuzzy_score + 0.35 * local_vector_score, 4)
            )
            scored_remaining.append(
                {
                    "candidate": candidate,
                    "primary_text": primary_text,
                    "full_text": full_text,
                    "fuzzy_score": fuzzy_score,
                    "semantic_score": local_vector_score,
                    "final_score": final_score,
                    "strategy": "fuzzy_match" if fuzzy_score >= settings.SEMANTIC_SEARCH_HIGH_THRESHOLD else "hybrid_match",
                }
            )

        embedding_service = self._get_embedding_service()
        if embedding_service is not None and scored_remaining:
            try:
                all_texts = [clean_query] + [
                    item["full_text"] or item["primary_text"] for item in scored_remaining
                ]
                embeddings = embedding_service.embed(all_texts)
                query_embedding = embeddings[0]
                for index, item in enumerate(scored_remaining):
                    dense_score = compute_cosine_similarity(query_embedding, embeddings[index + 1])
                    prior_score = item["semantic_score"]
                    item["semantic_score"] = max(prior_score, dense_score)
                    fuzzy_score = item["fuzzy_score"]
                    if fuzzy_score >= settings.SEMANTIC_SEARCH_HIGH_THRESHOLD:
                        item["final_score"] = fuzzy_score
                        item["strategy"] = "fuzzy_match"
                    elif dense_score > prior_score:
                        item["final_score"] = round(0.3 * fuzzy_score + 0.7 * dense_score, 4)
                        item["strategy"] = "semantic_vector"
                    else:
                        item["final_score"] = round(0.45 * fuzzy_score + 0.55 * item["semantic_score"], 4)
                        item["strategy"] = "hybrid_match"
            except Exception as exc:
                logger.warning("[SemanticSearch] Dense embedding calculation failed: %s", exc)

        scored_remaining.sort(
            key=lambda item: (
                -item["final_score"],
                str(item["candidate"].get("name", "")).casefold(),
                candidate_id(item["candidate"]),
            )
        )
        minimum_score = settings.SEMANTIC_SEARCH_MIN_SCORE
        for item in scored_remaining:
            if item["final_score"] >= minimum_score:
                ranked_items.append((item["candidate"], item["final_score"], item["strategy"]))

        matches = [
            self._build_match(candidate, score, strategy, description_field, availability_evaluator)
            for candidate, score, strategy in ranked_items[:max_results]
        ]

        if not matches:
            overall_confidence = "none"
        elif matches[0].similarity_score < settings.SEMANTIC_SEARCH_MEDIUM_THRESHOLD:
            overall_confidence = "low"
        elif (
            len(matches) > 1
            and matches[1].similarity_score >= settings.SEMANTIC_SEARCH_MEDIUM_THRESHOLD
            and matches[0].similarity_score - matches[1].similarity_score <= settings.SEMANTIC_SEARCH_AMBIGUITY_GAP
        ):
            overall_confidence = "medium"
        else:
            overall_confidence = matches[0].confidence

        top_match = matches[0] if matches else None
        self._log_resolution(
            original_query=clean_query,
            normalized_query=normalized_query,
            entity_type=entity_type,
            matched_id=top_match.id if top_match else None,
            matched_sku=top_match.sku if top_match else None,
            similarity_score=top_match.similarity_score if top_match else 0.0,
            strategy=top_match.match_strategy if top_match else "none",
            confidence=overall_confidence,
            alternatives=[match.model_dump() for match in matches[1:]],
            final_resolution=f"resolved_{len(matches)}_candidates" if matches else "no_reliable_match",
        )
        return SemanticSearchResult(
            query=clean_query,
            entity_type=entity_type,
            total_matches=len(matches),
            confidence_level=overall_confidence,
            matches=matches,
        )

    def _log_resolution(
        self,
        original_query: str,
        normalized_query: str,
        entity_type: str,
        matched_id: str | None,
        matched_sku: str | None,
        similarity_score: float,
        strategy: str,
        confidence: str,
        alternatives: list[dict[str, Any]],
        final_resolution: str,
    ) -> None:
        entry = ResolutionLogEntry(
            original_query=original_query,
            normalized_query=normalized_query,
            entity_type=entity_type,
            matched_entity_id=matched_id,
            matched_sku=matched_sku,
            similarity_score=similarity_score,
            search_strategy_used=strategy,
            confidence_level=confidence,
            alternative_candidates=alternatives,
            final_resolution=final_resolution,
        )
        logger.info("[SemanticResolution] %s", json.dumps(entry.model_dump(), default=str))


semantic_search_service = SemanticSearchService()

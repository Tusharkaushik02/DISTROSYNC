from typing import Any, Literal
from pydantic import BaseModel, Field


class EntityMatch(BaseModel):
    """Structured representation of an entity matching a search query."""

    id: str
    name: str
    sku: str | None = None
    description: str | None = None
    availability: Literal["in_stock", "out_of_stock", "unknown"] = "unknown"
    quantity: int = 0
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    confidence: Literal["high", "medium", "low"] = "low"
    match_strategy: str = "semantic_vector"
    metadata: dict[str, Any] = Field(default_factory=dict)


class SemanticSearchResult(BaseModel):
    """Authoritative result returned by the semantic search layer."""

    query: str
    entity_type: str
    total_matches: int
    confidence_level: Literal["high", "medium", "low", "none"] = "none"
    matches: list[EntityMatch] = Field(default_factory=list)


class ResolutionLogEntry(BaseModel):
    """Observability log schema for semantic entity resolution."""

    original_query: str
    normalized_query: str
    entity_type: str
    matched_entity_id: str | None = None
    matched_sku: str | None = None
    similarity_score: float = 0.0
    search_strategy_used: str = "none"
    confidence_level: str = "none"
    alternative_candidates: list[dict[str, Any]] = Field(default_factory=list)
    final_resolution: str = "unresolved"

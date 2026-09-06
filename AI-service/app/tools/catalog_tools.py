import logging
from typing import Any

from app.tools.schemas import SearchKnowledgeBaseArgs, ToolResult

logger = logging.getLogger(__name__)

_embedding_service = None
_vector_store = None


def get_embedding_service():
    global _embedding_service
    if _embedding_service is None:
        from app.intelligence.embeddings.embedding_service import EmbeddingService
        _embedding_service = EmbeddingService()
    return _embedding_service


def get_vector_store():
    global _vector_store
    if _vector_store is None:
        from app.rag.vector_store import VectorStore
        _vector_store = VectorStore()
    return _vector_store


async def search_knowledge_base(
    args: SearchKnowledgeBaseArgs,
    tenant_id: str,
    idempotency_key: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    """Search company knowledge base, policies, FAQs, catalogs, and documents using hybrid retrieval."""
    clean_query = (args.query or "").strip()
    if not clean_query:
        return ToolResult.fail(
            tool_name="search_knowledge_base",
            code="EMPTY_QUERY",
            message="Search query cannot be empty.",
        )

    logger.info("[RAG] Tool called query='%s' top_k=%d tenant=%s", clean_query, args.top_k, tenant_id)
    print(f"[RAG] Tool called: query='{clean_query}', top_k={args.top_k}")

    try:
        embedder = get_embedding_service()
        store = get_vector_store()

        query_embedding = embedder.embed([clean_query])[0]
        results = store.hybrid_search(
            query=clean_query,
            query_embedding=query_embedding,
            top_k=args.top_k,
        )

        if not results:
            logger.info("[RAG] No results found for query='%s'", clean_query)
            print("[RAG] Retrieved 0 results")
            return ToolResult.ok(
                tool_name="search_knowledge_base",
                data={
                    "found": False,
                    "query": clean_query,
                    "results": [],
                    "message": "No relevant information was found in the knowledge base.",
                },
            )

        formatted_results = []
        for r in results:
            formatted_results.append({
                "content": r.get("text", ""),
                "score": r.get("score", 0.0),
                "source": r.get("filename", "unknown"),
                "page": r.get("page_number", 0),
                "chunk_index": r.get("chunk_index", 0),
                "document_id": r.get("document_id", ""),
            })

        best_score = formatted_results[0]["score"] if formatted_results else 0.0
        logger.info("[RAG] Retrieved %d results, best_score=%.4f", len(formatted_results), best_score)
        print(f"[RAG] Retrieved {len(formatted_results)} results | Best score: {best_score}")

        return ToolResult.ok(
            tool_name="search_knowledge_base",
            data={
                "found": True,
                "query": clean_query,
                "count": len(formatted_results),
                "results": formatted_results,
            },
        )

    except Exception as exc:
        logger.error("[RAG] Error executing knowledge base search: %s", exc, exc_info=True)
        print(f"[RAG] Error searching knowledge base: {exc}")
        return ToolResult.fail(
            tool_name="search_knowledge_base",
            code="KNOWLEDGE_BASE_ERROR",
            message="Unable to search company knowledge base at this time.",
        )

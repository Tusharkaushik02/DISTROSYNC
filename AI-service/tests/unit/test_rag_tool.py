import pytest
from unittest.mock import MagicMock, patch

from app.tools import tool_registry
from app.tools.catalog_tools import search_knowledge_base
from app.tools.schemas import SearchKnowledgeBaseArgs


@pytest.mark.asyncio
async def test_search_knowledge_base_empty_query():
    result = await search_knowledge_base(
        args=SearchKnowledgeBaseArgs(query="   "),
        tenant_id="tenant-123",
    )
    assert result.success is False
    assert result.error.code == "EMPTY_QUERY"
    assert "cannot be empty" in result.error.message


@pytest.mark.asyncio
async def test_search_knowledge_base_success():
    mock_results = [
        {
            "text": "Distributors get a 15% discount on orders above 100 units.",
            "score": 0.89,
            "filename": "distributor_policy.pdf",
            "page_number": 3,
            "chunk_index": 12,
            "document_id": "doc-abc-123",
        },
        {
            "text": "Returns are accepted within 7 days of delivery for damaged goods.",
            "score": 0.75,
            "filename": "return_policy.pdf",
            "page_number": 1,
            "chunk_index": 2,
            "document_id": "doc-xyz-456",
        },
    ]

    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 384]

    mock_store = MagicMock()
    mock_store.hybrid_search.return_value = mock_results

    with patch("app.tools.catalog_tools.get_embedding_service", return_value=mock_embedder), \
         patch("app.tools.catalog_tools.get_vector_store", return_value=mock_store):

        result = await search_knowledge_base(
            args=SearchKnowledgeBaseArgs(query="What is the discount for distributors?", top_k=3),
            tenant_id="tenant-123",
        )

        assert result.success is True
        assert result.data["found"] is True
        assert result.data["count"] == 2
        assert len(result.data["results"]) == 2
        first = result.data["results"][0]
        assert first["content"] == "Distributors get a 15% discount on orders above 100 units."
        assert first["score"] == 0.89
        assert first["source"] == "distributor_policy.pdf"
        assert first["page"] == 3
        assert first["chunk_index"] == 12
        assert first["document_id"] == "doc-abc-123"

        mock_store.hybrid_search.assert_called_once_with(
            query="What is the discount for distributors?",
            query_embedding=[0.1] * 384,
            top_k=3,
        )


@pytest.mark.asyncio
async def test_search_knowledge_base_no_results():
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [[0.1] * 384]

    mock_store = MagicMock()
    mock_store.hybrid_search.return_value = []

    with patch("app.tools.catalog_tools.get_embedding_service", return_value=mock_embedder), \
         patch("app.tools.catalog_tools.get_vector_store", return_value=mock_store):

        result = await search_knowledge_base(
            args=SearchKnowledgeBaseArgs(query="quantum mechanics formula", top_k=5),
            tenant_id="tenant-123",
        )

        assert result.success is True
        assert result.data["found"] is False
        assert result.data["results"] == []
        assert "No relevant information was found" in result.data["message"]


@pytest.mark.asyncio
async def test_search_knowledge_base_handles_exception():
    mock_embedder = MagicMock()
    mock_embedder.embed.side_effect = RuntimeError("Vector DB connection failed")

    with patch("app.tools.catalog_tools.get_embedding_service", return_value=mock_embedder):
        result = await search_knowledge_base(
            args=SearchKnowledgeBaseArgs(query="Any policy"),
            tenant_id="tenant-123",
        )

        assert result.success is False
        assert result.error.code == "KNOWLEDGE_BASE_ERROR"
        assert "Unable to search company knowledge base" in result.error.message


def test_search_knowledge_base_in_llm_tool_registry():
    tools = tool_registry.get_tools_for_llm()
    rag_tool = next((t for t in tools if t["function"]["name"] == "search_knowledge_base"), None)

    assert rag_tool is not None
    func = rag_tool["function"]
    assert "query" in func["parameters"]["properties"]
    assert "query" in func["parameters"]["required"]
    assert "top_k" in func["parameters"]["properties"]
    assert func["parameters"]["properties"]["top_k"].get("default") == 3

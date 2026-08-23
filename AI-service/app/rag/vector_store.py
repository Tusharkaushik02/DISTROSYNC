import uuid
from qdrant_client import QdrantClient
from qdrant_client.http import models
from rank_bm25 import BM25Okapi
from app.core.config import settings


class VectorStore:
    def __init__(self):
        self.collection_name = "documents"

        # Initialize local persistent Qdrant or remote Qdrant client
        if settings.QDRANT_URL:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
            )
        else:
            self.client = QdrantClient(path=settings.QDRANT_PATH)

        self._ensure_collection()
        self._rebuild_bm25()

    def _ensure_collection(self, vector_dim: int = 384):
        """Ensure the collection exists in Qdrant with Cosine distance."""
        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]

        if self.collection_name not in collection_names:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=vector_dim,
                    distance=models.Distance.COSINE,
                ),
            )

    # ── BM25 index management ─────────────────────────────────────────

    def _rebuild_bm25(self):
        """Rebuild in-memory BM25 index from all documents stored in Qdrant."""
        try:
            records, _ = self.client.scroll(
                collection_name=self.collection_name,
                limit=10000,
                with_payload=True,
                with_vectors=False,
            )
            self._bm25_ids = [str(r.id) for r in records]
            self._bm25_docs = [r.payload.get("text", "") for r in records]
            self._bm25_metas = [r.payload for r in records]
        except Exception:
            self._bm25_ids = []
            self._bm25_docs = []
            self._bm25_metas = []

        if self._bm25_docs:
            tokenized = [doc.lower().split() for doc in self._bm25_docs]
            self._bm25_index: BM25Okapi | None = BM25Okapi(tokenized)
        else:
            self._bm25_index = None

    # ── Storage ───────────────────────────────────────────────────────

    def add(self, chunks: list[dict], embeddings: list[list[float]]):
        """Store chunks with their embeddings and metadata in Qdrant using Cosine metric,
        then rebuild the BM25 index."""
        if not chunks or not embeddings:
            return

        vector_dim = len(embeddings[0])
        self._ensure_collection(vector_dim)

        points = []
        for c, emb in zip(chunks, embeddings):
            doc_id = c["metadata"].get("document_id", str(uuid.uuid4()))
            chunk_idx = c["metadata"].get("chunk_index", 0)
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}_{chunk_idx}"))

            payload = {
                "text": c["text"],
                **c["metadata"],
            }

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=emb,
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )
        self._rebuild_bm25()

    # ── Hybrid retrieval ──────────────────────────────────────────────

    def hybrid_search(
        self,
        query: str,
        query_embedding: list[float],
        top_k: int | None = None,
    ) -> list[dict]:
        """Combine dense (Qdrant Cosine similarity) and sparse (BM25) retrieval,
        merge scores with configurable weights, and return the top-k results."""
        top_k = top_k or settings.TOP_K

        if not self._bm25_ids:
            return []

        # ── Dense retrieval (Qdrant with Cosine distance) ─────────────
        n_dense = min(len(self._bm25_ids), top_k * 3)
        query_response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            limit=n_dense,
            with_payload=True,
        )

        dense_scores: dict[str, dict] = {}
        for hit in query_response.points:
            # Qdrant cosine distance score is cosine similarity (higher is better)
            dense_scores[str(hit.id)] = {
                "score": max(0.0, float(hit.score)),
                "text": hit.payload.get("text", "") if hit.payload else "",
                "metadata": hit.payload or {},
            }

        # ── Sparse retrieval (BM25) ───────────────────────────────────
        sparse_scores: dict[str, float] = {}
        if self._bm25_index is not None:
            tokenized_query = query.lower().split()
            bm25_raw_scores = self._bm25_index.get_scores(tokenized_query)
            max_bm25 = (
                float(max(bm25_raw_scores))
                if len(bm25_raw_scores) > 0 and max(bm25_raw_scores) > 0
                else 1.0
            )
            for i, doc_id in enumerate(self._bm25_ids):
                sparse_scores[doc_id] = float(bm25_raw_scores[i]) / max_bm25

        # ── Merge and rank ────────────────────────────────────────────
        all_ids = set(dense_scores.keys()) | set(sparse_scores.keys())
        combined: list[dict] = []

        for doc_id in all_ids:
            d_score = dense_scores.get(doc_id, {}).get("score", 0.0)
            s_score = sparse_scores.get(doc_id, 0.0)
            hybrid = settings.DENSE_WEIGHT * d_score + settings.SPARSE_WEIGHT * s_score

            if doc_id in dense_scores:
                text = dense_scores[doc_id]["text"]
                meta = dense_scores[doc_id]["metadata"]
            else:
                idx = self._bm25_ids.index(doc_id)
                text = self._bm25_docs[idx]
                meta = self._bm25_metas[idx]

            combined.append(
                {
                    "text": text,
                    "score": round(hybrid, 4),
                    "document_id": meta.get("document_id", ""),
                    "filename": meta.get("filename", ""),
                    "page_number": meta.get("page_number", 0),
                    "chunk_index": meta.get("chunk_index", 0),
                }
            )

        combined.sort(key=lambda x: x["score"], reverse=True)
        return combined[:top_k]

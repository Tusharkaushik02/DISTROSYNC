---
id: rag-hybrid-search
title: "Hybrid RAG Pipeline: Qdrant Dense + BM25 Sparse Search"
category: concept
status: active
tags: [ai, rag, search, vector]
created: "2026-09-09T19:45:38"
updated: "2026-09-09T19:46:10"
---

<!-- compiled_truth -->
The RAG (Retrieval-Augmented Generation) pipeline allows the AI to answer questions from uploaded business documents (product catalogs, price lists, policy documents) without hallucinating.

**Ingestion flow:**
1. ERP-service receives PDF upload via `POST /api/v1/documents/upload`, extracts text with `pdf-parse`, stores metadata in PostgreSQL (`Document` table with status `UPLOADED ??? PROCESSING ??? INGESTED`)
2. ERP-service POSTs extracted text to AI-service `POST /api/v1/rag/ingest` with `{ text, documentId, tenantId, fileName, metadata }`
3. AI-service chunks the text (configurable `CHUNK_SIZE` / `CHUNK_OVERLAP` via settings), embeds each chunk using `BAAI/bge-small-en-v1.5` (SentenceTransformers), and stores vectors in Qdrant local store

**Search (hybrid retrieval):**
- **Dense search** (semantic): Qdrant cosine similarity on embeddings (weight: 0.7)
- **Sparse search** (lexical): BM25 Okapi implemented in Python, scores against raw chunk text (weight: 0.3)
- Results merged and re-ranked by weighted sum score
- Exposed as `POST /api/v1/rag/search` (standalone) and as `search_knowledge_base` LLM tool (wired into ConversationOrchestrator)

**LLM tool integration (completed in M4):**
- `search_knowledge_base(query: str, top_k: int)` is registered in the tool registry
- The LLM can autonomously invoke this tool during a conversation turn when it needs document-grounded answers
- Returns ranked text chunks that are fed back to the LLM as tool results

**Embedding model choice:**
- `BAAI/bge-small-en-v1.5` ??? small (130MB), fast, good English performance, runs locally (no external API cost)
- Configured via `EMBEDDING_MODEL` env var to allow future swap

**Known gaps:**
- No tenant isolation in Qdrant yet ??? all documents share the same collection (multi-tenant gap)
- No chunk deduplication ??? re-ingesting the same document creates duplicate vectors
- No multi-file batch ingestion endpoint
- Dense/sparse weights (0.7/0.3) are hardcoded ??? not tuned per document category


## Timeline

- time: 2026-09-09T19:45:38
  kind: decision
  summary: "Created this page: Hybrid RAG Pipeline: Qdrant Dense + BM25 Sparse Search"
  source: "DISTROSYNC_PROJECT_STATUS.md Part-9; AI-service/app/rag/vector_store.py"
  affects: [rag-hybrid-search]

- time: 2026-09-09T19:46:10
  kind: decision
  summary: "Seeded concept: ingestion flow, hybrid search weights, LLM tool wiring, known gaps"
  source: "DISTROSYNC_PROJECT_STATUS.md Part-9; AI-service/app/rag/vector_store.py; AI-service/app/main.py"
  affects: [rag-hybrid-search]

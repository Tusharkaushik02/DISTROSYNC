import io
import uuid

import pypdf
from fastapi import FastAPI, File, HTTPException, UploadFile

from app.api.routes.health import router as health_router
from app.api.schemas.request import IngestRequest, SearchRequest
from app.api.schemas.response import SearchResponse, UploadResponse
from app.core.config import settings
from app.intelligence.embeddings.embedding_service import EmbeddingService
from app.rag.vector_store import VectorStore

app = FastAPI(title="DistroSync AI Service", version="0.1.0")

app.include_router(health_router)

embedding_service = EmbeddingService()
vector_store = VectorStore()


# user message

@app.post("/api/v1/conversation", response_model=dict)
async def generate_conversation_response(request: dict):
    """Generate a response to a user message using the LLM."""
    message = request.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    print("[AI] Received message")
    try:
        from app.orchestration.conversation_orchestrator import conversation_orchestrator

        response = await conversation_orchestrator.generate_response(message)
        return {"response": response}
    except Exception as exc:
        print(f"[AI] Unexpected conversation error: {exc.__class__.__name__}")
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_SERVER_ERROR", "message": "An internal AI error occurred."},
        ) from exc
# ── PDF Upload & Ingestion ────────────────────────────────────────────


@app.post("/api/v1/rag/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Accept a PDF, extract text, chunk, embed, and store in ChromaDB."""

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()

    # ── Text extraction ───────────────────────────────────────────────
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read PDF file.")

    pages: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"page_number": i + 1, "text": text})

    if not pages:
        raise HTTPException(
            status_code=400, detail="No extractable text found in the PDF."
        )

    document_id = str(uuid.uuid4())

    # ── Chunking ──────────────────────────────────────────────────────
    chunks: list[dict] = []
    chunk_index = 0
    step = max(settings.CHUNK_SIZE - settings.CHUNK_OVERLAP, 1)

    for page_info in pages:
        clean_text = " ".join(page_info["text"].split())
        start = 0
        while start < len(clean_text):
            chunk_text = clean_text[start : start + settings.CHUNK_SIZE]
            if chunk_text.strip():
                chunks.append(
                    {
                        "text": chunk_text,
                        "metadata": {
                            "document_id": document_id,
                            "filename": file.filename,
                            "page_number": page_info["page_number"],
                            "chunk_index": chunk_index,
                        },
                    }
                )
                chunk_index += 1
            start += step

    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks generated.")

    # ── Embedding ─────────────────────────────────────────────────────
    texts = [c["text"] for c in chunks]
    embeddings = embedding_service.embed(texts)

    # ── Store ─────────────────────────────────────────────────────────
    vector_store.add(chunks, embeddings)

    return UploadResponse(
        success=True,
        filename=file.filename,
        document_id=document_id,
        chunks=len(chunks),
    )


# ── Hybrid Search ─────────────────────────────────────────────────────


@app.post("/api/v1/rag/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Run hybrid dense + BM25 retrieval and return ranked results."""
    query_embedding = embedding_service.embed([request.query])[0]

    results = vector_store.hybrid_search(
        query=request.query,
        query_embedding=query_embedding,
        top_k=request.top_k,
    )

    return SearchResponse(
        success=True,
        query=request.query,
        results=results,
    )


# ── Direct Text Ingestion (from ERP Service) ───────────────────────────


@app.post("/api/v1/rag/ingest", response_model=UploadResponse)
async def ingest_document(request: IngestRequest):
    """Accept pre-extracted plain text and metadata from ERP, chunk, embed, and store in Qdrant."""
    clean_text = " ".join(request.text.split())
    if not clean_text.strip():
        raise HTTPException(
            status_code=400, detail="No extractable text provided."
        )

    chunks: list[dict] = []
    chunk_index = 0
    step = max(settings.CHUNK_SIZE - settings.CHUNK_OVERLAP, 1)

    start = 0
    while start < len(clean_text):
        chunk_text = clean_text[start : start + settings.CHUNK_SIZE]
        if chunk_text.strip():
            chunks.append(
                {
                    "text": chunk_text,
                    "metadata": {
                        "document_id": request.documentId,
                        "tenant_id": request.tenantId,
                        "filename": request.fileName,
                        "chunk_index": chunk_index,
                        **request.metadata,
                    },
                }
            )
            chunk_index += 1
        start += step

    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks generated.")

    texts = [c["text"] for c in chunks]
    embeddings = embedding_service.embed(texts)
    vector_store.add(chunks, embeddings)

    return UploadResponse(
        success=True,
        filename=request.fileName,
        document_id=request.documentId,
        chunks=len(chunks),
    )


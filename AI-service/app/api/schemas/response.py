from pydantic import BaseModel


class SearchResult(BaseModel):
    text: str
    score: float
    document_id: str
    filename: str
    page_number: int
    chunk_index: int


class UploadResponse(BaseModel):
    success: bool
    filename: str
    document_id: str
    chunks: int


class SearchResponse(BaseModel):
    success: bool
    query: str
    results: list[SearchResult]

from typing import Any
from pydantic import BaseModel, Field


class ConversationRequest(BaseModel):
    user_id: str = Field(..., min_length=1, description="WhatsApp user identifier (WaId)")
    phone: str | None = Field(default=None, description="Sender WhatsApp phone number in E.164 or digits format")
    message: str = Field(..., min_length=1, description="User message text")
    tenant_id: str = Field(..., min_length=1, description="Tenant identifier UUID for multi-tenant context")


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query text")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of results to return")


class IngestRequest(BaseModel):
    tenantId: str = Field(..., description="Tenant identifier UUID")
    documentId: str = Field(..., description="ERP document UUID")
    fileName: str = Field(..., description="Original file name")
    text: str = Field(..., description="Extracted plain text")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional document metadata")



"""Pydantic schemas for AI features."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# === Ollama Status ===


class OllamaStatusResponse(BaseModel):
    """Response for Ollama connection status."""

    connected: bool
    configured: bool
    base_url: str | None
    model: str
    models_available: list[str] = []
    model_available: bool = False
    error: str | None = None


# === Category Suggestions ===


class CategorySuggestionResponse(BaseModel):
    """Response for a category suggestion."""

    id: UUID
    vendor_id: UUID
    vendor_name: str | None = None
    suggested_category_id: UUID
    suggested_category_name: str | None = None
    model: str
    confidence: float | None
    rationale: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategorySuggestionListResponse(BaseModel):
    """Response for category suggestion list."""

    suggestions: list[CategorySuggestionResponse]
    total: int


class SuggestCategoryRequest(BaseModel):
    """Request to generate a category suggestion."""

    vendor_id: UUID
    force: bool = Field(
        default=False, description="Force regeneration even if pending suggestion exists"
    )


class AcceptSuggestionRequest(BaseModel):
    """Request to accept a category suggestion."""

    create_rule: bool = Field(default=True, description="Create a manual category rule")


class RejectSuggestionRequest(BaseModel):
    """Request to reject a category suggestion."""

    alternative_category_id: UUID | None = Field(
        default=None, description="Alternative category to set instead"
    )


class SuggestionActionResponse(BaseModel):
    """Response for suggestion accept/reject actions."""

    success: bool
    message: str
    rule_created: bool = False


class BulkAcceptResponse(BaseModel):
    """Response for bulk accept of all pending suggestions."""

    accepted: int
    failed: int
    rules_created: int


# === AI Chat ===


class ChatMessage(BaseModel):
    """A single message in conversation history."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    """Request for AI chat."""

    question: str = Field(..., min_length=1, max_length=500)
    wallet_id: UUID | None = Field(default=None, description="Optional wallet context")
    conversation_history: list[ChatMessage] = Field(
        default_factory=list, description="Recent conversation history for context"
    )
    session_id: UUID | None = Field(
        default=None, description="Chat session ID for persistent conversations"
    )


class ChatQueryInfo(BaseModel):
    """Information about the query executed."""

    type: str | None
    explanation: str | None


class ChatResponse(BaseModel):
    """Response from AI chat."""

    answer: str
    highlights: list[str] = []
    chart_type: str = "none"
    query_info: ChatQueryInfo | None = None
    data: dict[str, Any] | None = None
    error: str | None = None
    session_id: UUID | None = None


# === Chat Sessions ===


class ChatSessionCreate(BaseModel):
    """Request to create a new chat session."""

    title: str = Field(default="New Chat", max_length=255)


class ChatMessageResponse(BaseModel):
    """Response for a single chat message."""

    id: UUID
    session_id: UUID
    role: str
    content: str
    highlights: list[str] | None = None
    chart_type: str | None = None
    query_info: ChatQueryInfo | None = None
    data: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    """Response for a chat session summary."""

    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ChatSessionDetailResponse(BaseModel):
    """Response for a chat session with messages."""

    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageResponse]

    model_config = {"from_attributes": True}


class ChatSessionListResponse(BaseModel):
    """Response for listing chat sessions."""

    sessions: list[ChatSessionResponse]
    total: int


# === AI Parsing ===


class ParseModeUpdateRequest(BaseModel):
    """Request to update parse mode for an institution."""

    institution_id: UUID
    parse_mode: str = Field(..., description="regex, ollama, or hybrid")


class ParseModeResponse(BaseModel):
    """Response for parse mode update."""

    institution_id: UUID
    institution_name: str
    parse_mode: str


class ReparseRequest(BaseModel):
    """Request to re-parse a message with AI."""

    message_id: UUID
    parse_mode: str = Field(default="ollama", description="regex, ollama, or hybrid")


class ReparseResponse(BaseModel):
    """Response from re-parse request."""

    success: bool
    message_id: UUID
    parse_status: str
    parse_mode: str
    error: str | None = None
    transaction_group_id: UUID | None = None


# === Batch Operations ===


class BatchSuggestRequest(BaseModel):
    """Request for batch category suggestions."""

    vendor_ids: list[UUID] | None = Field(
        default=None, description="Specific vendors to process, or None for uncategorized"
    )
    max_vendors: int = Field(default=10, ge=1, le=50, description="Batch size per iteration")
    process_all: bool = Field(
        default=True, description="Process ALL uncategorized vendors (in batches)"
    )
    concurrency: int = Field(
        default=6, ge=1, le=12, description="Number of parallel Ollama requests"
    )


class BatchSuggestResponse(BaseModel):
    """Response from batch suggestion."""

    processed: int
    success: int
    failed: int
    skipped: int


# === AI Settings ===


class AISettingsResponse(BaseModel):
    """Response for AI settings."""

    ollama_configured: bool
    ollama_base_url: str | None
    ollama_model: str
    ollama_connected: bool
    available_models: list[str]
    parse_modes_available: list[str] = ["regex", "ollama", "hybrid"]


class AISettingsUpdateRequest(BaseModel):
    """Request to update AI settings (for future use)."""

    ollama_base_url: str | None = None
    ollama_model: str | None = None

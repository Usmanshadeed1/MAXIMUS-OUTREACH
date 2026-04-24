"""Pydantic schemas for Review Queue and Conversations (Phase 12)."""
import uuid
from datetime import datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Message / Draft schemas
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str
    content: str
    media_urls: list[str] = []
    is_ai_generated: bool
    is_approved: bool
    sent_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EditDraftRequest(BaseModel):
    content: str


# ---------------------------------------------------------------------------
# Review Queue schemas
# ---------------------------------------------------------------------------

class ReviewQueueItem(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    lead_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    channel: str
    content: str
    is_ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewQueueList(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    page: int
    page_size: int


class ReviewQueueCount(BaseModel):
    count: int


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------

class ConversationResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    channel: str
    status: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}


class ConversationList(BaseModel):
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int


class ManualReplyRequest(BaseModel):
    content: str

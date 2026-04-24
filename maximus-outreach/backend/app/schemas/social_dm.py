"""Schemas for Social DM Queue endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class SocialDmResponse(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID | None
    client_id: uuid.UUID | None
    outreach_log_id: uuid.UUID | None
    platform: str
    profile_url: str
    message_content: str
    status: str
    scheduled_for: datetime | None
    sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialDmStats(BaseModel):
    pending: int
    sent_today: int
    skipped: int


class BulkMarkSentRequest(BaseModel):
    ids: list[uuid.UUID]

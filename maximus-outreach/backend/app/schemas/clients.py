import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class ClientCreate(BaseModel):
    name: str
    business_type: str | None = None
    services: str | None = None
    target_audience: str | None = None
    tone: str = "professional"
    pitch: str | None = None
    website: str | None = None
    phone: str | None = None
    smtp_id: uuid.UUID | None = None
    from_email: str | None = None
    from_name: str | None = None
    custom_instructions: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Client name must not be blank.")
        return v.strip()

    @field_validator("tone")
    @classmethod
    def tone_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Tone must not be blank.")
        return v.strip()


class ClientUpdate(BaseModel):
    name: str | None = None
    business_type: str | None = None
    services: str | None = None
    target_audience: str | None = None
    tone: str | None = None
    pitch: str | None = None
    website: str | None = None
    phone: str | None = None
    smtp_id: uuid.UUID | None = None
    from_email: str | None = None
    from_name: str | None = None
    custom_instructions: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Client name must not be blank.")
        return v.strip() if v else v

    @field_validator("tone")
    @classmethod
    def tone_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Tone must not be blank.")
        return v.strip() if v else v


class ClientResponse(BaseModel):
    id: uuid.UUID
    name: str
    business_type: str | None
    services: str | None
    target_audience: str | None
    tone: str
    pitch: str | None
    website: str | None
    phone: str | None
    smtp_id: uuid.UUID | None
    from_email: str | None
    from_name: str | None
    custom_instructions: str | None
    is_active: bool
    created_at: datetime
    lead_count: int = 0
    active_campaigns_count: int = 0

    model_config = {"from_attributes": True}


class ClientList(BaseModel):
    items: list[ClientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

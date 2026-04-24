import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


VALID_STATUSES = {"new", "contacted", "replied", "converted", "opted_out", "invalid"}


class LeadCreate(BaseModel):
    business_name: str | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    email: str | None = None
    rating: Decimal | None = None
    reviews: int | None = None
    facebook: str | None = None
    instagram: str | None = None
    linkedin: str | None = None
    youtube: str | None = None
    twitter: str | None = None
    tiktok: str | None = None
    snapchat: str | None = None
    other_social: dict = {}
    source: str = "manual"
    status: str = "new"
    tags: list[str] = []
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("business_name", "phone", "email")
    @classmethod
    def strip_if_set(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class LeadUpdate(BaseModel):
    business_name: str | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    email: str | None = None
    rating: Decimal | None = None
    reviews: int | None = None
    facebook: str | None = None
    instagram: str | None = None
    linkedin: str | None = None
    youtube: str | None = None
    twitter: str | None = None
    tiktok: str | None = None
    snapchat: str | None = None
    other_social: dict | None = None
    status: str | None = None
    tags: list[str] | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v


class LeadResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    import_id: uuid.UUID | None
    business_name: str | None
    address: str | None
    phone: str | None
    website: str | None
    email: str | None
    rating: Decimal | None
    reviews: int | None
    facebook: str | None
    instagram: str | None
    linkedin: str | None
    youtube: str | None
    twitter: str | None
    tiktok: str | None
    snapchat: str | None
    other_social: dict
    source: str
    status: str
    tags: list
    notes: str | None
    imported_at: datetime
    updated_at: datetime
    available_channels: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_lead(cls, lead) -> "LeadResponse":
        channels: list[str] = []
        if lead.email:
            channels.append("email")
        if lead.phone:
            channels.append("sms")
            channels.append("whatsapp")
        if lead.facebook:
            channels.append("facebook")
        if lead.instagram:
            channels.append("instagram")
        if lead.linkedin:
            channels.append("linkedin")
        if lead.youtube:
            channels.append("youtube")
        if lead.twitter:
            channels.append("twitter")
        if lead.tiktok:
            channels.append("tiktok")
        if lead.snapchat:
            channels.append("snapchat")

        return cls(
            id=lead.id,
            client_id=lead.client_id,
            import_id=lead.import_id,
            business_name=lead.business_name,
            address=lead.address,
            phone=lead.phone,
            website=lead.website,
            email=lead.email,
            rating=lead.rating,
            reviews=lead.reviews,
            facebook=lead.facebook,
            instagram=lead.instagram,
            linkedin=lead.linkedin,
            youtube=lead.youtube,
            twitter=lead.twitter,
            tiktok=lead.tiktok,
            snapchat=lead.snapchat,
            other_social=lead.other_social or {},
            source=lead.source,
            status=lead.status,
            tags=lead.tags or [],
            notes=lead.notes,
            imported_at=lead.imported_at,
            updated_at=lead.updated_at,
            available_channels=channels,
        )


class LeadList(BaseModel):
    items: list[LeadResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class LeadImportResponse(BaseModel):
    file_name: str
    total_rows: int
    imported_count: int
    duplicates_skipped: int
    errors_count: int


class ImportHistoryResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    total_rows: int
    imported_count: int
    duplicates_skipped: int
    errors_count: int
    status: str
    imported_at: datetime

    model_config = {"from_attributes": True}

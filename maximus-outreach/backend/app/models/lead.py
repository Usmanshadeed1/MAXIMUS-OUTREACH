import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LeadImport(Base):
    __tablename__ = "lead_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    imported_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicates_skipped: Mapped[int] = mapped_column(Integer, default=0)
    errors_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="completed")
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="lead_imports")  # noqa: F821
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="lead_import")


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    import_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lead_imports.id", ondelete="SET NULL"), nullable=True, index=True)
    business_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    reviews: Mapped[int | None] = mapped_column(Integer, nullable=True)
    facebook: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    youtube: Mapped[str | None] = mapped_column(String(500), nullable=True)
    twitter: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tiktok: Mapped[str | None] = mapped_column(String(500), nullable=True)
    snapchat: Mapped[str | None] = mapped_column(String(500), nullable=True)
    other_social: Mapped[dict] = mapped_column(JSONB, default=dict)
    source: Mapped[str] = mapped_column(String(100), default="csv_import")
    status: Mapped[str] = mapped_column(String(50), default="new", index=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="leads")  # noqa: F821
    lead_import: Mapped["LeadImport | None"] = relationship("LeadImport", back_populates="leads")
    enrollments: Mapped[list["CampaignEnrollment"]] = relationship(  # noqa: F821
        "CampaignEnrollment", back_populates="lead", cascade="all, delete-orphan"
    )
    outreach_logs: Mapped[list["OutreachLog"]] = relationship(  # noqa: F821
        "OutreachLog", back_populates="lead", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        "Conversation", back_populates="lead", cascade="all, delete-orphan"
    )
    social_dm_queue: Mapped[list["SocialDmQueue"]] = relationship(  # noqa: F821
        "SocialDmQueue", back_populates="lead", cascade="all, delete-orphan"
    )

    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint("client_id", "email", name="uq_lead_client_email"),
        UniqueConstraint("client_id", "phone", name="uq_lead_client_phone"),
    )

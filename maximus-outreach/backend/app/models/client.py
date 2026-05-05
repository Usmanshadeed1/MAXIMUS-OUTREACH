import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    services: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str] = mapped_column(String(50), default="professional")
    pitch: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    smtp_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("smtp_settings.id", ondelete="SET NULL"), nullable=True
    )
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="created_clients", foreign_keys=[created_by])  # noqa: F821
    user_assignments: Mapped[list["UserClientAssignment"]] = relationship(  # noqa: F821
        "UserClientAssignment", back_populates="client", cascade="all, delete-orphan"
    )
    lead_imports: Mapped[list["LeadImport"]] = relationship(  # noqa: F821
        "LeadImport", back_populates="client", cascade="all, delete-orphan"
    )
    leads: Mapped[list["Lead"]] = relationship(  # noqa: F821
        "Lead", back_populates="client", cascade="all, delete-orphan"
    )
    campaigns: Mapped[list["Campaign"]] = relationship(  # noqa: F821
        "Campaign", back_populates="client", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        "Conversation", back_populates="client", cascade="all, delete-orphan"
    )
    analytics_events: Mapped[list["AnalyticsEvent"]] = relationship(  # noqa: F821
        "AnalyticsEvent", back_populates="client", cascade="all, delete-orphan"
    )
    social_dm_queue: Mapped[list["SocialDmQueue"]] = relationship(  # noqa: F821
        "SocialDmQueue", back_populates="client", cascade="all, delete-orphan"
    )
    media_files: Mapped[list["MediaFile"]] = relationship(  # noqa: F821
        "MediaFile", back_populates="client", cascade="all, delete-orphan"
    )

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OutreachLog(Base):
    __tablename__ = "outreach_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaign_enrollments.id", ondelete="CASCADE"), nullable=True)
    step_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaign_steps.id", ondelete="CASCADE"), nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    message_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_urls: Mapped[list] = mapped_column(JSONB, default=list)
    social_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    social_profile_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ai_model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    enrollment: Mapped["CampaignEnrollment | None"] = relationship("CampaignEnrollment", back_populates="outreach_logs")  # noqa: F821
    step: Mapped["CampaignStep | None"] = relationship("CampaignStep", back_populates="outreach_logs")  # noqa: F821
    lead: Mapped["Lead | None"] = relationship("Lead", back_populates="outreach_logs")  # noqa: F821
    social_dm: Mapped["SocialDmQueue | None"] = relationship(
        "SocialDmQueue", back_populates="outreach_log", uselist=False, cascade="all, delete-orphan"
    )


class SocialDmQueue(Base):
    __tablename__ = "social_dm_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    outreach_log_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("outreach_log.id", ondelete="CASCADE"), nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    profile_url: Mapped[str] = mapped_column(String(500), nullable=False)
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    outreach_log: Mapped["OutreachLog | None"] = relationship("OutreachLog", back_populates="social_dm")
    lead: Mapped["Lead | None"] = relationship("Lead", back_populates="social_dm_queue")  # noqa: F821
    client: Mapped["Client | None"] = relationship("Client", back_populates="social_dm_queue")  # noqa: F821

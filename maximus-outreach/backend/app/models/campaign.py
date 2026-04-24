import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    stop_on_reply: Mapped[bool] = mapped_column(Boolean, default=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    repeat_delay_days: Mapped[int] = mapped_column(Integer, default=14)
    pacing_mode: Mapped[str] = mapped_column(String(50), default="gradual_rampup")
    pacing_leads_per_day: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"week1": 50, "week2": 100, "week3": 150, "week4_plus": 200}
    )
    send_window_start: Mapped[time] = mapped_column(Time, default=time(9, 0))
    send_window_end: Mapped[time] = mapped_column(Time, default=time(18, 0))
    send_timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    total_enrolled: Mapped[int] = mapped_column(Integer, default=0)
    total_activated: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="campaigns")  # noqa: F821
    steps: Mapped[list["CampaignStep"]] = relationship(
        "CampaignStep", back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignStep.step_order"
    )
    enrollments: Mapped[list["CampaignEnrollment"]] = relationship(
        "CampaignEnrollment", back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignStep(Base):
    __tablename__ = "campaign_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    delay_days: Mapped[int] = mapped_column(Integer, default=0)
    delay_hours: Mapped[int] = mapped_column(Integer, default=0)
    message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    use_ai_generation: Mapped[bool] = mapped_column(Boolean, default=True)
    ai_prompt_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject_template: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="steps")
    media: Mapped[list["StepMedia"]] = relationship(
        "StepMedia", back_populates="step", cascade="all, delete-orphan"
    )
    outreach_logs: Mapped[list["OutreachLog"]] = relationship(  # noqa: F821
        "OutreachLog", back_populates="step", cascade="all, delete-orphan"
    )


class StepMedia(Base):
    __tablename__ = "step_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaign_steps.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    step: Mapped["CampaignStep"] = relationship("CampaignStep", back_populates="media")


class CampaignEnrollment(Base):
    __tablename__ = "campaign_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    current_attempt: Mapped[int] = mapped_column(Integer, default=1)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="enrollments")
    lead: Mapped["Lead"] = relationship("Lead", back_populates="enrollments")  # noqa: F821
    outreach_logs: Mapped[list["OutreachLog"]] = relationship(  # noqa: F821
        "OutreachLog", back_populates="enrollment", cascade="all, delete-orphan"
    )

    from sqlalchemy import UniqueConstraint
    __table_args__ = (UniqueConstraint("campaign_id", "lead_id", name="uq_enrollment_campaign_lead"),)

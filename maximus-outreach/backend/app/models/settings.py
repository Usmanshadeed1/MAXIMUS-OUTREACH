import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SmtpSettings(Base):
    __tablename__ = "smtp_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=587)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    password_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_limit: Mapped[int] = mapped_column(Integer, default=200)
    sent_today: Mapped[int] = mapped_column(Integer, default=0)
    warmup_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    warmup_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    warmup_current_daily_limit: Mapped[int] = mapped_column(Integer, default=20)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    health_status: Mapped[str] = mapped_column(String(50), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    warmup_schedule: Mapped[list["EmailWarmupSchedule"]] = relationship(
        "EmailWarmupSchedule", back_populates="smtp", cascade="all, delete-orphan"
    )


class AiApiKey(Base):
    __tablename__ = "ai_api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    daily_limit: Mapped[int] = mapped_column(Integer, default=1000)
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    health_status: Mapped[str] = mapped_column(String(50), default="unknown")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SmsProviderSettings(Base):
    """Single global record — owner picks Twilio OR Telnyx as paid fallback."""
    __tablename__ = "sms_provider_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # 'twilio' | 'telnyx'
    # Twilio
    twilio_account_sid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    twilio_auth_token_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Telnyx
    telnyx_api_key_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    telnyx_webhook_public_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Shared
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(50), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SmsPhoneNumber(Base):
    """One phone number per client (Option B). Works with both Twilio and Telnyx."""
    __tablename__ = "sms_phone_numbers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    phone_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=500)
    sent_today: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class WhatsAppSettings(Base):
    """Global WhatsApp credentials — one record, owner-level WABA access token."""
    __tablename__ = "whatsapp_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    access_token_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    business_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    webhook_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(50), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class WhatsAppPhoneNumber(Base):
    """Per-phone-number pool — each number optionally assigned to a client."""
    __tablename__ = "whatsapp_phone_numbers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    phone_number_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)  # Meta's numeric ID
    display_phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)      # e.g. "+1 555-123-4567"
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=250)
    sent_today: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class EmailWarmupSchedule(Base):
    __tablename__ = "email_warmup_schedule"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    smtp_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("smtp_settings.id", ondelete="CASCADE"), nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    daily_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    smtp: Mapped["SmtpSettings"] = relationship("SmtpSettings", back_populates="warmup_schedule")

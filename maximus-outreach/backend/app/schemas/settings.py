import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, field_validator


VALID_PROVIDERS = {"openrouter", "groq"}


class AiKeyCreate(BaseModel):
    provider: str
    base_url: str
    api_key: str
    model_name: str
    label: str | None = None
    priority: int = 0
    daily_limit: int = 1000

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of: {VALID_PROVIDERS}")
        return v

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("api_key must not be blank.")
        return v.strip()

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("model_name must not be blank.")
        return v.strip()

    @field_validator("daily_limit")
    @classmethod
    def validate_daily_limit(cls, v: int) -> int:
        if v < 1:
            raise ValueError("daily_limit must be at least 1.")
        return v


class AiKeyUpdate(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model_name: str | None = None
    label: str | None = None
    priority: int | None = None
    daily_limit: int | None = None
    is_active: bool | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of: {VALID_PROVIDERS}")
        return v

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("api_key must not be blank.")
        return v.strip() if v else v

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("model_name must not be blank.")
        return v.strip() if v else v


class AiKeyResponse(BaseModel):
    id: uuid.UUID
    provider: str
    base_url: str
    model_name: str
    label: str | None
    priority: int
    daily_limit: int
    requests_today: int
    is_active: bool
    health_status: str
    last_health_check: datetime | None
    last_error: str | None
    created_at: datetime
    # masked key — last 4 chars only
    api_key_masked: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_key(cls, key) -> "AiKeyResponse":
        from app.utils.encryption import decrypt_value
        try:
            raw = decrypt_value(key.api_key_encrypted)
            masked = "****" + raw[-4:] if len(raw) >= 4 else "****"
        except Exception:
            masked = "****"
        return cls(
            id=key.id,
            provider=key.provider,
            base_url=key.base_url,
            model_name=key.model_name,
            label=key.label,
            priority=key.priority,
            daily_limit=key.daily_limit,
            requests_today=key.requests_today,
            is_active=key.is_active,
            health_status=key.health_status,
            last_health_check=key.last_health_check,
            last_error=key.last_error,
            created_at=key.created_at,
            api_key_masked=masked,
        )


class AiKeyTestResponse(BaseModel):
    success: bool
    provider: str
    model_name: str
    response_text: str | None = None
    error: str | None = None
    latency_ms: int | None = None


# ---------------------------------------------------------------------------
# SMTP Settings
# ---------------------------------------------------------------------------

class SmtpCreate(BaseModel):
    name: str
    host: str
    port: int = 587
    username: str
    password: str
    from_email: str | None = None
    from_name: str | None = None
    use_tls: bool = True
    is_default: bool = False
    daily_limit: int = 200
    warmup_enabled: bool = False

    @field_validator("name", "host", "username", "password")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field must not be blank.")
        return v.strip()

    @field_validator("port")
    @classmethod
    def valid_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("port must be between 1 and 65535.")
        return v

    @field_validator("daily_limit")
    @classmethod
    def valid_daily_limit(cls, v: int) -> int:
        if v < 1:
            raise ValueError("daily_limit must be at least 1.")
        return v


class SmtpUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    from_email: str | None = None
    from_name: str | None = None
    use_tls: bool | None = None
    is_default: bool | None = None
    daily_limit: int | None = None
    warmup_enabled: bool | None = None
    is_active: bool | None = None


class SmtpResponse(BaseModel):
    id: uuid.UUID
    name: str
    host: str
    port: int
    username: str
    from_email: str | None
    from_name: str | None
    use_tls: bool
    is_default: bool
    daily_limit: int
    sent_today: int
    warmup_enabled: bool
    warmup_start_date: date | None
    warmup_current_daily_limit: int
    is_active: bool
    health_status: str
    last_health_check: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SmtpTestRequest(BaseModel):
    to_email: str
    subject: str = "Maximus Outreach - SMTP Test"


class SmtpTestResponse(BaseModel):
    success: bool
    error: str | None = None
    latency_ms: int | None = None


class WarmupScheduleEntry(BaseModel):
    day_number: int
    daily_limit: int


class WarmupStartResponse(BaseModel):
    smtp_id: uuid.UUID
    warmup_start_date: date
    schedule: list[WarmupScheduleEntry]


# ---------------------------------------------------------------------------
# SMS Provider Settings schemas
# ---------------------------------------------------------------------------

VALID_SMS_PROVIDERS = {"twilio", "telnyx"}


class SmsProviderCreate(BaseModel):
    provider: str
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None         # plain — encrypted before storage
    telnyx_api_key: str | None = None            # plain — encrypted before storage
    telnyx_webhook_public_key: str | None = None # Ed25519 public key from Telnyx portal

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in VALID_SMS_PROVIDERS:
            raise ValueError(f"provider must be one of: {sorted(VALID_SMS_PROVIDERS)}")
        return v

    @field_validator("twilio_account_sid", "twilio_auth_token", "telnyx_api_key", "telnyx_webhook_public_key", mode="before")
    @classmethod
    def no_blank_strings(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class SmsProviderUpdate(BaseModel):
    provider: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    telnyx_api_key: str | None = None
    telnyx_webhook_public_key: str | None = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SMS_PROVIDERS:
            raise ValueError(f"provider must be one of: {sorted(VALID_SMS_PROVIDERS)}")
        return v


class SmsProviderResponse(BaseModel):
    id: uuid.UUID
    provider: str
    twilio_account_sid: str | None
    telnyx_configured: bool            # True if telnyx_api_key_encrypted is set
    telnyx_webhook_configured: bool    # True if telnyx_webhook_public_key is set
    is_active: bool
    health_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SmsProviderTestResponse(BaseModel):
    success: bool
    provider: str
    error: str | None = None


# ---------------------------------------------------------------------------
# SMS Phone Number schemas
# ---------------------------------------------------------------------------

class SmsPhoneNumberCreate(BaseModel):
    phone_number: str
    label: str | None = None
    client_id: uuid.UUID | None = None
    daily_limit: int = 500
    is_active: bool = True

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("phone_number cannot be blank")
        return v

    @field_validator("daily_limit")
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if v < 1 or v > 10000:
            raise ValueError("daily_limit must be between 1 and 10000")
        return v


class SmsPhoneNumberUpdate(BaseModel):
    label: str | None = None
    client_id: uuid.UUID | None = None
    daily_limit: int | None = None
    is_active: bool | None = None


class SmsPhoneNumberResponse(BaseModel):
    id: uuid.UUID
    phone_number: str
    label: str | None
    client_id: uuid.UUID | None
    daily_limit: int
    sent_today: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# WhatsApp Settings schemas
# ---------------------------------------------------------------------------

class WhatsAppSettingsCreate(BaseModel):
    access_token: str
    business_account_id: str | None = None
    webhook_verify_token: str | None = None

    @field_validator("access_token")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("access_token must not be blank.")
        return v.strip()

    @field_validator("business_account_id", "webhook_verify_token", mode="before")
    @classmethod
    def no_blank_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class WhatsAppSettingsUpdate(BaseModel):
    access_token: str | None = None
    business_account_id: str | None = None
    webhook_verify_token: str | None = None

    @field_validator("access_token")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("access_token must not be blank.")
        return v.strip() if v else v

    @field_validator("business_account_id", "webhook_verify_token", mode="before")
    @classmethod
    def no_blank_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class WhatsAppSettingsResponse(BaseModel):
    id: uuid.UUID
    business_account_id: str | None
    webhook_verify_token: str | None
    token_configured: bool
    is_active: bool
    health_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WhatsAppTestResponse(BaseModel):
    success: bool
    error: str | None = None


# ---------------------------------------------------------------------------
# WhatsApp Phone Number schemas
# ---------------------------------------------------------------------------

class WhatsAppPhoneNumberCreate(BaseModel):
    phone_number_id: str          # Meta's numeric phone number ID
    display_phone_number: str | None = None
    label: str | None = None
    client_id: uuid.UUID | None = None
    daily_limit: int = 250

    @field_validator("phone_number_id")
    @classmethod
    def validate_phone_number_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("phone_number_id cannot be blank")
        return v

    @field_validator("daily_limit")
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if v < 1 or v > 100000:
            raise ValueError("daily_limit must be between 1 and 100000")
        return v


class WhatsAppPhoneNumberUpdate(BaseModel):
    display_phone_number: str | None = None
    label: str | None = None
    client_id: uuid.UUID | None = None
    daily_limit: int | None = None
    is_active: bool | None = None


class WhatsAppPhoneNumberResponse(BaseModel):
    id: uuid.UUID
    phone_number_id: str
    display_phone_number: str | None
    label: str | None
    client_id: uuid.UUID | None
    daily_limit: int
    sent_today: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


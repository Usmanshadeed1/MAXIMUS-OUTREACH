import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, field_validator

VALID_PACING_MODES = {"all_at_once", "fixed_daily", "gradual_rampup", "custom"}
VALID_CHANNELS = {"email", "sms", "mms", "whatsapp", "social_dm"}


# ---------------------------------------------------------------------------
# Step schemas
# ---------------------------------------------------------------------------

class CampaignStepCreate(BaseModel):
    step_order: int
    channel: str
    delay_days: int = 0
    delay_hours: int = 0
    message_template: str | None = None
    use_ai_generation: bool = True
    ai_prompt_override: str | None = None
    subject_template: str | None = None

    @field_validator("channel")
    @classmethod
    def channel_valid(cls, v: str) -> str:
        if v not in VALID_CHANNELS:
            raise ValueError(f"channel must be one of: {', '.join(sorted(VALID_CHANNELS))}")
        return v

    @field_validator("step_order")
    @classmethod
    def step_order_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("step_order must be >= 1")
        return v


class CampaignStepUpdate(BaseModel):
    step_order: int | None = None
    channel: str | None = None
    delay_days: int | None = None
    delay_hours: int | None = None
    message_template: str | None = None
    use_ai_generation: bool | None = None
    ai_prompt_override: str | None = None
    subject_template: str | None = None
    is_active: bool | None = None

    @field_validator("channel")
    @classmethod
    def channel_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_CHANNELS:
            raise ValueError(f"channel must be one of: {', '.join(sorted(VALID_CHANNELS))}")
        return v


class StepMediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_id: uuid.UUID
    file_path: str
    file_name: str
    file_type: str
    file_size: int | None
    uploaded_at: datetime


class CampaignStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    step_order: int
    channel: str
    delay_days: int
    delay_hours: int
    message_template: str | None
    use_ai_generation: bool
    ai_prompt_override: str | None
    subject_template: str | None
    is_active: bool
    created_at: datetime
    media: list[StepMediaResponse] = []


# ---------------------------------------------------------------------------
# Campaign schemas
# ---------------------------------------------------------------------------

class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    stop_on_reply: bool = True
    max_attempts: int = 1
    repeat_delay_days: int = 14
    pacing_mode: str = "gradual_rampup"
    pacing_leads_per_day: dict = {"week1": 50, "week2": 100, "week3": 150, "week4_plus": 200}
    send_window_start: time = time(9, 0)
    send_window_end: time = time(18, 0)
    send_timezone: str = "America/New_York"
    steps: list[CampaignStepCreate] = []

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        return v.strip()

    @field_validator("pacing_mode")
    @classmethod
    def pacing_mode_valid(cls, v: str) -> str:
        if v not in VALID_PACING_MODES:
            raise ValueError(f"pacing_mode must be one of: {', '.join(sorted(VALID_PACING_MODES))}")
        return v


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    stop_on_reply: bool | None = None
    max_attempts: int | None = None
    repeat_delay_days: int | None = None
    pacing_mode: str | None = None
    pacing_leads_per_day: dict | None = None
    send_window_start: time | None = None
    send_window_end: time | None = None
    send_timezone: str | None = None

    @field_validator("pacing_mode")
    @classmethod
    def pacing_mode_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_PACING_MODES:
            raise ValueError(f"pacing_mode must be one of: {', '.join(sorted(VALID_PACING_MODES))}")
        return v


# ---------------------------------------------------------------------------
# Enrollment schemas
# ---------------------------------------------------------------------------

class EnrollLeadsRequest(BaseModel):
    lead_ids: list[uuid.UUID] = []
    filter_status: str | None = None


class EnrollLeadsResponse(BaseModel):
    enrolled: int
    skipped_already_enrolled: int
    skipped_not_found: int


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    lead_id: uuid.UUID
    status: str
    current_step: int
    current_attempt: int
    activated_at: datetime | None
    enrolled_at: datetime
    completed_at: datetime | None


# ---------------------------------------------------------------------------
# Stats & response schemas
# ---------------------------------------------------------------------------

class CampaignStats(BaseModel):
    total_enrolled: int = 0
    total_activated: int = 0
    total_queued: int = 0
    total_completed: int = 0
    total_replied: int = 0


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    description: str | None
    status: str
    stop_on_reply: bool
    max_attempts: int
    repeat_delay_days: int
    pacing_mode: str
    pacing_leads_per_day: dict
    send_window_start: time
    send_window_end: time
    send_timezone: str
    total_enrolled: int
    total_activated: int
    created_at: datetime
    updated_at: datetime
    steps: list[CampaignStepResponse] = []
    stats: CampaignStats | None = None


class CampaignList(BaseModel):
    items: list[CampaignResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PacingStatusResponse(BaseModel):
    campaign_id: uuid.UUID
    campaign_name: str
    pacing_mode: str
    total_enrolled: int
    total_activated: int
    total_queued: int
    leads_per_day_config: dict
    estimated_weeks_remaining: float | None = None

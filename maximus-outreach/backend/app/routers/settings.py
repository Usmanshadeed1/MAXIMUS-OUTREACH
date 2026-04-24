"""Router: /settings — AI keys + SMTP + SMS + WhatsApp management (Owner only)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_owner
from app.models.user import User
from app.schemas.settings import (
    AiKeyCreate, AiKeyResponse, AiKeyTestResponse, AiKeyUpdate,
    SmtpCreate, SmtpResponse, SmtpTestRequest, SmtpTestResponse,
    SmtpUpdate, WarmupStartResponse,
    SmsProviderCreate, SmsProviderResponse, SmsProviderTestResponse, SmsProviderUpdate,
    SmsPhoneNumberCreate, SmsPhoneNumberResponse, SmsPhoneNumberUpdate,
    WhatsAppSettingsCreate, WhatsAppSettingsResponse, WhatsAppTestResponse,
    WhatsAppPhoneNumberCreate, WhatsAppPhoneNumberResponse, WhatsAppPhoneNumberUpdate,
)
from app.services import ai_key_service, smtp_service, sms_settings_service, whatsapp_settings_service

ai_router = APIRouter(prefix="/settings/ai-keys", tags=["Settings: AI Keys"])
smtp_router = APIRouter(prefix="/settings/smtp", tags=["Settings: SMTP"])
sms_router = APIRouter(prefix="/settings/sms", tags=["Settings: SMS"])
wa_router = APIRouter(prefix="/settings/whatsapp", tags=["Settings: WhatsApp"])

router = APIRouter()


@ai_router.get("", response_model=list[AiKeyResponse])
async def list_keys(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    keys = await ai_key_service.list_ai_keys(db)
    return [AiKeyResponse.from_key(k) for k in keys]


@ai_router.post("", response_model=AiKeyResponse, status_code=status.HTTP_201_CREATED)
async def add_key(
    payload: AiKeyCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    key = await ai_key_service.create_ai_key(payload, db)
    await db.commit()
    await db.refresh(key)
    return AiKeyResponse.from_key(key)


@ai_router.put("/{key_id}", response_model=AiKeyResponse)
async def update_key(
    key_id: uuid.UUID,
    payload: AiKeyUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    key = await ai_key_service.get_ai_key_by_id(key_id, db)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI key not found.")
    key = await ai_key_service.update_ai_key(key, payload, db)
    await db.commit()
    await db.refresh(key)
    return AiKeyResponse.from_key(key)


@ai_router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(
    key_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    key = await ai_key_service.get_ai_key_by_id(key_id, db)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI key not found.")
    await ai_key_service.delete_ai_key(key, db)
    await db.commit()


@ai_router.post("/{key_id}/test", response_model=AiKeyTestResponse)
async def test_key(
    key_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    key = await ai_key_service.get_ai_key_by_id(key_id, db)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI key not found.")
    result = await ai_key_service.test_ai_key(key)
    return AiKeyTestResponse(
        success=result["success"],
        provider=key.provider,
        model_name=key.model_name,
        response_text=result.get("response_text"),
        error=result.get("error"),
        latency_ms=result.get("latency_ms"),
    )


# ---------------------------------------------------------------------------
# SMTP routes
# ---------------------------------------------------------------------------

@smtp_router.get("", response_model=list[SmtpResponse])
async def list_smtp(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    accounts = await smtp_service.list_smtp(db)
    return [SmtpResponse.model_validate(s) for s in accounts]


@smtp_router.post("", response_model=SmtpResponse, status_code=status.HTTP_201_CREATED)
async def add_smtp(
    payload: SmtpCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    smtp = await smtp_service.create_smtp(payload, db)
    await db.commit()
    await db.refresh(smtp)
    return SmtpResponse.model_validate(smtp)


@smtp_router.put("/{smtp_id}", response_model=SmtpResponse)
async def update_smtp(
    smtp_id: uuid.UUID,
    payload: SmtpUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    smtp = await smtp_service.get_smtp_by_id(smtp_id, db)
    if smtp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMTP account not found.")
    smtp = await smtp_service.update_smtp(smtp, payload, db)
    await db.commit()
    await db.refresh(smtp)
    return SmtpResponse.model_validate(smtp)


@smtp_router.delete("/{smtp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_smtp(
    smtp_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    smtp = await smtp_service.get_smtp_by_id(smtp_id, db)
    if smtp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMTP account not found.")
    await smtp_service.delete_smtp(smtp, db)
    await db.commit()


@smtp_router.post("/{smtp_id}/test", response_model=SmtpTestResponse)
async def test_smtp(
    smtp_id: uuid.UUID,
    payload: SmtpTestRequest,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    smtp = await smtp_service.get_smtp_by_id(smtp_id, db)
    if smtp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMTP account not found.")
    result = await smtp_service.test_smtp(smtp, payload.to_email, payload.subject)
    return SmtpTestResponse(
        success=result["success"],
        error=result.get("error"),
        latency_ms=result.get("latency_ms"),
    )


@smtp_router.post("/{smtp_id}/warmup/start", response_model=WarmupStartResponse)
async def start_warmup(
    smtp_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    smtp = await smtp_service.get_smtp_by_id(smtp_id, db)
    if smtp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMTP account not found.")
    result = await smtp_service.start_warmup(smtp, db)
    await db.commit()
    return WarmupStartResponse(
        smtp_id=result["smtp_id"],
        warmup_start_date=result["warmup_start_date"],
        schedule=result["schedule"],
    )


# ---------------------------------------------------------------------------
# SMS provider routes
# ---------------------------------------------------------------------------

@sms_router.get("", response_model=SmsProviderResponse | None)
async def get_sms_provider(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await sms_settings_service.get_provider(db)
    if record is None:
        return None
    return SmsProviderResponse(
        id=record.id,
        provider=record.provider,
        twilio_account_sid=record.twilio_account_sid,
        telnyx_configured=bool(record.telnyx_api_key_encrypted),
        telnyx_webhook_configured=bool(record.telnyx_webhook_public_key),
        is_active=record.is_active,
        health_status=record.health_status,
        created_at=record.created_at,
    )


@sms_router.post("", response_model=SmsProviderResponse)
async def save_sms_provider(
    payload: SmsProviderCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await sms_settings_service.upsert_provider(payload, db)
    await db.commit()
    await db.refresh(record)
    return SmsProviderResponse(
        id=record.id,
        provider=record.provider,
        twilio_account_sid=record.twilio_account_sid,
        telnyx_configured=bool(record.telnyx_api_key_encrypted),
        telnyx_webhook_configured=bool(record.telnyx_webhook_public_key),
        is_active=record.is_active,
        health_status=record.health_status,
        created_at=record.created_at,
    )


@sms_router.post("/test", response_model=SmsProviderTestResponse)
async def test_sms_provider(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await sms_settings_service.get_provider(db)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No SMS provider configured.")
    result = await sms_settings_service.test_provider(record)
    return SmsProviderTestResponse(
        success=result["success"],
        provider=record.provider,
        error=result.get("error"),
    )


# ---------------------------------------------------------------------------
# SMS phone number routes
# ---------------------------------------------------------------------------

@sms_router.get("/numbers", response_model=list[SmsPhoneNumberResponse])
async def list_sms_numbers(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    numbers = await sms_settings_service.list_numbers(db)
    return [SmsPhoneNumberResponse.model_validate(n) for n in numbers]


@sms_router.post("/numbers", response_model=SmsPhoneNumberResponse, status_code=status.HTTP_201_CREATED)
async def add_sms_number(
    payload: SmsPhoneNumberCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await sms_settings_service.create_number(payload, db)
    await db.commit()
    await db.refresh(number)
    return SmsPhoneNumberResponse.model_validate(number)


@sms_router.put("/numbers/{number_id}", response_model=SmsPhoneNumberResponse)
async def update_sms_number(
    number_id: uuid.UUID,
    payload: SmsPhoneNumberUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await sms_settings_service.get_number_by_id(number_id, db)
    if number is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phone number not found.")
    number = await sms_settings_service.update_number(number, payload, db)
    await db.commit()
    await db.refresh(number)
    return SmsPhoneNumberResponse.model_validate(number)


@sms_router.delete("/numbers/{number_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sms_number(
    number_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await sms_settings_service.get_number_by_id(number_id, db)
    if number is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phone number not found.")
    await sms_settings_service.delete_number(number, db)
    await db.commit()


# ---------------------------------------------------------------------------
# WhatsApp settings routes
# ---------------------------------------------------------------------------

@wa_router.get("", response_model=WhatsAppSettingsResponse | None)
async def get_whatsapp_settings(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await whatsapp_settings_service.get_settings(db)
    if record is None:
        return None
    return WhatsAppSettingsResponse(
        id=record.id,
        business_account_id=record.business_account_id,
        webhook_verify_token=record.webhook_verify_token,
        token_configured=bool(record.access_token_encrypted),
        is_active=record.is_active,
        health_status=record.health_status,
        created_at=record.created_at,
    )


@wa_router.post("", response_model=WhatsAppSettingsResponse)
async def save_whatsapp_settings(
    payload: WhatsAppSettingsCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await whatsapp_settings_service.upsert_settings(payload, db)
    await db.commit()
    await db.refresh(record)
    return WhatsAppSettingsResponse(
        id=record.id,
        business_account_id=record.business_account_id,
        webhook_verify_token=record.webhook_verify_token,
        token_configured=bool(record.access_token_encrypted),
        is_active=record.is_active,
        health_status=record.health_status,
        created_at=record.created_at,
    )


@wa_router.post("/test", response_model=WhatsAppTestResponse)
async def test_whatsapp_settings(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    record = await whatsapp_settings_service.get_settings(db)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No WhatsApp settings configured.")
    result = await whatsapp_settings_service.test_settings(record)
    return WhatsAppTestResponse(success=result["success"], error=result.get("error"))


# ---------------------------------------------------------------------------
# WhatsApp phone number routes
# ---------------------------------------------------------------------------

@wa_router.get("/numbers", response_model=list[WhatsAppPhoneNumberResponse])
async def list_whatsapp_numbers(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    numbers = await whatsapp_settings_service.list_numbers(db)
    return [WhatsAppPhoneNumberResponse.model_validate(n) for n in numbers]


@wa_router.post("/numbers", response_model=WhatsAppPhoneNumberResponse, status_code=status.HTTP_201_CREATED)
async def add_whatsapp_number(
    payload: WhatsAppPhoneNumberCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await whatsapp_settings_service.create_number(payload, db)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A number with this phone_number_id already exists.")
    await db.refresh(number)
    return WhatsAppPhoneNumberResponse.model_validate(number)


@wa_router.put("/numbers/{number_id}", response_model=WhatsAppPhoneNumberResponse)
async def update_whatsapp_number(
    number_id: uuid.UUID,
    payload: WhatsAppPhoneNumberUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await whatsapp_settings_service.get_number_by_id(number_id, db)
    if number is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WhatsApp number not found.")
    number = await whatsapp_settings_service.update_number(number, payload, db)
    await db.commit()
    await db.refresh(number)
    return WhatsAppPhoneNumberResponse.model_validate(number)


@wa_router.delete("/numbers/{number_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_whatsapp_number(
    number_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    number = await whatsapp_settings_service.get_number_by_id(number_id, db)
    if number is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WhatsApp number not found.")
    await whatsapp_settings_service.delete_number(number, db)
    await db.commit()


# Wire sub-routers into the main router
router.include_router(ai_router)
router.include_router(smtp_router)
router.include_router(sms_router)
router.include_router(wa_router)


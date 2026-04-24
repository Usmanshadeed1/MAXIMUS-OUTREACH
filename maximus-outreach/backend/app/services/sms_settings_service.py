"""Service: SMS provider settings CRUD + phone number management."""
import uuid

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import SmsPhoneNumber, SmsProviderSettings
from app.schemas.settings import (
    SmsPhoneNumberCreate,
    SmsPhoneNumberUpdate,
    SmsProviderCreate,
    SmsProviderUpdate,
)
from app.utils.encryption import decrypt_value, encrypt_value


# ---------------------------------------------------------------------------
# Provider settings — single global record
# ---------------------------------------------------------------------------

async def get_provider(db: AsyncSession) -> SmsProviderSettings | None:
    result = await db.execute(
        select(SmsProviderSettings).order_by(SmsProviderSettings.created_at).limit(1)
    )
    return result.scalar_one_or_none()


async def create_provider(payload: SmsProviderCreate, db: AsyncSession) -> SmsProviderSettings:
    record = SmsProviderSettings(
        provider=payload.provider,
        twilio_account_sid=payload.twilio_account_sid,
        twilio_auth_token_encrypted=(
            encrypt_value(payload.twilio_auth_token) if payload.twilio_auth_token else None
        ),
        telnyx_api_key_encrypted=(
            encrypt_value(payload.telnyx_api_key) if payload.telnyx_api_key else None
        ),
        telnyx_webhook_public_key=payload.telnyx_webhook_public_key,
    )
    db.add(record)
    await db.flush()
    return record


async def update_provider(
    record: SmsProviderSettings, payload: SmsProviderUpdate, db: AsyncSession
) -> SmsProviderSettings:
    if payload.provider is not None:
        record.provider = payload.provider
    if payload.twilio_account_sid is not None:
        record.twilio_account_sid = payload.twilio_account_sid
    if payload.twilio_auth_token is not None:
        record.twilio_auth_token_encrypted = encrypt_value(payload.twilio_auth_token)
    if payload.telnyx_api_key is not None:
        record.telnyx_api_key_encrypted = encrypt_value(payload.telnyx_api_key)
    if payload.telnyx_webhook_public_key is not None:
        record.telnyx_webhook_public_key = payload.telnyx_webhook_public_key
    await db.flush()
    return record


async def upsert_provider(payload: SmsProviderCreate, db: AsyncSession) -> SmsProviderSettings:
    """Create if none exists, otherwise update the existing record."""
    existing = await get_provider(db)
    if existing is None:
        return await create_provider(payload, db)
    # Map create payload to update payload fields
    upd = SmsProviderUpdate(
        provider=payload.provider,
        twilio_account_sid=payload.twilio_account_sid,
        twilio_auth_token=payload.twilio_auth_token,
        telnyx_api_key=payload.telnyx_api_key,
        telnyx_webhook_public_key=payload.telnyx_webhook_public_key,
    )
    return await update_provider(existing, upd, db)


# ---------------------------------------------------------------------------
# Credential validation (no SMS sent)
# ---------------------------------------------------------------------------

async def test_provider(record: SmsProviderSettings) -> dict:
    """Validate credentials against the provider API. Returns {success, error}."""
    try:
        if record.provider == "twilio":
            if not record.twilio_account_sid or not record.twilio_auth_token_encrypted:
                return {"success": False, "error": "Twilio credentials not configured"}
            token = decrypt_value(record.twilio_auth_token_encrypted)
            url = f"https://api.twilio.com/2010-04-01/Accounts/{record.twilio_account_sid}.json"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, auth=(record.twilio_account_sid, token))
            if resp.status_code == 200:
                return {"success": True, "error": None}
            return {"success": False, "error": f"Twilio returned {resp.status_code}: {resp.text[:200]}"}

        elif record.provider == "telnyx":
            if not record.telnyx_api_key_encrypted:
                return {"success": False, "error": "Telnyx API key not configured"}
            key = decrypt_value(record.telnyx_api_key_encrypted)
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.telnyx.com/v2/phone_numbers?page[size]=1",
                    headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
                )
            if resp.status_code in (200, 206):
                return {"success": True, "error": None}
            return {"success": False, "error": f"Telnyx returned {resp.status_code}: {resp.text[:200]}"}

        return {"success": False, "error": f"Unknown provider: {record.provider}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Phone numbers CRUD
# ---------------------------------------------------------------------------

async def list_numbers(db: AsyncSession) -> list[SmsPhoneNumber]:
    result = await db.execute(
        select(SmsPhoneNumber).order_by(SmsPhoneNumber.created_at)
    )
    return list(result.scalars().all())


async def get_number_by_id(number_id: uuid.UUID, db: AsyncSession) -> SmsPhoneNumber | None:
    result = await db.execute(
        select(SmsPhoneNumber).where(SmsPhoneNumber.id == number_id)
    )
    return result.scalar_one_or_none()


async def get_number_for_client(client_id: uuid.UUID, db: AsyncSession) -> SmsPhoneNumber | None:
    """Return number assigned to this client, or fall back to any active unassigned number."""
    # Try client-specific first
    result = await db.execute(
        select(SmsPhoneNumber)
        .where(SmsPhoneNumber.client_id == client_id, SmsPhoneNumber.is_active == True)  # noqa: E712
        .limit(1)
    )
    number = result.scalar_one_or_none()
    if number:
        return number
    # Fallback: any active unassigned number
    result = await db.execute(
        select(SmsPhoneNumber)
        .where(SmsPhoneNumber.client_id == None, SmsPhoneNumber.is_active == True)  # noqa: E711,E712
        .order_by(SmsPhoneNumber.created_at)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_number(payload: SmsPhoneNumberCreate, db: AsyncSession) -> SmsPhoneNumber:
    number = SmsPhoneNumber(
        phone_number=payload.phone_number,
        label=payload.label,
        client_id=payload.client_id,
        daily_limit=payload.daily_limit,
        is_active=payload.is_active,
    )
    db.add(number)
    await db.flush()
    return number


async def update_number(
    number: SmsPhoneNumber, payload: SmsPhoneNumberUpdate, db: AsyncSession
) -> SmsPhoneNumber:
    if payload.label is not None:
        number.label = payload.label
    if payload.client_id is not None:
        number.client_id = payload.client_id
    if payload.daily_limit is not None:
        number.daily_limit = payload.daily_limit
    if payload.is_active is not None:
        number.is_active = payload.is_active
    await db.flush()
    return number


async def delete_number(number: SmsPhoneNumber, db: AsyncSession) -> None:
    await db.delete(number)
    await db.flush()

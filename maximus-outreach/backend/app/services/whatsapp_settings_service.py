"""WhatsApp settings service — global credentials + phone number pool CRUD."""
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import WhatsAppPhoneNumber, WhatsAppSettings
from app.schemas.settings import (
    WhatsAppPhoneNumberCreate,
    WhatsAppPhoneNumberUpdate,
    WhatsAppSettingsCreate,
    WhatsAppSettingsUpdate,
)
from app.utils.encryption import decrypt_value, encrypt_value


# ---------------------------------------------------------------------------
# Global credentials
# ---------------------------------------------------------------------------

async def get_settings(db: AsyncSession) -> WhatsAppSettings | None:
    result = await db.execute(
        select(WhatsAppSettings).order_by(WhatsAppSettings.created_at).limit(1)
    )
    return result.scalar_one_or_none()


async def upsert_settings(payload: WhatsAppSettingsCreate, db: AsyncSession) -> WhatsAppSettings:
    """Create or update the single global WhatsApp settings record."""
    record = await get_settings(db)
    encrypted_token = encrypt_value(payload.access_token)

    if record is None:
        record = WhatsAppSettings(
            access_token_encrypted=encrypted_token,
            business_account_id=payload.business_account_id,
            webhook_verify_token=payload.webhook_verify_token,
        )
        db.add(record)
    else:
        record.access_token_encrypted = encrypted_token
        if payload.business_account_id is not None:
            record.business_account_id = payload.business_account_id
        if payload.webhook_verify_token is not None:
            record.webhook_verify_token = payload.webhook_verify_token

    return record


async def update_settings(
    record: WhatsAppSettings, payload: WhatsAppSettingsUpdate, db: AsyncSession
) -> WhatsAppSettings:
    if payload.access_token is not None:
        record.access_token_encrypted = encrypt_value(payload.access_token)
    if payload.business_account_id is not None:
        record.business_account_id = payload.business_account_id
    if payload.webhook_verify_token is not None:
        record.webhook_verify_token = payload.webhook_verify_token
    return record


async def test_settings(record: WhatsAppSettings) -> dict:
    """Validate the access token against the Meta Graph API."""
    try:
        token = decrypt_value(record.access_token_encrypted)
        url = "https://graph.facebook.com/v19.0/me"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 200:
            return {"success": True}
        data = resp.json()
        error_msg = data.get("error", {}).get("message", f"HTTP {resp.status_code}")
        return {"success": False, "error": error_msg}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Phone number pool
# ---------------------------------------------------------------------------

async def list_numbers(db: AsyncSession) -> list[WhatsAppPhoneNumber]:
    result = await db.execute(
        select(WhatsAppPhoneNumber).order_by(WhatsAppPhoneNumber.created_at)
    )
    return list(result.scalars().all())


async def get_number_by_id(number_id: uuid.UUID, db: AsyncSession) -> WhatsAppPhoneNumber | None:
    result = await db.execute(
        select(WhatsAppPhoneNumber).where(WhatsAppPhoneNumber.id == number_id)
    )
    return result.scalar_one_or_none()


async def create_number(payload: WhatsAppPhoneNumberCreate, db: AsyncSession) -> WhatsAppPhoneNumber:
    number = WhatsAppPhoneNumber(
        phone_number_id=payload.phone_number_id,
        display_phone_number=payload.display_phone_number,
        label=payload.label,
        client_id=payload.client_id,
        daily_limit=payload.daily_limit,
    )
    db.add(number)
    return number


async def update_number(
    record: WhatsAppPhoneNumber, payload: WhatsAppPhoneNumberUpdate, db: AsyncSession
) -> WhatsAppPhoneNumber:
    if payload.display_phone_number is not None:
        record.display_phone_number = payload.display_phone_number
    if payload.label is not None:
        record.label = payload.label
    if payload.client_id is not None:
        record.client_id = payload.client_id
    if payload.daily_limit is not None:
        record.daily_limit = payload.daily_limit
    if payload.is_active is not None:
        record.is_active = payload.is_active
    return record


async def delete_number(record: WhatsAppPhoneNumber, db: AsyncSession) -> None:
    await db.delete(record)


async def get_number_for_client(client_id: uuid.UUID, db: AsyncSession) -> WhatsAppPhoneNumber | None:
    """Find a number assigned to client_id; fall back to any unassigned active number."""
    # 1. Client-specific number
    result = await db.execute(
        select(WhatsAppPhoneNumber).where(
            WhatsAppPhoneNumber.client_id == client_id,
            WhatsAppPhoneNumber.is_active.is_(True),
            WhatsAppPhoneNumber.sent_today < WhatsAppPhoneNumber.daily_limit,
        ).limit(1)
    )
    number = result.scalar_one_or_none()
    if number:
        return number

    # 2. Any unassigned active number with remaining quota
    result = await db.execute(
        select(WhatsAppPhoneNumber).where(
            WhatsAppPhoneNumber.client_id.is_(None),
            WhatsAppPhoneNumber.is_active.is_(True),
            WhatsAppPhoneNumber.sent_today < WhatsAppPhoneNumber.daily_limit,
        ).limit(1)
    )
    return result.scalar_one_or_none()

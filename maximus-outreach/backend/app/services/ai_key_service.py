"""Service: AI API Key CRUD + live test."""
import time
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AiApiKey
from app.schemas.settings import AiKeyCreate, AiKeyUpdate
from app.utils.encryption import decrypt_value, encrypt_value


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def list_ai_keys(db: AsyncSession) -> list[AiApiKey]:
    result = await db.execute(select(AiApiKey).order_by(AiApiKey.priority, AiApiKey.created_at))
    return list(result.scalars().all())


async def get_ai_key_by_id(key_id: uuid.UUID, db: AsyncSession) -> AiApiKey | None:
    result = await db.execute(select(AiApiKey).where(AiApiKey.id == key_id))
    return result.scalar_one_or_none()


async def create_ai_key(payload: AiKeyCreate, db: AsyncSession) -> AiApiKey:
    key = AiApiKey(
        provider=payload.provider,
        base_url=payload.base_url.rstrip("/"),
        api_key_encrypted=encrypt_value(payload.api_key),
        model_name=payload.model_name,
        label=payload.label,
        priority=payload.priority,
        daily_limit=payload.daily_limit,
    )
    db.add(key)
    await db.flush()
    return key


async def update_ai_key(key: AiApiKey, payload: AiKeyUpdate, db: AsyncSession) -> AiApiKey:
    if payload.provider is not None:
        key.provider = payload.provider
    if payload.base_url is not None:
        key.base_url = payload.base_url.rstrip("/")
    if payload.api_key is not None:
        key.api_key_encrypted = encrypt_value(payload.api_key)
    if payload.model_name is not None:
        key.model_name = payload.model_name
    if payload.label is not None:
        key.label = payload.label
    if payload.priority is not None:
        key.priority = payload.priority
    if payload.daily_limit is not None:
        key.daily_limit = payload.daily_limit
    if payload.is_active is not None:
        key.is_active = payload.is_active
    db.add(key)
    await db.flush()
    return key


async def delete_ai_key(key: AiApiKey, db: AsyncSession) -> None:
    await db.delete(key)
    await db.flush()


# ---------------------------------------------------------------------------
# Live test
# ---------------------------------------------------------------------------

async def test_ai_key(key: AiApiKey) -> dict:
    """
    Send a minimal prompt to the provider and return result dict:
    {"success": bool, "response_text": str|None, "error": str|None, "latency_ms": int}
    """
    try:
        raw_key = decrypt_value(key.api_key_encrypted)
    except Exception:
        return {"success": False, "response_text": None, "error": "Failed to decrypt API key.", "latency_ms": None}

    url = f"{key.base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {raw_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": key.model_name,
        "messages": [{"role": "user", "content": "Say the word OK and nothing else."}],
        "max_tokens": 5,
        "temperature": 0,
    }

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=body)
        latency_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code == 200:
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            return {"success": True, "response_text": text, "error": None, "latency_ms": latency_ms}
        else:
            err = resp.text[:300]
            return {"success": False, "response_text": None, "error": f"HTTP {resp.status_code}: {err}", "latency_ms": latency_ms}

    except httpx.TimeoutException:
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"success": False, "response_text": None, "error": "Request timed out.", "latency_ms": latency_ms}
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"success": False, "response_text": None, "error": str(exc)[:300], "latency_ms": latency_ms}

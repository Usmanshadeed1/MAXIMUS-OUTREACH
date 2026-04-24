"""
AI Health Check Worker — runs every 30 minutes via Celery Beat.

For each active AI key:
  - Sends a tiny test prompt
  - Updates health_status: "healthy" | "error" | "rate_limited"
  - Records last_health_check timestamp and last_error
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.models.settings import AiApiKey
from app.utils.encryption import decrypt_value
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

TEST_PROMPT = "Say the word OK and nothing else."
MAX_TOKENS = 5


async def _test_single_key(key: AiApiKey) -> dict:
    """
    Send a minimal prompt to the key's provider.
    Returns {"status": "healthy"|"error"|"rate_limited", "error_msg": str|None}
    """
    try:
        raw_key = decrypt_value(key.api_key_encrypted)
    except Exception:
        return {"status": "error", "error_msg": "Failed to decrypt API key."}

    url = f"{key.base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {raw_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": key.model_name,
        "messages": [{"role": "user", "content": TEST_PROMPT}],
        "max_tokens": MAX_TOKENS,
        "temperature": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=body)

        if resp.status_code == 200:
            return {"status": "healthy", "error_msg": None}
        if resp.status_code == 429:
            return {"status": "rate_limited", "error_msg": f"HTTP 429: {resp.text[:200]}"}
        return {"status": "error", "error_msg": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    except httpx.TimeoutException:
        return {"status": "error", "error_msg": "Request timed out."}
    except Exception as exc:
        return {"status": "error", "error_msg": str(exc)[:300]}


async def _run_health_checks() -> dict:
    """Check all active keys and update DB. Returns summary dict."""
    summary = {"healthy": 0, "error": 0, "rate_limited": 0, "skipped": 0, "total": 0}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AiApiKey).where(AiApiKey.is_active == True)  # noqa: E712
        )
        keys = list(result.scalars().all())
        summary["total"] = len(keys)

        for key in keys:
            check = await _test_single_key(key)
            new_status = check["status"]
            error_msg = check["error_msg"]

            await db.execute(
                update(AiApiKey)
                .where(AiApiKey.id == key.id)
                .values(
                    health_status=new_status,
                    last_health_check=datetime.now(timezone.utc),
                    last_error=error_msg,
                )
            )
            summary[new_status] = summary.get(new_status, 0) + 1
            logger.info(
                "AI key health check: id=%s provider=%s model=%s status=%s",
                key.id, key.provider, key.model_name, new_status,
            )

        await db.commit()

    return summary


@celery_app.task(name="app.workers.ai_health_worker.check_ai_key_health", bind=True, max_retries=0)
def check_ai_key_health(self):
    """Celery task: test all active AI keys and update health_status."""
    logger.info("Starting AI key health check...")
    try:
        summary = asyncio.run(_run_health_checks())
        logger.info("AI health check complete: %s", summary)
        return summary
    except Exception as exc:
        logger.error("AI health check failed: %s", exc)
        raise

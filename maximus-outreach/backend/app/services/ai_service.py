"""
AI Service — Key Rotation + Message Generation

Rotation order:
  1. active keys only (is_active=True, health_status != "error")
  2. sorted by priority ASC, then requests_today ASC
  3. skip keys at or over daily_limit
  4. try next key on any failure
"""
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AiApiKey
from app.utils.encryption import decrypt_value


# ---------------------------------------------------------------------------
# Channel-specific prompt rules
# ---------------------------------------------------------------------------

CHANNEL_RULES = {
    "email": (
        "Write a professional cold outreach EMAIL. "
        "Include a subject line prefixed with 'Subject: ' on the first line, "
        "then a blank line, then the email body. "
        "Keep it under 200 words. Be personalized, not spammy."
    ),
    "sms": (
        "Write a SHORT cold outreach SMS message. "
        "Maximum 160 characters. No emojis unless natural. "
        "Be direct, friendly, and include a clear call-to-action. "
        "Do NOT include a subject line."
    ),
    "whatsapp": (
        "Write a friendly WhatsApp outreach message. "
        "Keep it under 300 characters. Conversational tone. "
        "You may use 1-2 relevant emojis. "
        "Do NOT include a subject line."
    ),
    "facebook": (
        "Write a short Facebook DM for cold outreach. "
        "Keep it under 250 characters. Friendly and not salesy. "
        "Do NOT include a subject line."
    ),
    "instagram": (
        "Write a short Instagram DM for cold outreach. "
        "Keep it under 200 characters. Casual and engaging tone. "
        "Do NOT include a subject line."
    ),
    "linkedin": (
        "Write a professional LinkedIn DM for cold outreach. "
        "Keep it under 300 characters. Emphasize value and credibility. "
        "Do NOT include a subject line."
    ),
    "twitter": (
        "Write a Twitter/X DM for cold outreach. "
        "Keep it under 280 characters. Casual and punchy. "
        "Do NOT include a subject line."
    ),
    "tiktok": (
        "Write a TikTok DM for cold outreach. "
        "Keep it under 200 characters. Youthful, energetic tone. "
        "Do NOT include a subject line."
    ),
    "youtube": (
        "Write a YouTube DM (community message) for cold outreach. "
        "Keep it under 300 characters. Professional but approachable. "
        "Do NOT include a subject line."
    ),
    "snapchat": (
        "Write a Snapchat DM for cold outreach. "
        "Keep it under 160 characters. Fun and brief. "
        "Do NOT include a subject line."
    ),
}

DEFAULT_CHANNEL_RULE = (
    "Write a professional cold outreach message. "
    "Keep it concise and personalized. No subject line."
)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(client, lead, channel: str, step=None) -> tuple[str, str]:
    """Return (system_prompt, user_prompt)."""

    # System prompt: who the AI is
    system_parts = [
        f"You are an expert outreach copywriter working for '{client.name}'.",
    ]
    if client.business_type:
        system_parts.append(f"Business type: {client.business_type}.")
    if client.services:
        system_parts.append(f"Services offered: {client.services}.")
    if client.target_audience:
        system_parts.append(f"Target audience: {client.target_audience}.")
    if client.pitch:
        system_parts.append(f"Value proposition: {client.pitch}.")
    if client.tone:
        system_parts.append(f"Tone: {client.tone}.")
    if client.custom_instructions:
        system_parts.append(f"Additional instructions: {client.custom_instructions}")

    system_prompt = " ".join(system_parts)

    # User prompt: what to write + lead context
    channel_rule = CHANNEL_RULES.get(channel, DEFAULT_CHANNEL_RULE)

    lead_parts = []
    if lead.business_name:
        lead_parts.append(f"Business: {lead.business_name}")
    if lead.address:
        lead_parts.append(f"Location: {lead.address}")
    if lead.website:
        lead_parts.append(f"Website: {lead.website}")
    if lead.rating:
        lead_parts.append(f"Rating: {lead.rating}/5 ({lead.reviews or 0} reviews)")

    lead_context = ", ".join(lead_parts) if lead_parts else "Unknown prospect"

    # Step override
    if step and getattr(step, "ai_prompt_override", None):
        extra = f"\n\nAdditional instruction: {step.ai_prompt_override}"
    else:
        extra = ""

    user_prompt = (
        f"{channel_rule}\n\n"
        f"Prospect details: {lead_context}{extra}\n\n"
        f"Write the {channel} message now. Output ONLY the message text."
    )

    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Key selector
# ---------------------------------------------------------------------------

async def _get_usable_keys(db: AsyncSession) -> list[AiApiKey]:
    """Return active, non-exhausted, non-error keys ordered by priority then usage."""
    result = await db.execute(
        select(AiApiKey)
        .where(
            AiApiKey.is_active == True,  # noqa: E712
            AiApiKey.health_status != "error",
        )
        .order_by(AiApiKey.priority.asc(), AiApiKey.requests_today.asc())
    )
    keys = list(result.scalars().all())
    # Filter out exhausted keys
    return [k for k in keys if k.requests_today < k.daily_limit]


async def _increment_counter(key: AiApiKey, db: AsyncSession) -> None:
    await db.execute(
        update(AiApiKey)
        .where(AiApiKey.id == key.id)
        .values(requests_today=AiApiKey.requests_today + 1)
    )


async def _mark_error(key: AiApiKey, error_msg: str, db: AsyncSession) -> None:
    await db.execute(
        update(AiApiKey)
        .where(AiApiKey.id == key.id)
        .values(
            last_error=error_msg[:500],
            health_status="error",
            last_health_check=datetime.now(timezone.utc),
        )
    )


# ---------------------------------------------------------------------------
# Core LLM call (OpenAI-compatible)
# ---------------------------------------------------------------------------

async def _call_llm(key: AiApiKey, system_prompt: str, user_prompt: str) -> str:
    """Call the provider. Returns generated text or raises on failure."""
    raw_key = decrypt_value(key.api_key_encrypted)
    url = f"{key.base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {raw_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": key.model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 512,
        "temperature": 0.8,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=body)

    if resp.status_code == 200:
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

    # Map status codes to meaningful errors
    if resp.status_code == 429:
        raise RuntimeError(f"rate_limited: {resp.text[:200]}")
    if resp.status_code in (401, 403):
        raise RuntimeError(f"auth_error: {resp.text[:200]}")
    raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_message(client, lead, channel: str, step=None, db: AsyncSession = None) -> str:
    """
    Generate an outreach message using the best available AI key.
    Rotates through keys on failure.
    Returns the generated message string.
    Raises RuntimeError if all keys fail or none are available.
    """
    if db is None:
        raise ValueError("db session is required")

    keys = await _get_usable_keys(db)
    if not keys:
        raise RuntimeError("No usable AI keys available. Add keys via /settings/ai-keys.")

    system_prompt, user_prompt = _build_prompt(client, lead, channel, step)

    last_error = None
    for key in keys:
        try:
            text = await _call_llm(key, system_prompt, user_prompt)
            await _increment_counter(key, db)
            return text
        except RuntimeError as e:
            err_str = str(e)
            last_error = err_str

            if err_str.startswith("rate_limited"):
                await db.execute(
                    update(AiApiKey)
                    .where(AiApiKey.id == key.id)
                    .values(health_status="rate_limited", last_error=err_str[:500])
                )
            elif err_str.startswith("auth_error"):
                await _mark_error(key, err_str, db)
            else:
                await _mark_error(key, err_str, db)
            # Try next key
            continue
        except Exception as e:
            last_error = str(e)[:300]
            await _mark_error(key, last_error, db)
            continue

    raise RuntimeError(f"All AI keys failed. Last error: {last_error}")


async def draft_template(
    client,
    channel: str,
    custom_instruction: str | None,
    db: AsyncSession,
) -> str:
    """
    Generate a reusable message template draft based on client profile only.
    Uses {business_name}, {website} etc. as placeholders — NOT a real lead.
    Called once by the user when building a campaign step.
    """
    keys = await _get_usable_keys(db)
    if not keys:
        raise RuntimeError("No usable AI keys available. Add keys via Settings → AI Keys.")

    channel_rule = CHANNEL_RULES.get(channel, DEFAULT_CHANNEL_RULE)

    system_parts = [
        f"You are an expert outreach copywriter working for '{client.name}'.",
    ]
    if client.business_type:
        system_parts.append(f"Business type: {client.business_type}.")
    if client.services:
        system_parts.append(f"Services offered: {client.services}.")
    if client.target_audience:
        system_parts.append(f"Target audience: {client.target_audience}.")
    if client.pitch:
        system_parts.append(f"Value proposition: {client.pitch}.")
    if client.tone:
        system_parts.append(f"Tone: {client.tone}.")
    if client.custom_instructions:
        system_parts.append(f"Additional instructions: {client.custom_instructions}")
    system_prompt = " ".join(system_parts)

    extra = f"\n\nAdditional instruction: {custom_instruction}" if custom_instruction else ""

    user_prompt = (
        f"{channel_rule}{extra}\n\n"
        f"Write a reusable template using these exact placeholder tokens where appropriate: "
        f"{{business_name}}, {{address}}, {{phone}}, {{email}}, {{website}}. "
        f"Output ONLY the message text with placeholders. Do NOT fill in real values."
    )

    last_error = None
    for key in keys:
        try:
            text = await _call_llm(key, system_prompt, user_prompt)
            await _increment_counter(key, db)
            return text
        except RuntimeError as e:
            last_error = str(e)
            if str(e).startswith("auth_error"):
                await _mark_error(key, last_error, db)
            continue
        except Exception as e:
            last_error = str(e)[:300]
            await _mark_error(key, last_error, db)
            continue

    raise RuntimeError(f"All AI keys failed. Last error: {last_error}")


async def generate_reply_draft(
    client,
    lead,
    channel: str,
    inbound_content: str,
    history: list,
    db: AsyncSession,
) -> str:
    """
    Generate an AI reply to an inbound message.
    Uses conversation history for context.
    """
    keys = await _get_usable_keys(db)
    if not keys:
        raise RuntimeError("No usable AI keys available")

    # Build history context
    history_text = ""
    for msg in history[-6:]:  # last 6 messages for context
        role = "Lead" if msg.direction == "inbound" else "Us"
        history_text += f"{role}: {msg.content}\n"

    client_name = getattr(client, "name", "our company") if client else "our company"
    lead_name = getattr(lead, "business_name", "there") if lead else "there"

    system_prompt = (
        f"You are a helpful sales assistant for {client_name}. "
        f"You are replying to an inbound message from {lead_name} via {channel}. "
        "Be professional, friendly and concise. "
        "Match the channel's tone and length limits."
    )
    user_prompt = (
        f"Conversation history:\n{history_text}\n"
        f"New inbound message: {inbound_content}\n\n"
        f"Write a reply via {channel}."
    )

    last_error = None
    for key in keys:
        try:
            text = await _call_llm(key, system_prompt, user_prompt)
            await _increment_counter(key, db)
            return text
        except Exception as e:
            last_error = str(e)[:300]
            await _mark_error(key, last_error, db)
            continue

    raise RuntimeError(f"All AI keys failed generating reply. Last error: {last_error}")

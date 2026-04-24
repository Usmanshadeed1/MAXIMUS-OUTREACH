"""Service: WhatsApp sending via Meta Cloud API."""
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.whatsapp_settings_service import get_number_for_client, get_settings
from app.utils.encryption import decrypt_value

META_API_VERSION = "v19.0"
META_BASE_URL = "https://graph.facebook.com"

# Media types supported by WhatsApp Cloud API
MEDIA_TYPE_MAP = {
    "image": "image",
    "video": "video",
    "document": "document",
    "audio": "audio",
}


async def send_whatsapp(
    to: str,
    body: str,
    client_id: uuid.UUID,
    db: AsyncSession,
    *,
    media_url: str | None = None,
    media_type: str | None = None,
    media_caption: str | None = None,
    use_template: bool = False,
    template_name: str = "hello_world",
    template_language: str = "en_US",
) -> dict:
    """
    Send a WhatsApp message via Meta Cloud API.

    - use_template=True  → sends an approved template (required for first contact)
    - use_template=False → sends freeform text/media (only allowed in 24h reply window)

    Returns:
        {
            "success": bool,
            "message_id": str | None,
            "phone_number_id": str | None,
            "error": str | None,
        }
    """
    # ── Load global credentials ────────────────────────────────────────────
    settings = await get_settings(db)
    if settings is None:
        return {"success": False, "message_id": None, "phone_number_id": None, "error": "WhatsApp not configured."}

    # ── Pick phone number for this client ──────────────────────────────────
    phone_number = await get_number_for_client(client_id, db)
    if phone_number is None:
        return {
            "success": False,
            "message_id": None,
            "phone_number_id": None,
            "error": "No active WhatsApp number available for this client (daily limit may be reached).",
        }

    token = decrypt_value(settings.access_token_encrypted)
    pid = phone_number.phone_number_id
    url = f"{META_BASE_URL}/{META_API_VERSION}/{pid}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # ── Build request payload ──────────────────────────────────────────────
    if use_template:
        payload = _build_template_payload(to, template_name, template_language)
    elif media_url and media_type in MEDIA_TYPE_MAP:
        payload = _build_media_payload(to, media_url, media_type, body or media_caption)
    else:
        payload = _build_text_payload(to, body)

    # ── Send ───────────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code in (200, 201):
            data = resp.json()
            message_id = None
            messages = data.get("messages")
            if messages and isinstance(messages, list):
                message_id = messages[0].get("id")

            # Increment sent_today counter
            phone_number.sent_today += 1

            return {
                "success": True,
                "message_id": message_id,
                "phone_number_id": pid,
                "error": None,
            }
        else:
            error_data = resp.json()
            error_msg = error_data.get("error", {}).get("message", f"HTTP {resp.status_code}")
            return {
                "success": False,
                "message_id": None,
                "phone_number_id": pid,
                "error": error_msg,
            }

    except Exception as exc:
        return {
            "success": False,
            "message_id": None,
            "phone_number_id": pid,
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------

def _build_text_payload(to: str, body: str) -> dict:
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }


def _build_template_payload(to: str, template_name: str, language_code: str) -> dict:
    return {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }


def _build_media_payload(to: str, media_url: str, media_type: str, caption: str | None) -> dict:
    media_block: dict = {"link": media_url}
    if caption and media_type in ("image", "video", "document"):
        media_block["caption"] = caption

    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": media_type,
        media_type: media_block,
    }

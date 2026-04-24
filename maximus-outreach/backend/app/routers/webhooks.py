"""Incoming webhook handlers — SMS (Twilio/Telnyx) and WhatsApp (Meta)."""
import base64
import hashlib
import hmac
import json
import logging
import re
import urllib.parse

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign import CampaignEnrollment
from app.models.conversation import Conversation, Message
from app.models.lead import Lead
from app.services.sms_settings_service import (
    get_number_for_client,
    get_provider,
)
from app.services.sms_settings_service import list_numbers as list_all_numbers
from app.models.settings import WhatsAppPhoneNumber
from app.services.whatsapp_settings_service import get_settings as get_wa_settings
from app.utils.encryption import decrypt_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/sms", tags=["Webhooks: SMS"])
wa_router = APIRouter(prefix="/webhooks/whatsapp", tags=["Webhooks: WhatsApp"])


# ---------------------------------------------------------------------------
# Signature validation helpers
# ---------------------------------------------------------------------------

def _twilio_expected_signature(auth_token: str, url: str, params: dict[str, str]) -> str:
    """Compute the expected X-Twilio-Signature value."""
    # Sort POST params alphabetically, append key+value to URL
    s = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    mac = hmac.new(auth_token.encode("utf-8"), s.encode("utf-8"), hashlib.sha1)
    return base64.b64encode(mac.digest()).decode("utf-8")


def _verify_telnyx_signature(
    public_key_pem: str, raw_body: bytes, signature_header: str
) -> bool:
    """
    Verify a Telnyx Ed25519 webhook signature.

    Header format: ``t=<timestamp>,v1=<base64_signature>``
    Signed payload: ``<timestamp>|<raw_body_as_string>``
    """
    try:
        timestamp = ""
        sig_b64 = ""
        for part in signature_header.split(","):
            if part.startswith("t="):
                timestamp = part[2:]
            elif part.startswith("v1="):
                sig_b64 = part[3:]
        if not timestamp or not sig_b64:
            return False

        signed_payload = f"{timestamp}|{raw_body.decode('utf-8')}".encode("utf-8")
        signature = base64.b64decode(sig_b64)

        key: Ed25519PublicKey = load_pem_public_key(public_key_pem.encode("utf-8"))  # type: ignore[assignment]
        key.verify(signature, signed_payload)
        return True
    except (InvalidSignature, Exception):
        return False


# ---------------------------------------------------------------------------
# Shared processing logic
# ---------------------------------------------------------------------------

def _normalize_phone(phone: str) -> str:
    """Strip non-digits, return last 10."""
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else digits


async def _find_number_client(to_phone: str, db: AsyncSession):
    """Return the SmsPhoneNumber row matching `to_phone`, or None."""
    from app.models.settings import SmsPhoneNumber
    normalized = _normalize_phone(to_phone)
    result = await db.execute(
        select(SmsPhoneNumber).where(SmsPhoneNumber.is_active == True)  # noqa: E712
    )
    for num in result.scalars().all():
        if _normalize_phone(num.phone_number) == normalized:
            return num
    return None


async def _find_lead_by_phone(from_phone: str, client_id, db: AsyncSession) -> Lead | None:
    """Match `from_phone` to a lead in the given client, normalizing digits."""
    normalized = _normalize_phone(from_phone)
    result = await db.execute(
        select(Lead).where(Lead.client_id == client_id)
    )
    for lead in result.scalars().all():
        if lead.phone and _normalize_phone(lead.phone) == normalized:
            return lead
    return None


async def _find_lead_globally(from_phone: str, db: AsyncSession) -> Lead | None:
    """Match `from_phone` to any lead across all clients (used for pool numbers)."""
    normalized = _normalize_phone(from_phone)
    result = await db.execute(select(Lead))
    for lead in result.scalars().all():
        if lead.phone and _normalize_phone(lead.phone) == normalized:
            return lead
    return None


async def _process_incoming_sms(
    to_phone: str,
    from_phone: str,
    body: str,
    provider_sid: str | None,
    db: AsyncSession,
) -> dict:
    """
    Core handler called by both Twilio and Telnyx endpoints.

    1. Match `to_phone` → SmsPhoneNumber → client_id
    2. Match `from_phone` → Lead (by phone)
    3. Stop active campaign enrollments for that lead
    4. Create/open Conversation + inbound Message
    5. Update lead status to "replied"
    6. Create AI draft (placeholder) outbound message

    Returns a summary dict (for logging / test assertions).
    """
    # 1. Find which client owns this phone number
    phone_record = await _find_number_client(to_phone, db)
    if phone_record is None:
        logger.warning("Incoming SMS to unknown number: %s", to_phone)
        return {"matched": False, "reason": "unknown_to_number"}

    client_id = phone_record.client_id

    # 2. Find lead — search within client if assigned, globally if pool number
    if client_id is not None:
        lead = await _find_lead_by_phone(from_phone, client_id, db)
    else:
        logger.info("Incoming SMS to pool number %s — searching all clients", to_phone)
        lead = await _find_lead_globally(from_phone, db)
        if lead is not None:
            client_id = lead.client_id
        else:
            logger.warning("Incoming SMS from unknown number on pool line: %s", from_phone)
            return {"matched": False, "reason": "lead_not_found_in_pool"}

    # 3. Stop active campaign enrollments (if lead found and campaign has stop_on_reply=True)
    enrollments_stopped = 0
    if lead is not None:
        result = await db.execute(
            select(CampaignEnrollment)
            .where(
                CampaignEnrollment.lead_id == lead.id,
                CampaignEnrollment.status.in_(["queued", "active", "paused"]),
            )
        )
        for enrollment in result.scalars().all():
            enrollment.status = "stopped"
            enrollments_stopped += 1

    # 4. Create or reopen Conversation
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.lead_id == (lead.id if lead else None),
            Conversation.client_id == client_id,
            Conversation.channel == "sms",
            Conversation.status == "open",
        ).limit(1)
    )
    conversation = conv_result.scalar_one_or_none()

    if conversation is None:
        conversation = Conversation(
            lead_id=lead.id if lead else None,
            client_id=client_id,
            channel="sms",
            status="open",
        )
        db.add(conversation)
        await db.flush()

    # 5. Store inbound message
    inbound_msg = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=body,
        is_ai_generated=False,
        is_approved=True,
    )
    db.add(inbound_msg)

    # 6. Update lead status
    if lead is not None:
        lead.status = "replied"

    # 7. AI draft placeholder (pending review)
    draft_content = (
        "Thank you for your message! We'll get back to you shortly."
    )
    draft_msg = Message(
        conversation_id=conversation.id,
        direction="outbound",
        content=draft_content,
        is_ai_generated=True,
        is_approved=False,
    )
    db.add(draft_msg)

    await db.flush()

    return {
        "matched": True,
        "lead_id": str(lead.id) if lead else None,
        "client_id": str(client_id),
        "conversation_id": str(conversation.id),
        "enrollments_stopped": enrollments_stopped,
        "draft_created": True,
        "provider_sid": provider_sid,
    }


# ---------------------------------------------------------------------------
# Twilio endpoint
# ---------------------------------------------------------------------------

@router.post("/twilio")
async def twilio_incoming(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive incoming SMS from Twilio.
    Validates X-Twilio-Signature using the stored auth token.
    Responds with 200 + empty TwiML (no auto-reply).
    """
    raw_body = await request.body()
    form = await request.form()
    params = {k: v for k, v in form.items()}

    # Validate signature
    provider = await get_provider(db)
    if provider and provider.provider == "twilio" and provider.twilio_auth_token_encrypted:
        auth_token = decrypt_value(provider.twilio_auth_token_encrypted)
        twilio_sig = request.headers.get("X-Twilio-Signature", "")
        # Use the full URL as seen by Twilio
        url = str(request.url)
        expected = _twilio_expected_signature(auth_token, url, params)
        if not hmac.compare_digest(twilio_sig, expected):
            logger.warning("Twilio signature validation failed")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio signature",
            )

    to_phone = params.get("To", "")
    from_phone = params.get("From", "")
    body = params.get("Body", "")
    sid = params.get("MessageSid")

    result = await _process_incoming_sms(to_phone, from_phone, body, sid, db)
    await db.commit()

    logger.info("Twilio webhook processed: %s", result)

    # Return empty TwiML — Twilio requires a valid XML response
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
        status_code=200,
    )


# ---------------------------------------------------------------------------
# Telnyx endpoint
# ---------------------------------------------------------------------------

@router.post("/telnyx")
async def telnyx_incoming(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive incoming SMS from Telnyx.
    Validates telnyx-signature-ed25519 using the stored Ed25519 public key.
    Responds with 200.
    """
    raw_body = await request.body()

    # Validate Ed25519 signature if public key is configured
    provider = await get_provider(db)
    if provider and provider.telnyx_webhook_public_key:
        sig_header = request.headers.get("telnyx-signature-ed25519", "")
        if not sig_header:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing telnyx-signature-ed25519 header",
            )
        if not _verify_telnyx_signature(provider.telnyx_webhook_public_key, raw_body, sig_header):
            logger.warning("Telnyx signature validation failed")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Telnyx signature",
            )

    import json
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    event_type = payload.get("data", {}).get("event_type", "")
    if event_type != "message.received":
        # Acknowledge non-SMS events without processing
        return {"received": True, "event_type": event_type}

    data_payload = payload.get("data", {}).get("payload", {})
    to_list = data_payload.get("to", [{}])
    to_phone = to_list[0].get("phone_number", "") if to_list else ""
    from_phone = data_payload.get("from", {}).get("phone_number", "")
    body = data_payload.get("text", "")
    sid = data_payload.get("id")

    result = await _process_incoming_sms(to_phone, from_phone, body, sid, db)
    await db.commit()

    logger.info("Telnyx webhook processed: %s", result)
    return {"received": True}


# ---------------------------------------------------------------------------
# WhatsApp webhook helpers
# ---------------------------------------------------------------------------

def _verify_meta_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Validate X-Hub-Signature-256 from Meta.
    Header format: ``sha256=<hex_digest>``
    """
    if not signature_header.startswith("sha256="):
        return False
    expected_hex = signature_header[7:]
    mac = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), expected_hex)


async def _find_wa_number_client(display_phone: str, db: AsyncSession):
    """Match `display_phone` to an active WhatsAppPhoneNumber row, return it or None."""
    normalized = _normalize_phone(display_phone)
    result = await db.execute(
        select(WhatsAppPhoneNumber).where(WhatsAppPhoneNumber.is_active == True)  # noqa: E712
    )
    for num in result.scalars().all():
        if num.display_phone_number and _normalize_phone(num.display_phone_number) == normalized:
            return num
    return None


async def _process_incoming_whatsapp(
    to_display_phone: str,
    from_wa_id: str,
    body: str,
    message_id: str | None,
    db: AsyncSession,
) -> dict:
    """
    Core handler for incoming WhatsApp messages.

    1. Match `to_display_phone` → WhatsAppPhoneNumber → client_id
    2. Match `from_wa_id` (phone digits) → Lead (by phone)
    3. Stop active campaign enrollments for that lead
    4. Create/open Conversation (channel='whatsapp') + inbound Message
    5. Update lead status to 'replied'
    6. Create AI draft (pending review)
    """
    # 1. Find which client owns this WA number
    phone_record = await _find_wa_number_client(to_display_phone, db)
    if phone_record is None:
        logger.warning("Incoming WhatsApp to unknown number: %s", to_display_phone)
        return {"matched": False, "reason": "unknown_to_number"}

    client_id = phone_record.client_id

    # 2. Find lead — search within client if assigned, globally if pool number
    if client_id is not None:
        lead = await _find_lead_by_phone(from_wa_id, client_id, db)
    else:
        logger.info("Incoming WhatsApp to pool number %s — searching all clients", to_display_phone)
        lead = await _find_lead_globally(from_wa_id, db)
        if lead is not None:
            client_id = lead.client_id
        else:
            logger.warning("Incoming WhatsApp from unknown number on pool line: %s", from_wa_id)
            return {"matched": False, "reason": "lead_not_found_in_pool"}

    # 3. Stop active campaign enrollments
    enrollments_stopped = 0
    if lead is not None:
        result = await db.execute(
            select(CampaignEnrollment)
            .where(
                CampaignEnrollment.lead_id == lead.id,
                CampaignEnrollment.status.in_(["queued", "active", "paused"]),
            )
        )
        for enrollment in result.scalars().all():
            enrollment.status = "stopped"
            enrollments_stopped += 1

    # 4. Create or reopen Conversation
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.lead_id == (lead.id if lead else None),
            Conversation.client_id == client_id,
            Conversation.channel == "whatsapp",
            Conversation.status == "open",
        ).limit(1)
    )
    conversation = conv_result.scalar_one_or_none()

    if conversation is None:
        conversation = Conversation(
            lead_id=lead.id if lead else None,
            client_id=client_id,
            channel="whatsapp",
            status="open",
        )
        db.add(conversation)
        await db.flush()

    # 5. Store inbound message
    inbound_msg = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=body,
        is_ai_generated=False,
        is_approved=True,
    )
    db.add(inbound_msg)

    # 6. Update lead status
    if lead is not None:
        lead.status = "replied"

    # 7. AI draft placeholder
    draft_msg = Message(
        conversation_id=conversation.id,
        direction="outbound",
        content="Thank you for your message! We'll get back to you shortly.",
        is_ai_generated=True,
        is_approved=False,
    )
    db.add(draft_msg)
    await db.flush()

    return {
        "matched": True,
        "lead_id": str(lead.id) if lead else None,
        "client_id": str(client_id),
        "conversation_id": str(conversation.id),
        "enrollments_stopped": enrollments_stopped,
        "draft_created": True,
        "message_id": message_id,
    }


# ---------------------------------------------------------------------------
# WhatsApp — GET (Meta hub verification challenge)
# ---------------------------------------------------------------------------

@wa_router.get("/incoming")
async def whatsapp_verify(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Meta sends a GET request to verify the webhook URL.
    Query params: hub.mode, hub.verify_token, hub.challenge
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode != "subscribe" or not token or not challenge:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification request")

    settings = await get_wa_settings(db)
    if settings is None or settings.webhook_verify_token != token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify token mismatch")

    # Return the challenge as plain text — Meta requires this exactly
    return Response(content=challenge, media_type="text/plain", status_code=200)


# ---------------------------------------------------------------------------
# WhatsApp — POST (incoming messages from Meta)
# ---------------------------------------------------------------------------

@wa_router.post("/incoming")
async def whatsapp_incoming(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive incoming WhatsApp messages from Meta Cloud API.
    Validates X-Hub-Signature-256 using the stored webhook_verify_token.
    """
    raw_body = await request.body()

    # Validate Meta HMAC-SHA256 signature if settings are configured
    settings = await get_wa_settings(db)
    if settings and settings.webhook_verify_token:
        sig_header = request.headers.get("X-Hub-Signature-256", "")
        if sig_header and not _verify_meta_signature(raw_body, sig_header, settings.webhook_verify_token):
            logger.warning("WhatsApp Meta signature validation failed")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Meta signature",
            )

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    # Meta always expects 200 OK quickly — process and ack
    # Payload structure: {object, entry:[{changes:[{value:{messages:[...], metadata:{display_phone_number}}}]}]}
    object_type = payload.get("object", "")
    if object_type != "whatsapp_business_account":
        return {"received": True, "object": object_type}

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            if not messages:
                continue

            metadata = value.get("metadata", {})
            to_display_phone = metadata.get("display_phone_number", "")

            for msg in messages:
                if msg.get("type") != "text":
                    # Acknowledge non-text messages (images, audio, etc.) without processing
                    continue

                from_wa_id = msg.get("from", "")  # sender's WhatsApp ID (digits)
                message_id = msg.get("id")
                body = msg.get("text", {}).get("body", "")

                result = await _process_incoming_whatsapp(
                    to_display_phone, from_wa_id, body, message_id, db
                )
                await db.commit()
                logger.info("WhatsApp webhook processed: %s", result)

    return {"received": True}

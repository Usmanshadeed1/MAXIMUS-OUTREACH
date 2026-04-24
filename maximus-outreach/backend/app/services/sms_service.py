"""Service: SMS sending — email-to-SMS (free) → Twilio/Telnyx (paid fallback)."""
import re
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import email_service, sms_settings_service
from app.utils.encryption import decrypt_value

# ---------------------------------------------------------------------------
# Carrier email-to-SMS gateway table
# Carrier name (lowercase, spaces → underscores) → gateway domain
# ---------------------------------------------------------------------------
CARRIER_GATEWAYS: dict[str, str] = {
    # AT&T
    "att": "txt.att.net",
    "at&t": "txt.att.net",
    # T-Mobile
    "t_mobile": "tmomail.net",
    "tmobile": "tmomail.net",
    "t-mobile": "tmomail.net",
    # Verizon
    "verizon": "vtext.com",
    # Sprint
    "sprint": "messaging.sprintpcs.com",
    # US Cellular
    "us_cellular": "email.uscc.net",
    "uscellular": "email.uscc.net",
    # Boost Mobile
    "boost": "sms.myboostmobile.com",
    "boost_mobile": "sms.myboostmobile.com",
    # Cricket Wireless
    "cricket": "sms.cricketwireless.net",
    "cricket_wireless": "sms.cricketwireless.net",
    # Metro PCS / T-Mobile
    "metropcs": "mymetropcs.com",
    "metro_pcs": "mymetropcs.com",
    "metro": "mymetropcs.com",
    # TracFone
    "tracfone": "mmst5.tracfone.com",
    # Straight Talk
    "straight_talk": "vtext.com",
    "straighttalk": "vtext.com",
    # Republic Wireless
    "republic": "text.republicwireless.com",
    "republic_wireless": "text.republicwireless.com",
    # Google Fi
    "google_fi": "msg.fi.google.com",
    "googlefi": "msg.fi.google.com",
    "fi": "msg.fi.google.com",
    # Consumer Cellular
    "consumer_cellular": "mailmymobile.net",
    "consumercellular": "mailmymobile.net",
    # Xfinity Mobile
    "xfinity": "vtext.com",
    "xfinity_mobile": "vtext.com",
    # Visible (Verizon MVNO)
    "visible": "vsblmessage.com",
    # Mint Mobile
    "mint": "tmomail.net",
    "mint_mobile": "tmomail.net",
}


def _normalize_phone(phone: str) -> str:
    """Strip all non-digits and return the last 10 digits."""
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else digits


def _carrier_key(carrier: str) -> str:
    """Normalize a carrier name to a lookup key."""
    return carrier.strip().lower().replace(" ", "_")


def _build_email_to_sms_address(phone: str, carrier: str) -> str | None:
    """Return the email-to-SMS gateway address, or None if carrier unknown."""
    key = _carrier_key(carrier)
    gateway = CARRIER_GATEWAYS.get(key)
    if not gateway:
        return None
    digits = _normalize_phone(phone)
    return f"{digits}@{gateway}"


# ---------------------------------------------------------------------------
# Main send_sms function
# ---------------------------------------------------------------------------

async def send_sms(
    to: str,
    body: str,
    client_id: uuid.UUID,
    db: AsyncSession,
    *,
    lead_carrier: str | None = None,
) -> dict:
    """
    Send an SMS message.

    Step 1 (free): If lead_carrier is known, attempt email-to-SMS via SMTP.
    Step 2 (paid): If step 1 skipped or failed, send via Twilio or Telnyx.

    Returns:
        {
            "success": bool,
            "method": "email_to_sms" | "twilio" | "telnyx" | "failed",
            "sid": str | None,
            "from_number": str | None,
            "error": str | None,
        }
    """
    # ── Step 1: Email-to-SMS (free path) ──────────────────────────────────
    if lead_carrier and lead_carrier.lower() not in ("unknown", ""):
        gateway_address = _build_email_to_sms_address(to, lead_carrier)
        if gateway_address:
            result = await email_service.send_email(
                to=gateway_address,
                subject="",  # Most gateways ignore subject; body goes as SMS
                body_html=f"<p>{body}</p>",
                body_text=body,
                db=db,
            )
            if result["success"]:
                return {
                    "success": True,
                    "method": "email_to_sms",
                    "sid": result.get("message_id"),
                    "from_number": None,
                    "error": None,
                }
            # Email failed — fall through to paid path
            email_error = result.get("error", "email-to-SMS failed")
        else:
            email_error = f"Unknown carrier: {lead_carrier}"
    else:
        email_error = None

    # ── Step 2: Paid SMS provider ──────────────────────────────────────────
    provider_record = await sms_settings_service.get_provider(db)
    if provider_record is None or not provider_record.is_active:
        return {
            "success": False,
            "method": "failed",
            "sid": None,
            "from_number": None,
            "error": email_error or "No SMS provider configured",
        }

    number = await sms_settings_service.get_number_for_client(client_id, db)
    if number is None:
        return {
            "success": False,
            "method": "failed",
            "sid": None,
            "from_number": None,
            "error": email_error or "No SMS phone number available for this client",
        }

    if number.sent_today >= number.daily_limit:
        return {
            "success": False,
            "method": "failed",
            "sid": None,
            "from_number": number.phone_number,
            "error": f"Daily SMS limit reached ({number.sent_today}/{number.daily_limit})",
        }

    if provider_record.provider == "twilio":
        send_result = await _send_twilio(
            provider=provider_record,
            from_number=number.phone_number,
            to=to,
            body=body,
        )
    elif provider_record.provider == "telnyx":
        send_result = await _send_telnyx(
            provider=provider_record,
            from_number=number.phone_number,
            to=to,
            body=body,
        )
    else:
        return {
            "success": False,
            "method": "failed",
            "sid": None,
            "from_number": number.phone_number,
            "error": f"Unknown provider: {provider_record.provider}",
        }

    if send_result["success"]:
        number.sent_today += 1
        await db.flush()

    return {
        "success": send_result["success"],
        "method": provider_record.provider,
        "sid": send_result.get("sid"),
        "from_number": number.phone_number,
        "error": send_result.get("error"),
    }


# ---------------------------------------------------------------------------
# Provider dispatch helpers
# ---------------------------------------------------------------------------

async def _send_twilio(provider, from_number: str, to: str, body: str) -> dict:
    if not provider.twilio_account_sid or not provider.twilio_auth_token_encrypted:
        return {"success": False, "error": "Twilio credentials missing"}
    token = decrypt_value(provider.twilio_auth_token_encrypted)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{provider.twilio_account_sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                auth=(provider.twilio_account_sid, token),
                data={"To": to, "From": from_number, "Body": body},
            )
        data = resp.json()
        if resp.status_code in (200, 201):
            return {"success": True, "sid": data.get("sid")}
        return {"success": False, "error": f"Twilio {resp.status_code}: {data.get('message', resp.text[:200])}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def _send_telnyx(provider, from_number: str, to: str, body: str) -> dict:
    if not provider.telnyx_api_key_encrypted:
        return {"success": False, "error": "Telnyx API key missing"}
    key = decrypt_value(provider.telnyx_api_key_encrypted)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.telnyx.com/v2/messages",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={"from": from_number, "to": to, "text": body},
            )
        data = resp.json()
        if resp.status_code in (200, 202):
            sid = data.get("data", {}).get("id")
            return {"success": True, "sid": sid}
        return {"success": False, "error": f"Telnyx {resp.status_code}: {data.get('errors', resp.text[:200])}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}

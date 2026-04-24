"""Service: Email sending via SMTP with tracking pixel + link rewriting."""
import re
import uuid
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.settings import SmtpSettings
from app.utils.encryption import decrypt_value


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tracking_pixel_html(message_id: str) -> str:
    """Return a 1x1 transparent tracking pixel img tag."""
    url = f"{settings.TRACKING_BASE_URL}/track/open/{message_id}"
    return (
        f'<img src="{url}" width="1" height="1" '
        'style="display:none;border:0;" alt="" />'
    )


def _rewrite_links(html: str, message_id: str) -> str:
    """Wrap all href links for click tracking."""
    base = settings.TRACKING_BASE_URL

    def replace_link(m: re.Match) -> str:
        original_url = m.group(1)
        # Skip mailto, tel, anchor, and already-rewritten tracking links
        if original_url.startswith(("mailto:", "tel:", "#", f"{base}/track/")):
            return m.group(0)
        from urllib.parse import quote
        encoded = quote(original_url, safe="")
        tracked = f"{base}/track/click/{message_id}?url={encoded}"
        return f'href="{tracked}"'

    return re.sub(r'href="([^"]+)"', replace_link, html, flags=re.IGNORECASE)


def _inject_tracking(html: str, message_id: str) -> str:
    """Inject tracking pixel before </body> and rewrite links."""
    html = _rewrite_links(html, message_id)
    pixel = _tracking_pixel_html(message_id)
    if "</body>" in html.lower():
        idx = html.lower().rfind("</body>")
        html = html[:idx] + pixel + html[idx:]
    else:
        html += pixel
    return html


def _build_mime(
    to: str,
    from_email: str,
    from_name: str | None,
    subject: str,
    body_html: str,
    body_text: str | None,
    message_id: str,
    attachments: list[dict] | None,
) -> MIMEMultipart:
    """Build a MIME message with optional plain-text alternative and attachments."""
    msg = MIMEMultipart("mixed")
    sender = f"{from_name} <{from_email}>" if from_name else from_email
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = f"<{message_id}@maximus-outreach>"

    # Build HTML with tracking
    tracked_html = _inject_tracking(body_html, message_id)

    # Attach alternative part (text + html)
    alt = MIMEMultipart("alternative")
    if body_text:
        alt.attach(MIMEText(body_text, "plain", "utf-8"))
    alt.attach(MIMEText(tracked_html, "html", "utf-8"))
    msg.attach(alt)

    # Attachments: list of {"filename": str, "content": bytes, "mime_type": str}
    for att in (attachments or []):
        main_type, sub_type = att.get("mime_type", "application/octet-stream").split("/", 1)
        if main_type == "text":
            part: MIMEApplication | MIMEText = MIMEText(
                att["content"].decode("utf-8", errors="replace"), sub_type, "utf-8"
            )
        else:
            part = MIMEApplication(att["content"], _subtype=sub_type)
        part.add_header(
            "Content-Disposition", "attachment", filename=att["filename"]
        )
        msg.attach(part)

    return msg


# ---------------------------------------------------------------------------
# SMTP selection
# ---------------------------------------------------------------------------

async def _get_default_smtp(db: AsyncSession) -> SmtpSettings | None:
    """Return the default (or first active) SMTP account."""
    result = await db.execute(
        select(SmtpSettings)
        .where(SmtpSettings.is_active == True)  # noqa: E712
        .order_by(SmtpSettings.is_default.desc(), SmtpSettings.created_at)
    )
    return result.scalars().first()


# ---------------------------------------------------------------------------
# Daily limit check
# ---------------------------------------------------------------------------

def _effective_limit(smtp: SmtpSettings) -> int:
    """Return the effective daily send limit (warmup limit if warmup active)."""
    if smtp.warmup_enabled and smtp.warmup_current_daily_limit > 0:
        return smtp.warmup_current_daily_limit
    return smtp.daily_limit


async def _increment_sent_today(smtp: SmtpSettings, db: AsyncSession) -> None:
    await db.execute(
        update(SmtpSettings)
        .where(SmtpSettings.id == smtp.id)
        .values(sent_today=SmtpSettings.sent_today + 1)
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_email(
    to: str,
    subject: str,
    body_html: str,
    db: AsyncSession,
    *,
    from_email: str | None = None,
    from_name: str | None = None,
    body_text: str | None = None,
    attachments: list[dict] | None = None,
    smtp: SmtpSettings | None = None,
    message_id: str | None = None,
) -> dict:
    """
    Send an email via SMTP.

    Args:
        to: Recipient email address.
        subject: Email subject line.
        body_html: HTML body (tracking pixel + link rewriting applied automatically).
        db: Async DB session for limit check + counter increment.
        from_email: Sender address (defaults to SMTP account from_email).
        from_name: Sender display name (defaults to SMTP account from_name).
        body_text: Plain-text fallback (optional).
        attachments: List of {"filename", "content" (bytes), "mime_type"} dicts.
        smtp: Pre-fetched SmtpSettings (if None, default account is used).
        message_id: Tracking UUID (generated if not provided).

    Returns:
        {"success": bool, "message_id": str, "error": str | None}
    """
    msg_id = message_id or str(uuid.uuid4())

    # Select SMTP account
    if smtp is None:
        smtp = await _get_default_smtp(db)
    if smtp is None:
        return {"success": False, "message_id": msg_id, "error": "No active SMTP account configured"}

    # Daily limit check
    limit = _effective_limit(smtp)
    if smtp.sent_today >= limit:
        return {
            "success": False,
            "message_id": msg_id,
            "error": f"Daily send limit reached ({smtp.sent_today}/{limit})",
        }

    sender_email = from_email or smtp.from_email or smtp.username
    sender_name = from_name or smtp.from_name

    password = decrypt_value(smtp.password_encrypted)

    msg = _build_mime(
        to=to,
        from_email=sender_email,
        from_name=sender_name,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        message_id=msg_id,
        attachments=attachments,
    )

    try:
        if smtp.use_tls or smtp.port == 465:
            await aiosmtplib.send(
                msg,
                hostname=smtp.host,
                port=smtp.port,
                username=smtp.username,
                password=password,
                use_tls=True,
            )
        else:
            await aiosmtplib.send(
                msg,
                hostname=smtp.host,
                port=smtp.port,
                username=smtp.username,
                password=password,
                start_tls=True,
            )
    except Exception as exc:
        return {"success": False, "message_id": msg_id, "error": str(exc)}

    await _increment_sent_today(smtp, db)
    return {"success": True, "message_id": msg_id, "error": None}

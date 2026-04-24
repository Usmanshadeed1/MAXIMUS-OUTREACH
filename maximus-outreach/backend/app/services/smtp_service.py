"""Service: SMTP Settings CRUD + test send + warmup schedule generation."""
import time
import uuid
from datetime import date, datetime, timedelta, timezone

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import EmailWarmupSchedule, SmtpSettings
from app.schemas.settings import SmtpCreate, SmtpUpdate
from app.utils.encryption import decrypt_value, encrypt_value


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def list_smtp(db: AsyncSession) -> list[SmtpSettings]:
    result = await db.execute(
        select(SmtpSettings).order_by(SmtpSettings.is_default.desc(), SmtpSettings.created_at)
    )
    return list(result.scalars().all())


async def get_smtp_by_id(smtp_id: uuid.UUID, db: AsyncSession) -> SmtpSettings | None:
    result = await db.execute(select(SmtpSettings).where(SmtpSettings.id == smtp_id))
    return result.scalar_one_or_none()


async def create_smtp(payload: SmtpCreate, db: AsyncSession) -> SmtpSettings:
    # If new account is set as default, unset all others
    if payload.is_default:
        await _clear_default(db)

    smtp = SmtpSettings(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        password_encrypted=encrypt_value(payload.password),
        from_email=payload.from_email or payload.username,
        from_name=payload.from_name,
        use_tls=payload.use_tls,
        is_default=payload.is_default,
        daily_limit=payload.daily_limit,
        warmup_enabled=payload.warmup_enabled,
    )
    db.add(smtp)
    await db.flush()
    return smtp


async def update_smtp(smtp: SmtpSettings, payload: SmtpUpdate, db: AsyncSession) -> SmtpSettings:
    if payload.name is not None:
        smtp.name = payload.name
    if payload.host is not None:
        smtp.host = payload.host
    if payload.port is not None:
        smtp.port = payload.port
    if payload.username is not None:
        smtp.username = payload.username
    if payload.password is not None:
        smtp.password_encrypted = encrypt_value(payload.password)
    if payload.from_email is not None:
        smtp.from_email = payload.from_email
    if payload.from_name is not None:
        smtp.from_name = payload.from_name
    if payload.use_tls is not None:
        smtp.use_tls = payload.use_tls
    if payload.is_default is not None:
        if payload.is_default:
            await _clear_default(db)
        smtp.is_default = payload.is_default
    if payload.daily_limit is not None:
        smtp.daily_limit = payload.daily_limit
    if payload.warmup_enabled is not None:
        smtp.warmup_enabled = payload.warmup_enabled
    if payload.is_active is not None:
        smtp.is_active = payload.is_active
    db.add(smtp)
    await db.flush()
    return smtp


async def delete_smtp(smtp: SmtpSettings, db: AsyncSession) -> None:
    await db.delete(smtp)
    await db.flush()


async def _clear_default(db: AsyncSession) -> None:
    await db.execute(update(SmtpSettings).values(is_default=False))


# ---------------------------------------------------------------------------
# Test send
# ---------------------------------------------------------------------------

async def test_smtp(smtp: SmtpSettings, to_email: str, subject: str) -> dict:
    """
    Send a test email. Returns {"success": bool, "error": str|None, "latency_ms": int}.
    """
    try:
        password = decrypt_value(smtp.password_encrypted)
    except Exception:
        return {"success": False, "error": "Failed to decrypt password.", "latency_ms": None}

    sender = smtp.from_email or smtp.username
    sender_name = smtp.from_name or smtp.name

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender}>"
    msg["To"] = to_email

    html_body = f"""
    <html><body>
      <p>This is a test email from <strong>Maximus Outreach</strong>.</p>
      <p>SMTP account: <strong>{smtp.name}</strong> ({smtp.host}:{smtp.port})</p>
      <p>If you received this, your SMTP connection is working correctly.</p>
    </body></html>
    """
    text_body = f"Test email from Maximus Outreach.\nSMTP: {smtp.name} ({smtp.host}:{smtp.port})"

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    start = time.monotonic()
    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp.host,
            port=smtp.port,
            username=smtp.username,
            password=password,
            use_tls=(smtp.port == 465),
            start_tls=(smtp.port != 465 and smtp.use_tls),
            timeout=20,
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"success": True, "error": None, "latency_ms": latency_ms}
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"success": False, "error": str(exc)[:300], "latency_ms": latency_ms}


# ---------------------------------------------------------------------------
# Warmup schedule generation
# ---------------------------------------------------------------------------

WARMUP_SCHEDULE = [
    # (day_number, daily_limit) — 30-day ramp-up to 200/day
    (1, 5), (2, 8), (3, 12), (4, 16), (5, 20),
    (6, 25), (7, 30), (8, 35), (9, 40), (10, 50),
    (11, 60), (12, 70), (13, 80), (14, 90), (15, 100),
    (16, 110), (17, 120), (18, 130), (19, 140), (20, 150),
    (21, 160), (22, 170), (23, 180), (24, 190), (25, 200),
]


async def start_warmup(smtp: SmtpSettings, db: AsyncSession) -> dict:
    """
    Generate warmup schedule, enable warmup, set start date to today.
    Deletes any existing warmup schedule for this SMTP account first.
    """
    today = date.today()

    # Clear existing schedule
    existing = await db.execute(
        select(EmailWarmupSchedule).where(EmailWarmupSchedule.smtp_id == smtp.id)
    )
    for entry in existing.scalars().all():
        await db.delete(entry)

    # Create new schedule entries
    entries = []
    for day_num, limit in WARMUP_SCHEDULE:
        entry = EmailWarmupSchedule(
            smtp_id=smtp.id,
            day_number=day_num,
            daily_limit=limit,
        )
        db.add(entry)
        entries.append({"day_number": day_num, "daily_limit": limit})

    # Enable warmup on the SMTP record
    smtp.warmup_enabled = True
    smtp.warmup_start_date = today
    smtp.warmup_current_daily_limit = WARMUP_SCHEDULE[0][1]  # start at day 1 limit
    db.add(smtp)
    await db.flush()

    return {
        "smtp_id": smtp.id,
        "warmup_start_date": today,
        "schedule": entries,
    }

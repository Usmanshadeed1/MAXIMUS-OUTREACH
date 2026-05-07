"""
11.5 — Outreach Worker
Processes queued outreach_log entries: sends via the appropriate channel service,
updates status to sent/failed, retries up to 3 times with exponential backoff.
Windows: run with --pool=solo
"""
import asyncio
from datetime import datetime

from sqlalchemy import or_, select

from app.database import AsyncSessionLocal
from app.models.outreach import OutreachLog
from app.workers.celery_app import celery_app

MAX_RETRIES = 3


@celery_app.task(
    name="app.workers.outreach_worker.process_outreach_queue",
    bind=True,
    max_retries=MAX_RETRIES,
    default_retry_delay=60,
)
def process_outreach_queue(self) -> dict:
    """Send all queued outreach_log entries via their channel."""
    return asyncio.run(_async_run(self))


async def _async_run(task=None) -> dict:
    sent = 0
    failed = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        result = await db.execute(
            select(OutreachLog)
            .where(
                OutreachLog.status == "queued",
                or_(OutreachLog.scheduled_at.is_(None), OutreachLog.scheduled_at <= now),
            )
            .order_by(OutreachLog.scheduled_at.asc().nullsfirst())
            .limit(200)  # process max 200 per run to stay fast
        )
        logs: list[OutreachLog] = list(result.scalars().all())

        for log in logs:
            try:
                success = await _dispatch(log, db)
                if success:
                    log.status = "sent"
                    log.sent_at = datetime.utcnow()
                    sent += 1
                else:
                    log.status = "skipped"
                    skipped += 1
            except Exception as exc:
                log.error_message = str(exc)[:500]
                log.status = "failed"
                failed += 1

        await db.commit()

    return {
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "run_at": datetime.utcnow().isoformat(),
    }


async def _dispatch(log: OutreachLog, db) -> bool:
    """
    Dispatch a single outreach_log entry through its channel.
    Returns True = sent, False = skipped (e.g. missing data, social_dm handled separately).
    Raises on hard failure so the caller can mark as failed.
    """
    channel = log.channel

    if channel == "email":
        return await _send_email(log, db)

    if channel in ("sms", "mms"):
        return await _send_sms(log, db)

    if channel == "whatsapp":
        return await _send_whatsapp(log, db)

    if channel == "social_dm":
        # Social DM entries are owned by social_dm_queue worker (manual / browser extension).
        # Mark as skipped here — they are not sent by this worker.
        return False

    return False


# ---------------------------------------------------------------------------
# Per-channel send stubs — delegate to channel services built in Phases 6-9
# ---------------------------------------------------------------------------

async def _send_email(log: OutreachLog, db) -> bool:
    from sqlalchemy import select as sa_select
    from app.models.lead import Lead
    from app.models.campaign import CampaignEnrollment
    from app.models.settings import SmtpSettings

    if not log.lead_id:
        return False

    lead_result = await db.execute(sa_select(Lead).where(Lead.id == log.lead_id))
    lead = lead_result.scalar_one_or_none()
    if not lead or not lead.email:
        return False

    # Resolve client via enrollment → campaign
    client = None
    if log.enrollment_id:
        enroll_result = await db.execute(
            sa_select(CampaignEnrollment).where(CampaignEnrollment.id == log.enrollment_id)
        )
        enrollment = enroll_result.scalar_one_or_none()
        if enrollment:
            from app.models.campaign import Campaign
            from app.models.client import Client
            camp_result = await db.execute(sa_select(Campaign).where(Campaign.id == enrollment.campaign_id))
            campaign = camp_result.scalar_one_or_none()
            if campaign:
                client_result = await db.execute(sa_select(Client).where(Client.id == campaign.client_id))
                client = client_result.scalar_one_or_none()

    smtp = None
    if client and client.smtp_id:
        smtp_result = await db.execute(sa_select(SmtpSettings).where(SmtpSettings.id == client.smtp_id))
        smtp = smtp_result.scalar_one_or_none()
        if smtp and not smtp.is_active:
            smtp = None

    try:
        from app.services.email_service import send_email
        subject = log.subject or (f"A message for {lead.business_name}" if lead.business_name else "Quick message for you")
        result = await send_email(
            to=lead.email,
            subject=subject,
            body_html=log.message_content or "",
            db=db,
            smtp=smtp,
        )
        log.external_id = result.get("message_id") if isinstance(result, dict) else None
        if isinstance(result, dict) and not result.get("success"):
            raise RuntimeError(result.get("error") or "Email send failed")
        return True
    except Exception:
        raise


async def _send_sms(log: OutreachLog, db) -> bool:
    from sqlalchemy import select as sa_select
    from app.models.lead import Lead

    if not log.lead_id:
        return False

    lead_result = await db.execute(sa_select(Lead).where(Lead.id == log.lead_id))
    lead = lead_result.scalar_one_or_none()
    if not lead or not lead.phone:
        return False

    try:
        from app.services.sms_service import send_sms
        result = await send_sms(
            to_phone=lead.phone,
            message=log.message_content or "",
            db=db,
        )
        log.external_id = result.get("sid") if isinstance(result, dict) else None
        return True
    except Exception:
        raise


async def _send_whatsapp(log: OutreachLog, db) -> bool:
    from sqlalchemy import select as sa_select
    from app.models.lead import Lead

    if not log.lead_id:
        return False

    lead_result = await db.execute(sa_select(Lead).where(Lead.id == log.lead_id))
    lead = lead_result.scalar_one_or_none()
    if not lead or not lead.phone:
        return False

    try:
        from app.services.whatsapp_service import send_whatsapp
        result = await send_whatsapp(
            to_phone=lead.phone,
            message=log.message_content or "",
            media_urls=log.media_urls or [],
            db=db,
        )
        log.external_id = result.get("sid") if isinstance(result, dict) else None
        return True
    except Exception:
        raise

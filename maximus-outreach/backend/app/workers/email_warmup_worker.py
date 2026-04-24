"""Celery worker: Email warmup daily progression + sent_today reset."""
import asyncio
from datetime import date, datetime, timezone

from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.models.settings import EmailWarmupSchedule, SmtpSettings
from app.workers.celery_app import celery_app


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

@celery_app.task(name="app.workers.email_warmup_worker.run_email_warmup")
def run_email_warmup() -> dict:
    """
    Runs daily at midnight UTC (scheduled via beat).

    For each active SMTP account:
      1. Reset sent_today = 0.
      2. If warmup is enabled + a warmup schedule exists:
         - Calculate current warmup day (today - warmup_start_date + 1).
         - Look up the schedule entry for that day.
         - Update warmup_current_daily_limit to the schedule's daily_limit.
         - If we've passed day 25 (or no schedule entry found), disable warmup
           and restore warmup_current_daily_limit = daily_limit.
    """
    return asyncio.run(_async_run())


async def _async_run() -> dict:
    updated = 0
    warmup_advanced = 0
    warmup_completed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SmtpSettings).where(SmtpSettings.is_active == True)  # noqa: E712
        )
        smtp_accounts: list[SmtpSettings] = list(result.scalars().all())

        for smtp in smtp_accounts:
            updates: dict = {"sent_today": 0}

            if smtp.warmup_enabled and smtp.warmup_start_date:
                today = date.today()
                warmup_day = (today - smtp.warmup_start_date).days + 1  # 1-indexed

                # Fetch the schedule entry for today's warmup day
                sched_result = await db.execute(
                    select(EmailWarmupSchedule)
                    .where(
                        EmailWarmupSchedule.smtp_id == smtp.id,
                        EmailWarmupSchedule.day_number == warmup_day,
                    )
                )
                entry: EmailWarmupSchedule | None = sched_result.scalar_one_or_none()

                if entry:
                    updates["warmup_current_daily_limit"] = entry.daily_limit
                    warmup_advanced += 1
                else:
                    # Schedule exhausted — warmup complete
                    updates["warmup_enabled"] = False
                    updates["warmup_current_daily_limit"] = smtp.daily_limit
                    warmup_completed += 1

            await db.execute(
                update(SmtpSettings)
                .where(SmtpSettings.id == smtp.id)
                .values(**updates)
            )
            updated += 1

        await db.commit()

    return {
        "accounts_reset": updated,
        "warmup_advanced": warmup_advanced,
        "warmup_completed": warmup_completed,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }

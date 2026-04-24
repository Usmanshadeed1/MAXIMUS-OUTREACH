"""
11.5 — Scheduler Worker
Celery beat task: every 5 minutes.
For each active campaign, calls execute_campaign to dispatch due outreach steps
(creates outreach_log entries with status=queued for outreach_worker to process).
Windows: run with --pool=solo
"""
import asyncio
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.scheduler_worker.run_scheduler")
def run_scheduler() -> dict:
    """Execute campaign step dispatch for all active campaigns."""
    return asyncio.run(_async_run())


async def _async_run() -> dict:
    from app.services.campaign_service import execute_campaign

    total_dispatched = 0
    campaigns_processed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Campaign).where(Campaign.status == "active")
        )
        campaigns: list[Campaign] = list(result.scalars().all())

        for campaign in campaigns:
            dispatched = await execute_campaign(campaign.id, db)
            total_dispatched += dispatched
            campaigns_processed += 1

    return {
        "campaigns_processed": campaigns_processed,
        "total_dispatched": total_dispatched,
        "run_at": datetime.utcnow().isoformat(),
    }

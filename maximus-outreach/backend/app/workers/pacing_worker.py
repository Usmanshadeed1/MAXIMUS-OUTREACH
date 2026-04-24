"""
11.5 — Pacing Worker
Celery beat task: every 15 minutes.
For each active campaign that is currently within its send_window,
calls pacing_service.activate_next_batch to move queued → active enrollments.
Windows: run with --pool=solo
"""
import asyncio
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.pacing_worker.run_pacing")
def run_pacing() -> dict:
    """Activate queued enrollments for all active campaigns per their pacing config."""
    return asyncio.run(_async_run())


async def _async_run() -> dict:
    from app.services.pacing_service import activate_next_batch

    total_activated = 0
    campaigns_processed = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Campaign).where(Campaign.status == "active")
        )
        campaigns: list[Campaign] = list(result.scalars().all())

        for campaign in campaigns:
            # Only activate during campaign's send window
            if not _in_send_window(campaign):
                continue
            activated = await activate_next_batch(campaign.id, db)
            total_activated += activated
            campaigns_processed += 1

    return {
        "campaigns_processed": campaigns_processed,
        "total_activated": total_activated,
        "run_at": datetime.utcnow().isoformat(),
    }


def _in_send_window(campaign: Campaign) -> bool:
    now = datetime.utcnow().time()
    start = campaign.send_window_start
    end = campaign.send_window_end
    if start is None or end is None:
        return True
    if start <= end:
        return start <= now <= end
    return now >= start or now <= end

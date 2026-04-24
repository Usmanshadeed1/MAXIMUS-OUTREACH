"""
11.3 — Pacing Service
Activates queued campaign enrollments based on pacing_mode and daily targets.
Called by the pacing Celery worker every 15 minutes.
"""
import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignEnrollment


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def activate_next_batch(campaign_id: uuid.UUID, db: AsyncSession) -> int:
    """
    Activate queued enrollments up to today's pacing target.
    Returns number of enrollments activated this call (0 if outside send window,
    daily target already met, or no queued leads).
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or campaign.status != "active":
        return 0

    # Respect send window before activating
    if not _in_send_window(campaign):
        return 0

    # all_at_once handled at campaign start; activate any late-enrolled queued leads
    if campaign.pacing_mode == "all_at_once":
        return await _activate_queued(campaign, db, limit=None)

    daily_target = await _compute_daily_target(campaign, db)
    if daily_target <= 0:
        return 0

    # How many already activated today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count_result = await db.execute(
        select(func.count()).select_from(CampaignEnrollment).where(
            CampaignEnrollment.campaign_id == campaign_id,
            CampaignEnrollment.activated_at >= today_start,
        )
    )
    today_count = today_count_result.scalar_one()

    remaining_slots = daily_target - today_count
    if remaining_slots <= 0:
        return 0

    return await _activate_queued(campaign, db, limit=remaining_slots)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _in_send_window(campaign: Campaign) -> bool:
    """Return True if current UTC time is within the campaign's send window."""
    now = datetime.utcnow().time()
    start = campaign.send_window_start
    end = campaign.send_window_end
    if start is None or end is None:
        return True
    if start <= end:
        return start <= now <= end
    # Overnight window (e.g. 22:00–06:00)
    return now >= start or now <= end


async def _compute_daily_target(campaign: Campaign, db: AsyncSession) -> int:
    """Return how many leads should be activated per day given current pacing mode/week."""
    config = campaign.pacing_leads_per_day or {}

    if campaign.pacing_mode == "fixed_daily":
        return int(config.get("daily", 0))

    if campaign.pacing_mode == "gradual_rampup":
        # Days since first enrollment was activated
        min_result = await db.execute(
            select(func.min(CampaignEnrollment.activated_at)).where(
                CampaignEnrollment.campaign_id == campaign.id
            )
        )
        first_activation: datetime | None = min_result.scalar_one_or_none()
        days_since = (datetime.utcnow() - first_activation).days if first_activation else 0

        if days_since < 7:
            return int(config.get("week1", 50))
        elif days_since < 14:
            return int(config.get("week2", 100))
        elif days_since < 21:
            return int(config.get("week3", 150))
        else:
            return int(config.get("week4_plus", 200))

    if campaign.pacing_mode == "custom":
        # Custom schedule: JSON list [{day: N, count: M}] or fallback to "daily"
        return int(config.get("daily", config.get("week1", 0)))

    return 0


async def _activate_queued(campaign: Campaign, db: AsyncSession, limit: int | None) -> int:
    """Activate up to `limit` queued enrollments (None = all)."""
    q = (
        select(CampaignEnrollment.id)
        .where(
            CampaignEnrollment.campaign_id == campaign.id,
            CampaignEnrollment.status == "queued",
        )
        .order_by(CampaignEnrollment.enrolled_at)
    )
    if limit is not None:
        q = q.limit(limit)

    result = await db.execute(q)
    ids = [row[0] for row in result.fetchall()]
    if not ids:
        return 0

    now = datetime.utcnow()
    await db.execute(
        update(CampaignEnrollment)
        .where(CampaignEnrollment.id.in_(ids))
        .values(status="active", activated_at=now)
    )
    campaign.total_activated = (campaign.total_activated or 0) + len(ids)
    await db.commit()
    return len(ids)

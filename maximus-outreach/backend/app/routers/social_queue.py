"""Router: Social DM Queue — list, stats, mark-sent, skip, bulk-mark-sent."""
import uuid
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.outreach import SocialDmQueue
from app.models.user import User
from app.schemas.social_dm import BulkMarkSentRequest, SocialDmResponse, SocialDmStats
from app.services.social_dm_service import get_dm_by_id

router = APIRouter(prefix="/social-queue", tags=["Social DM Queue"])


# ---------------------------------------------------------------------------
# GET /social-queue — List with optional filters
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SocialDmResponse])
async def list_social_queue(
    platform: str | None = Query(None, description="Filter by platform slug, e.g. linkedin"),
    client_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status", description="Filter by status: pending, sent, skipped"),
    date_from: date | None = Query(None, description="Filter created_at >= date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="Filter created_at <= date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    if platform:
        filters.append(SocialDmQueue.platform == platform)
    if client_id:
        filters.append(SocialDmQueue.client_id == client_id)
    if status_filter:
        filters.append(SocialDmQueue.status == status_filter)
    if date_from:
        filters.append(SocialDmQueue.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(SocialDmQueue.created_at <= datetime.combine(date_to, datetime.max.time()))

    stmt = (
        select(SocialDmQueue)
        .where(*filters)
        .order_by(SocialDmQueue.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [SocialDmResponse.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# GET /social-queue/stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=SocialDmStats)
async def social_queue_stats(
    client_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_filters = []
    if client_id:
        base_filters.append(SocialDmQueue.client_id == client_id)

    async def _count(extra_filters) -> int:
        stmt = select(func.count()).select_from(SocialDmQueue).where(*(base_filters + extra_filters))
        result = await db.execute(stmt)
        return result.scalar_one()

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    pending = await _count([SocialDmQueue.status == "pending"])
    sent_today = await _count([
        SocialDmQueue.status == "sent",
        SocialDmQueue.sent_at >= today_start,
        SocialDmQueue.sent_at <= today_end,
    ])
    skipped = await _count([SocialDmQueue.status == "skipped"])

    return SocialDmStats(pending=pending, sent_today=sent_today, skipped=skipped)


# ---------------------------------------------------------------------------
# PATCH /social-queue/{id}/mark-sent
# ---------------------------------------------------------------------------

@router.patch("/{dm_id}/mark-sent", response_model=SocialDmResponse)
async def mark_sent(
    dm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dm = await get_dm_by_id(dm_id, db)
    if dm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DM not found")

    dm.status = "sent"
    dm.sent_at = datetime.utcnow()
    await db.commit()
    await db.refresh(dm)
    return SocialDmResponse.model_validate(dm)


# ---------------------------------------------------------------------------
# PATCH /social-queue/{id}/skip
# ---------------------------------------------------------------------------

@router.patch("/{dm_id}/skip", response_model=SocialDmResponse)
async def skip_dm(
    dm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dm = await get_dm_by_id(dm_id, db)
    if dm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DM not found")

    dm.status = "skipped"
    await db.commit()
    await db.refresh(dm)
    return SocialDmResponse.model_validate(dm)


# ---------------------------------------------------------------------------
# PATCH /social-queue/bulk-mark-sent
# ---------------------------------------------------------------------------

@router.patch("/bulk-mark-sent", response_model=dict)
async def bulk_mark_sent(
    payload: BulkMarkSentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.ids:
        return {"updated": 0}

    now = datetime.utcnow()
    updated = 0
    for dm_id in payload.ids:
        dm = await get_dm_by_id(dm_id, db)
        if dm is not None:
            dm.status = "sent"
            dm.sent_at = now
            updated += 1

    await db.commit()
    return {"updated": updated}

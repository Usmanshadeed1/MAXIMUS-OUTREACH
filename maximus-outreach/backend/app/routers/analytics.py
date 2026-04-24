"""
13.2 — Analytics Router

GET /analytics/dashboard        — global stats (filterable by client_id, date range)
GET /analytics/clients/{id}     — per-client stats
GET /analytics/campaigns/{id}   — per-campaign analytics
GET /analytics/channels         — channel comparison
GET /analytics/timeline         — messages over time
GET /analytics/funnel           — lead pipeline
GET /analytics/export           — export CSV or JSON
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ---------------------------------------------------------------------------
# Shared date-range dependency
# ---------------------------------------------------------------------------

def _date_params(
    date_from: date | None = Query(None, description="Start date YYYY-MM-DD"),
    date_to:   date | None = Query(None, description="End date YYYY-MM-DD"),
):
    return date_from, date_to


# ---------------------------------------------------------------------------
# GET /analytics/dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def dashboard(
    client_id: uuid.UUID | None = Query(None),
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    date_from, date_to = dates
    return await analytics_service.get_dashboard_stats(db, client_id, date_from, date_to)


# ---------------------------------------------------------------------------
# GET /analytics/clients/{id}
# ---------------------------------------------------------------------------

@router.get("/clients/{client_id}")
async def client_stats(
    client_id: uuid.UUID,
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await analytics_service.get_dashboard_stats(db, client_id, *dates)


# ---------------------------------------------------------------------------
# GET /analytics/campaigns/{id}
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}")
async def campaign_stats(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await analytics_service.get_campaign_analytics(campaign_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result


# ---------------------------------------------------------------------------
# GET /analytics/channels
# ---------------------------------------------------------------------------

@router.get("/channels")
async def channel_comparison(
    client_id: uuid.UUID | None = Query(None),
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = await analytics_service.get_dashboard_stats(db, client_id, *dates)
    return {"channel_performance": stats["channel_performance"]}


# ---------------------------------------------------------------------------
# GET /analytics/timeline
# ---------------------------------------------------------------------------

@router.get("/timeline")
async def timeline(
    client_id: uuid.UUID | None = Query(None),
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = await analytics_service.get_dashboard_stats(db, client_id, *dates)
    return {"messages_over_time": stats["messages_over_time"]}


# ---------------------------------------------------------------------------
# GET /analytics/funnel
# ---------------------------------------------------------------------------

@router.get("/funnel")
async def funnel(
    client_id: uuid.UUID | None = Query(None),
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = await analytics_service.get_dashboard_stats(db, client_id, *dates)
    return {"lead_pipeline": stats["lead_pipeline"]}


# ---------------------------------------------------------------------------
# GET /analytics/export
# ---------------------------------------------------------------------------

@router.get("/export")
async def export(
    client_id: uuid.UUID = Query(..., description="Required — client to export"),
    format: str = Query("csv", pattern="^(csv|json)$"),
    dates: tuple = Depends(_date_params),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    date_from, date_to = dates
    content, content_type = await analytics_service.export_analytics(
        db, client_id, format, date_from, date_to
    )
    filename = f"analytics.{format}"
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

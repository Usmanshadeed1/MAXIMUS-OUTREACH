import math
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.campaign import (
    CampaignCreate,
    CampaignList,
    CampaignResponse,
    CampaignStepCreate,
    CampaignStepResponse,
    CampaignStepUpdate,
    CampaignUpdate,
    EnrollLeadsRequest,
    EnrollLeadsResponse,
    PacingStatusResponse,
)
from app.services import campaign_service, client_service, ai_service
from app.models.outreach import OutreachLog
from app.models.lead import Lead
from app.models.campaign import CampaignEnrollment
from sqlalchemy import select, and_, func

router = APIRouter(tags=["Campaigns"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _check_client_access(client_id: uuid.UUID, current_user: User, db: AsyncSession):
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    if not await client_service.user_can_access_client(current_user, client_id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return client


async def _get_campaign_or_404(campaign_id: uuid.UUID, current_user: User, db: AsyncSession):
    campaign = await campaign_service.get_campaign(campaign_id, db)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    if not await client_service.user_can_access_client(current_user, campaign.client_id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return campaign


async def _campaign_with_stats(campaign, db: AsyncSession) -> CampaignResponse:
    resp = CampaignResponse.model_validate(campaign)
    resp.stats = await campaign_service.get_campaign_stats(campaign.id, db)
    return resp


# ---------------------------------------------------------------------------
# Campaign CRUD
# ---------------------------------------------------------------------------

@router.get("/clients/{client_id}/campaigns", response_model=CampaignList)
async def list_campaigns(
    client_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    campaigns, total = await campaign_service.get_campaigns_for_client(client_id, db, page, page_size)
    items = [await _campaign_with_stats(c, db) for c in campaigns]
    return CampaignList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post(
    "/clients/{client_id}/campaigns",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign(
    client_id: uuid.UUID,
    data: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    campaign = await campaign_service.create_campaign(client_id, data, db)
    return await _campaign_with_stats(campaign, db)


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    return await _campaign_with_stats(campaign, db)


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    data: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    campaign = await campaign_service.update_campaign(campaign, data, db)
    return await _campaign_with_stats(campaign, db)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    if campaign.status not in ("draft", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft or paused campaigns can be deleted.",
        )
    await campaign_service.delete_campaign(campaign, db)


# ---------------------------------------------------------------------------
# Step CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/campaigns/{campaign_id}/steps",
    response_model=CampaignStepResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_step(
    campaign_id: uuid.UUID,
    data: CampaignStepCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    step = await campaign_service.add_step(campaign.id, data, db)
    return CampaignStepResponse.model_validate(step)


@router.put("/campaigns/{campaign_id}/steps/{step_id}", response_model=CampaignStepResponse)
async def update_step(
    campaign_id: uuid.UUID,
    step_id: uuid.UUID,
    data: CampaignStepUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(campaign_id, current_user, db)
    step = await campaign_service.get_step(step_id, db)
    if step is None or step.campaign_id != campaign_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found.")
    step = await campaign_service.update_step(step, data, db)
    return CampaignStepResponse.model_validate(step)


@router.delete("/campaigns/{campaign_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_step(
    campaign_id: uuid.UUID,
    step_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(campaign_id, current_user, db)
    step = await campaign_service.get_step(step_id, db)
    if step is None or step.campaign_id != campaign_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found.")
    await campaign_service.delete_step(step, db)


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

@router.post("/campaigns/{campaign_id}/enroll", response_model=EnrollLeadsResponse)
async def enroll_leads(
    campaign_id: uuid.UUID,
    data: EnrollLeadsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    if campaign.status not in ("draft", "active", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enroll leads in a completed or archived campaign.",
        )
    if not data.lead_ids and not data.filter_status:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either lead_ids or filter_status.",
        )
    return await campaign_service.enroll_leads(campaign.id, data, db)


# ---------------------------------------------------------------------------
# Campaign lifecycle
# ---------------------------------------------------------------------------

@router.post("/campaigns/{campaign_id}/start", response_model=CampaignResponse)
async def start_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    if campaign.status not in ("draft", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campaign is already {campaign.status}.",
        )
    campaign = await campaign_service.start_campaign(campaign, db)
    return await _campaign_with_stats(campaign, db)


@router.post("/campaigns/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    if campaign.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active campaigns can be paused.",
        )
    campaign = await campaign_service.pause_campaign(campaign, db)
    return await _campaign_with_stats(campaign, db)


@router.post("/campaigns/{campaign_id}/resume", response_model=CampaignResponse)
async def resume_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    if campaign.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paused campaigns can be resumed.",
        )
    campaign = await campaign_service.resume_campaign(campaign, db)
    return await _campaign_with_stats(campaign, db)


# ---------------------------------------------------------------------------
# Pacing status
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/pacing", response_model=PacingStatusResponse)
async def get_pacing_status(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)
    pacing = await campaign_service.get_pacing_status(campaign, db)
    return PacingStatusResponse(**pacing)


# ---------------------------------------------------------------------------
# AI template draft
# ---------------------------------------------------------------------------

@router.post("/clients/{client_id}/ai/draft-template")
async def draft_template(
    client_id: uuid.UUID,
    channel: str = Body(...),
    custom_instruction: str | None = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _check_client_access(client_id, current_user, db)
    try:
        text = await ai_service.draft_template(client, channel, custom_instruction, db)
        return {"template": text}
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


# ---------------------------------------------------------------------------
# Campaign outreach logs
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/logs")
async def get_campaign_logs(
    campaign_id: uuid.UUID,
    channel: str | None = Query(None),
    log_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated outreach log entries for a campaign."""
    campaign = await _get_campaign_or_404(campaign_id, current_user, db)

    # Build filter on enrollment → campaign

    conditions = [CampaignEnrollment.campaign_id == campaign.id]
    if channel:
        conditions.append(OutreachLog.channel == channel)
    if log_status:
        conditions.append(OutreachLog.status == log_status)

    # Count
    count_q = (
        select(func.count(OutreachLog.id))
        .join(CampaignEnrollment, OutreachLog.enrollment_id == CampaignEnrollment.id)
        .where(and_(*conditions))
    )
    total: int = (await db.execute(count_q)).scalar_one()

    # Fetch rows + lead name
    rows_q = (
        select(OutreachLog, Lead.business_name.label("lead_name"))
        .join(CampaignEnrollment, OutreachLog.enrollment_id == CampaignEnrollment.id)
        .outerjoin(Lead, OutreachLog.lead_id == Lead.id)
        .where(and_(*conditions))
        .order_by(OutreachLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(rows_q)
    rows = result.all()

    items = []
    for row in rows:
        log: OutreachLog = row[0]
        lead_name: str | None = row[1]
        items.append({
            "id": str(log.id),
            "lead_id": str(log.lead_id) if log.lead_id else None,
            "lead_name": lead_name or "Unknown",
            "channel": log.channel,
            "status": log.status,
            "subject": log.subject,
            "message_content": log.message_content,
            "error_message": log.error_message,
            "ai_model_used": log.ai_model_used,
            "scheduled_at": log.scheduled_at.isoformat() if log.scheduled_at else None,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "opened_at": log.opened_at.isoformat() if log.opened_at else None,
            "clicked_at": log.clicked_at.isoformat() if log.clicked_at else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }

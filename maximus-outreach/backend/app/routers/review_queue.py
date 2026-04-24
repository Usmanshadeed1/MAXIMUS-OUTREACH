"""
12.2 — Review Queue Router
Endpoints for reviewing and actioning AI-generated reply drafts.
"""
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.conversation import (
    EditDraftRequest,
    MessageResponse,
    ReviewQueueCount,
    ReviewQueueItem,
    ReviewQueueList,
)
from app.services import conversation_service

router = APIRouter(prefix="/review-queue", tags=["Review Queue"])


# ---------------------------------------------------------------------------
# GET /review-queue — list pending drafts
# ---------------------------------------------------------------------------

@router.get("", response_model=ReviewQueueList)
async def list_review_queue(
    client_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages, total = await conversation_service.get_pending_drafts(
        db, client_id=client_id, page=page, page_size=page_size
    )

    items = [
        ReviewQueueItem(
            id=m.id,
            conversation_id=m.conversation_id,
            lead_id=m.conversation.lead_id if m.conversation else None,
            client_id=m.conversation.client_id if m.conversation else None,
            channel=m.conversation.channel if m.conversation else "unknown",
            content=m.content,
            is_ai_generated=m.is_ai_generated,
            created_at=m.created_at,
        )
        for m in messages
    ]

    return ReviewQueueList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /review-queue/count — badge count
# ---------------------------------------------------------------------------

@router.get("/count", response_model=ReviewQueueCount)
async def get_review_queue_count(
    client_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await conversation_service.get_pending_drafts_count(db, client_id=client_id)
    return ReviewQueueCount(count=count)


# ---------------------------------------------------------------------------
# POST /review-queue/{id}/approve
# ---------------------------------------------------------------------------

@router.post("/{message_id}/approve", response_model=MessageResponse)
async def approve_draft(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        message = await conversation_service.approve_and_send(message_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return message


# ---------------------------------------------------------------------------
# POST /review-queue/{id}/edit
# ---------------------------------------------------------------------------

@router.post("/{message_id}/edit", response_model=MessageResponse)
async def edit_draft(
    message_id: uuid.UUID,
    body: EditDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        message = await conversation_service.edit_and_send(message_id, body.content, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return message


# ---------------------------------------------------------------------------
# POST /review-queue/{id}/discard
# ---------------------------------------------------------------------------

@router.post("/{message_id}/discard", status_code=204)
async def discard_draft(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await conversation_service.discard_draft(message_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

"""
12.3 — Conversations Router
Full conversation thread viewing, manual replies, and close.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.conversation import (
    ConversationList,
    ConversationResponse,
    ManualReplyRequest,
    MessageResponse,
)
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ---------------------------------------------------------------------------
# GET /conversations — list (filterable by client, channel, status)
# ---------------------------------------------------------------------------

@router.get("", response_model=ConversationList)
async def list_conversations(
    client_id: uuid.UUID | None = Query(None),
    channel: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations, total = await conversation_service.get_conversations(
        db,
        client_id=client_id,
        channel=channel,
        status=status,
        page=page,
        page_size=page_size,
    )
    return ConversationList(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /conversations/{id} — full thread
# ---------------------------------------------------------------------------

@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await conversation_service.get_conversation(conversation_id, db)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


# ---------------------------------------------------------------------------
# POST /conversations/{id}/reply — manual reply
# ---------------------------------------------------------------------------

@router.post("/{conversation_id}/reply", response_model=MessageResponse, status_code=201)
async def manual_reply(
    conversation_id: uuid.UUID,
    body: ManualReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await conversation_service.get_conversation(conversation_id, db)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed conversation")

    message = await conversation_service.send_manual_reply(conv, body.content, db)
    return message


# ---------------------------------------------------------------------------
# PATCH /conversations/{id}/close — close conversation
# ---------------------------------------------------------------------------

@router.patch("/{conversation_id}/close", response_model=ConversationResponse)
async def close_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await conversation_service.get_conversation(conversation_id, db)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.status == "closed":
        raise HTTPException(status_code=400, detail="Conversation is already closed")

    return await conversation_service.close_conversation(conv, db)

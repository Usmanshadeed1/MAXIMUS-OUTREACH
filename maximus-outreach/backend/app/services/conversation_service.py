"""
12.1 — Conversation Service
Handles incoming replies, conversation threading, AI draft generation,
and review queue approval/edit/send flow.
"""
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.campaign import CampaignEnrollment
from app.models.conversation import Conversation, Message
from app.models.lead import Lead


# ---------------------------------------------------------------------------
# Incoming message handler
# ---------------------------------------------------------------------------

async def handle_incoming_message(
    channel: str,
    from_identifier: str,        # email address or phone number
    content: str,
    db: AsyncSession,
    media: list[str] | None = None,
    client_id: uuid.UUID | None = None,
) -> dict:
    """
    Process an inbound reply from a lead:
    1. Match lead by email or phone
    2. Find or create Conversation
    3. Save inbound Message
    4. Stop active campaign enrollments (lead.status → 'replied')
    5. AI-draft a reply, save with is_approved=False
    Returns dict with conversation_id, inbound_message_id, draft_message_id.
    Raises ValueError if lead not found.
    """
    lead = await _find_lead(from_identifier, db)
    if lead is None:
        raise ValueError(f"No lead found matching identifier: {from_identifier}")

    # Resolve client_id from lead if not provided
    if client_id is None:
        client_id = lead.client_id

    # Find or create conversation for this lead+channel
    conversation = await _get_or_create_conversation(lead.id, client_id, channel, db)

    # Save inbound message
    inbound = Message(
        conversation_id=conversation.id,
        direction="inbound",
        content=content,
        media_urls=media or [],
        is_ai_generated=False,
        is_approved=True,
        sent_at=datetime.utcnow(),
    )
    db.add(inbound)
    await db.flush()

    # Stop campaign sequences — mark all active enrollments for this lead
    await _stop_campaign_enrollments(lead.id, db)

    # Update lead status → replied
    lead.status = "replied"

    # AI draft reply
    draft_id = await _create_ai_draft(conversation, lead, channel, content, db)

    await db.commit()

    return {
        "conversation_id": str(conversation.id),
        "inbound_message_id": str(inbound.id),
        "draft_message_id": str(draft_id) if draft_id else None,
    }


# ---------------------------------------------------------------------------
# Review queue actions
# ---------------------------------------------------------------------------

async def approve_and_send(message_id: uuid.UUID, db: AsyncSession) -> Message:
    """Approve AI draft and mark as sent."""
    message = await _get_message(message_id, db)
    if message is None:
        raise ValueError(f"Message {message_id} not found")
    if message.direction != "outbound" or not message.is_ai_generated:
        raise ValueError("Only AI-generated outbound drafts can be approved")
    if message.is_approved:
        raise ValueError("Message is already approved")

    message.is_approved = True
    message.sent_at = datetime.utcnow()

    # Dispatch via channel service
    await _send_message(message, db)

    await db.commit()
    return message


async def edit_and_send(message_id: uuid.UUID, new_content: str, db: AsyncSession) -> Message:
    """Edit content of AI draft then approve + send."""
    message = await _get_message(message_id, db)
    if message is None:
        raise ValueError(f"Message {message_id} not found")

    message.content = new_content
    message.is_approved = True
    message.sent_at = datetime.utcnow()

    await _send_message(message, db)

    await db.commit()
    return message


async def discard_draft(message_id: uuid.UUID, db: AsyncSession) -> None:
    """Delete an unapproved AI draft."""
    message = await _get_message(message_id, db)
    if message is None:
        raise ValueError(f"Message {message_id} not found")
    if message.is_approved:
        raise ValueError("Cannot discard an already-approved message")
    await db.delete(message)
    await db.commit()


# ---------------------------------------------------------------------------
# Review queue queries
# ---------------------------------------------------------------------------

async def get_pending_drafts(
    db: AsyncSession,
    client_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Message], int]:
    """Return unapproved AI drafts ordered by creation time (oldest first)."""
    from sqlalchemy import func

    base = (
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.is_ai_generated == True,       # noqa: E712
            Message.is_approved == False,          # noqa: E712
            Message.sent_at == None,               # noqa: E711
        )
    )
    if client_id:
        base = base.where(Conversation.client_id == client_id)

    count_q = select(func.count()).select_from(base.subquery())
    items_q = (
        base.options(selectinload(Message.conversation))
        .order_by(Message.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    total = (await db.execute(count_q)).scalar_one()
    messages = (await db.execute(items_q)).scalars().all()
    return list(messages), total


async def get_pending_drafts_count(
    db: AsyncSession,
    client_id: uuid.UUID | None = None,
) -> int:
    _, total = await get_pending_drafts(db, client_id=client_id, page=1, page_size=1)
    return total


# ---------------------------------------------------------------------------
# Conversation queries
# ---------------------------------------------------------------------------

async def get_conversations(
    db: AsyncSession,
    client_id: uuid.UUID | None = None,
    channel: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Conversation], int]:
    from sqlalchemy import func

    q = select(Conversation)
    if client_id:
        q = q.where(Conversation.client_id == client_id)
    if channel:
        q = q.where(Conversation.channel == channel)
    if status:
        q = q.where(Conversation.status == status)

    count_q = select(func.count()).select_from(q.subquery())
    items_q = (
        q.options(selectinload(Conversation.messages), selectinload(Conversation.lead))
        .order_by(Conversation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    total = (await db.execute(count_q)).scalar_one()
    conversations = (await db.execute(items_q)).scalars().all()
    return list(conversations), total


async def get_conversation(conversation_id: uuid.UUID, db: AsyncSession) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.lead),
        )
    )
    return result.scalar_one_or_none()


async def close_conversation(conversation: Conversation, db: AsyncSession) -> Conversation:
    conversation.status = "closed"
    await db.commit()
    # Re-fetch with relationships loaded; avoid MissingGreenlet after expire_on_commit
    return await get_conversation(conversation.id, db)


async def send_manual_reply(
    conversation: Conversation,
    content: str,
    db: AsyncSession,
) -> Message:
    """Create and immediately 'send' a manual (non-AI) outbound reply."""
    message = Message(
        conversation_id=conversation.id,
        direction="outbound",
        content=content,
        is_ai_generated=False,
        is_approved=True,
        sent_at=datetime.utcnow(),
    )
    db.add(message)
    await _send_message(message, db)
    await db.commit()
    return message


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _find_lead(identifier: str, db: AsyncSession) -> Lead | None:
    """Match by email first, then phone."""
    result = await db.execute(
        select(Lead).where(Lead.email == identifier).limit(1)
    )
    lead = result.scalar_one_or_none()
    if lead:
        return lead
    result = await db.execute(
        select(Lead).where(Lead.phone == identifier).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_or_create_conversation(
    lead_id: uuid.UUID,
    client_id: uuid.UUID,
    channel: str,
    db: AsyncSession,
) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.lead_id == lead_id,
            Conversation.channel == channel,
            Conversation.status == "open",
        ).limit(1)
    )
    conversation = result.scalar_one_or_none()
    if conversation:
        return conversation

    conversation = Conversation(
        lead_id=lead_id,
        client_id=client_id,
        channel=channel,
        status="open",
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def _stop_campaign_enrollments(lead_id: uuid.UUID, db: AsyncSession) -> None:
    """Set all active/queued enrollments for this lead to 'replied'."""
    await db.execute(
        update(CampaignEnrollment)
        .where(
            CampaignEnrollment.lead_id == lead_id,
            CampaignEnrollment.status.in_(["active", "queued"]),
        )
        .values(status="replied", completed_at=datetime.utcnow())
    )


async def _create_ai_draft(
    conversation: Conversation,
    lead: Lead,
    channel: str,
    inbound_content: str,
    db: AsyncSession,
) -> uuid.UUID | None:
    """Generate an AI reply draft. Returns message ID or None if AI unavailable."""
    try:
        from app.services.ai_service import generate_reply_draft

        # Build conversation history for context
        history_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        history = list(reversed(history_result.scalars().all()))

        # Fetch client for context
        client = None
        if conversation.client_id:
            from app.models.client import Client
            c_result = await db.execute(select(Client).where(Client.id == conversation.client_id))
            client = c_result.scalar_one_or_none()

        draft_content = await generate_reply_draft(
            client=client,
            lead=lead,
            channel=channel,
            inbound_content=inbound_content,
            history=history,
            db=db,
        )
    except Exception:
        # AI unavailable — create placeholder draft
        draft_content = f"[AI draft unavailable] Reply to: {inbound_content[:100]}"

    draft = Message(
        conversation_id=conversation.id,
        direction="outbound",
        content=draft_content,
        is_ai_generated=True,
        is_approved=False,
    )
    db.add(draft)
    await db.flush()
    return draft.id


async def _get_message(message_id: uuid.UUID, db: AsyncSession) -> Message | None:
    result = await db.execute(select(Message).where(Message.id == message_id))
    return result.scalar_one_or_none()


async def _send_message(message: Message, db: AsyncSession) -> None:
    """
    Dispatch the outbound message via its conversation's channel.
    Currently a no-op stub — real sending handled by outreach_worker.
    Updates message.sent_at if not already set.
    """
    if message.sent_at is None:
        message.sent_at = datetime.utcnow()

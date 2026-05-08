"""Service: Message Template CRUD."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message_template import MessageTemplate


async def list_templates(client_id: uuid.UUID, db: AsyncSession) -> list[MessageTemplate]:
    result = await db.execute(
        select(MessageTemplate)
        .where(MessageTemplate.client_id == client_id)
        .order_by(MessageTemplate.created_at.desc())
    )
    return list(result.scalars().all())


async def get_template(template_id: uuid.UUID, client_id: uuid.UUID, db: AsyncSession) -> MessageTemplate | None:
    result = await db.execute(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id,
            MessageTemplate.client_id == client_id,
        )
    )
    return result.scalar_one_or_none()


async def create_template(
    client_id: uuid.UUID,
    name: str,
    body: str,
    subject: str | None,
    db: AsyncSession,
) -> MessageTemplate:
    tmpl = MessageTemplate(
        client_id=client_id,
        name=name,
        subject=subject,
        body=body,
    )
    db.add(tmpl)
    await db.flush()
    await db.refresh(tmpl)
    return tmpl


async def update_template(
    tmpl: MessageTemplate,
    name: str | None,
    body: str | None,
    subject: str | None,
    db: AsyncSession,
) -> MessageTemplate:
    if name is not None:
        tmpl.name = name
    if body is not None:
        tmpl.body = body
    if subject is not None:
        tmpl.subject = subject
    elif subject == "":
        tmpl.subject = None
    await db.flush()
    await db.refresh(tmpl)
    return tmpl


async def delete_template(tmpl: MessageTemplate, db: AsyncSession) -> None:
    await db.delete(tmpl)
    await db.flush()

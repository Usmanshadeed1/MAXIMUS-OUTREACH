import math
import uuid

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadImport
from app.schemas.leads import LeadCreate, LeadUpdate


# Social fields used for has_social filter
_SOCIAL_FIELDS = [
    Lead.facebook, Lead.instagram, Lead.linkedin,
    Lead.youtube, Lead.twitter, Lead.tiktok,
    Lead.snapchat, Lead.other_social,
]


async def get_leads(
    client_id: uuid.UUID,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    status: str | None = None,
    has_email: bool | None = None,
    has_phone: bool | None = None,
    has_social: bool | None = None,
    search: str | None = None,
) -> tuple[list[Lead], int]:
    base = select(Lead).where(Lead.client_id == client_id)
    count_base = select(func.count()).select_from(Lead).where(Lead.client_id == client_id)

    if status:
        base = base.where(Lead.status == status)
        count_base = count_base.where(Lead.status == status)
    if has_email is True:
        base = base.where(Lead.email.isnot(None))
        count_base = count_base.where(Lead.email.isnot(None))
    elif has_email is False:
        base = base.where(Lead.email.is_(None))
        count_base = count_base.where(Lead.email.is_(None))
    if has_phone is True:
        base = base.where(Lead.phone.isnot(None))
        count_base = count_base.where(Lead.phone.isnot(None))
    elif has_phone is False:
        base = base.where(Lead.phone.is_(None))
        count_base = count_base.where(Lead.phone.is_(None))
    if has_social is True:
        cond = or_(*[f.isnot(None) for f in _SOCIAL_FIELDS])
        base = base.where(cond)
        count_base = count_base.where(cond)
    elif has_social is False:
        cond = or_(*[f.isnot(None) for f in _SOCIAL_FIELDS])
        base = base.where(~cond)
        count_base = count_base.where(~cond)
    if search:
        pattern = f"%{search}%"
        base = base.where(Lead.business_name.ilike(pattern))
        count_base = count_base.where(Lead.business_name.ilike(pattern))

    total = (await db.execute(count_base)).scalar_one()
    items = list(
        (await db.execute(base.order_by(Lead.imported_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    )
    return items, total


async def get_lead_by_id(lead_id: uuid.UUID, client_id: uuid.UUID, db: AsyncSession) -> Lead | None:
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.client_id == client_id)
    )
    return result.scalar_one_or_none()


async def create_lead(client_id: uuid.UUID, payload: LeadCreate, db: AsyncSession) -> Lead:
    lead = Lead(client_id=client_id, **payload.model_dump())
    db.add(lead)
    return lead


async def update_lead(lead: Lead, payload: LeadUpdate, db: AsyncSession) -> Lead:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    return lead


async def delete_lead(lead: Lead, db: AsyncSession) -> None:
    await db.delete(lead)


async def bulk_update_status(
    client_id: uuid.UUID,
    lead_ids: list[uuid.UUID],
    status: str,
    db: AsyncSession,
) -> int:
    result = await db.execute(
        update(Lead)
        .where(Lead.client_id == client_id, Lead.id.in_(lead_ids))
        .values(status=status)
    )
    return result.rowcount


async def bulk_delete(
    client_id: uuid.UUID,
    lead_ids: list[uuid.UUID],
    db: AsyncSession,
) -> int:
    result = await db.execute(
        delete(Lead).where(Lead.client_id == client_id, Lead.id.in_(lead_ids))
    )
    return result.rowcount


async def get_import_history(client_id: uuid.UUID, db: AsyncSession) -> list[LeadImport]:
    result = await db.execute(
        select(LeadImport)
        .where(LeadImport.client_id == client_id)
        .order_by(LeadImport.imported_at.desc())
    )
    return list(result.scalars().all())

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.client import Client
from app.models.lead import Lead
from app.models.user import User, UserClientAssignment
from app.schemas.clients import ClientCreate, ClientUpdate


async def _lead_count(client_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(Lead).where(Lead.client_id == client_id)
    )
    return result.scalar_one()


async def _active_campaigns_count(client_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Campaign)
        .where(Campaign.client_id == client_id, Campaign.status == "active")
    )
    return result.scalar_one()


async def get_client_stats(client_id: uuid.UUID, db: AsyncSession) -> dict:
    return {
        "lead_count": await _lead_count(client_id, db),
        "active_campaigns_count": await _active_campaigns_count(client_id, db),
    }


async def list_clients_for_user(
    user: User,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Client], int]:
    """Return paginated clients accessible to the user."""
    if user.role == "owner":
        count_q = select(func.count()).select_from(Client)
        items_q = (
            select(Client)
            .order_by(Client.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    else:
        assigned = select(UserClientAssignment.client_id).where(
            UserClientAssignment.user_id == user.id
        )
        count_q = (
            select(func.count())
            .select_from(Client)
            .where(Client.id.in_(assigned))
        )
        items_q = (
            select(Client)
            .where(Client.id.in_(assigned))
            .order_by(Client.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

    total = (await db.execute(count_q)).scalar_one()
    items = list((await db.execute(items_q)).scalars().all())
    return items, total


async def get_client_by_id(client_id: uuid.UUID, db: AsyncSession) -> Client | None:
    result = await db.execute(select(Client).where(Client.id == client_id))
    return result.scalar_one_or_none()


async def user_can_access_client(user: User, client_id: uuid.UUID, db: AsyncSession) -> bool:
    if user.role == "owner":
        return True
    result = await db.execute(
        select(UserClientAssignment).where(
            UserClientAssignment.user_id == user.id,
            UserClientAssignment.client_id == client_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def create_client(payload: ClientCreate, created_by: uuid.UUID, db: AsyncSession) -> Client:
    client = Client(
        created_by=created_by,
        name=payload.name,
        business_type=payload.business_type,
        services=payload.services,
        target_audience=payload.target_audience,
        tone=payload.tone,
        pitch=payload.pitch,
        website=payload.website,
        phone=payload.phone,
        from_email=payload.from_email,
        from_name=payload.from_name,
        custom_instructions=payload.custom_instructions,
    )
    db.add(client)
    return client


async def update_client(client: Client, payload: ClientUpdate, db: AsyncSession) -> Client:
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    return client


async def deactivate_client(client: Client, db: AsyncSession) -> Client:
    client.is_active = False
    return client

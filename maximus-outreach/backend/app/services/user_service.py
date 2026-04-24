import math
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.user import User, UserClientAssignment
from app.schemas.users import UserCreate, UserUpdate
from app.security import hash_password


async def get_accessible_clients(user: User, db: AsyncSession) -> list[Client]:
    """Return all active clients for owner, only assigned clients for manager."""
    if user.role == "owner":
        result = await db.execute(select(Client).where(Client.is_active == True))
        return list(result.scalars().all())

    result = await db.execute(
        select(Client)
        .join(UserClientAssignment, UserClientAssignment.client_id == Client.id)
        .where(
            UserClientAssignment.user_id == user.id,
            Client.is_active == True,
        )
    )
    return list(result.scalars().all())


async def get_user_assigned_clients(user_id: uuid.UUID, db: AsyncSession) -> list[Client]:
    """Return the list of clients assigned to a specific user."""
    result = await db.execute(
        select(Client)
        .join(UserClientAssignment, UserClientAssignment.client_id == Client.id)
        .where(UserClientAssignment.user_id == user_id)
    )
    return list(result.scalars().all())


async def list_users(db: AsyncSession, page: int, page_size: int) -> tuple[list[User], int]:
    """Return paginated list of all users and the total count."""
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = list(result.scalars().all())
    return users, total


async def get_user_by_id(user_id: uuid.UUID, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(payload: UserCreate, db: AsyncSession) -> User:
    """Create a manager account and assign clients."""
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role="manager",
    )
    db.add(user)
    await db.flush()  # get user.id

    if payload.assigned_client_ids:
        for client_id in payload.assigned_client_ids:
            db.add(UserClientAssignment(user_id=user.id, client_id=client_id))

    await db.flush()
    return user


async def update_user(user: User, payload: UserUpdate, db: AsyncSession) -> User:
    """Apply partial updates to a user, replacing client assignments if provided."""
    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.assigned_client_ids is not None:
        await _replace_assignments(user.id, payload.assigned_client_ids, db)

    await db.flush()
    return user


async def replace_client_assignments(
    user_id: uuid.UUID,
    client_ids: list[uuid.UUID],
    db: AsyncSession,
) -> None:
    await _replace_assignments(user_id, client_ids, db)
    await db.flush()


async def _replace_assignments(
    user_id: uuid.UUID,
    client_ids: list[uuid.UUID],
    db: AsyncSession,
) -> None:
    """Delete all existing assignments for user, then create new ones."""
    await db.execute(
        delete(UserClientAssignment).where(UserClientAssignment.user_id == user_id)
    )
    for client_id in client_ids:
        db.add(UserClientAssignment(user_id=user_id, client_id=client_id))


async def deactivate_user(user: User, db: AsyncSession) -> User:
    """Soft-delete: set is_active = False, preserve all data."""
    user.is_active = False
    await db.flush()
    return user

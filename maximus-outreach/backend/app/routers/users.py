import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_owner
from app.models.user import User
from app.schemas.auth import AssignedClientInfo
from app.schemas.users import UserCreate, UserList, UserResponse, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["User Management"])


def _to_response(user: User, assigned_clients: list) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        assigned_clients=[AssignedClientInfo(id=c.id, name=c.name) for c in assigned_clients],
    )


@router.get("", response_model=UserList)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """List all users (owner only). Paginated."""
    users, total = await user_service.list_users(db, page, page_size)

    items = []
    for user in users:
        clients = await user_service.get_user_assigned_clients(user.id, db)
        items.append(_to_response(user, clients))

    return UserList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Get single user with assignments (owner only)."""
    user = await user_service.get_user_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    clients = await user_service.get_user_assigned_clients(user_id, db)
    return _to_response(user, clients)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Create a manager account (owner only). Cannot create another owner."""
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = await user_service.create_user(payload, db)
    await db.commit()
    await db.refresh(user)

    clients = await user_service.get_user_assigned_clients(user.id, db)
    return _to_response(user, clients)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's name, email, password, active status, or client assignments (owner only)."""
    user = await user_service.get_user_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Check email uniqueness if changing email
    if payload.email and payload.email != user.email:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists.",
            )

    user = await user_service.update_user(user, payload, db)
    await db.commit()
    await db.refresh(user)

    clients = await user_service.get_user_assigned_clients(user_id, db)
    return _to_response(user, clients)


@router.delete("/{user_id}", response_model=UserResponse)
async def deactivate_user(
    user_id: uuid.UUID,
    current_owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user (soft delete — is_active = false, data preserved). Owner only."""
    user = await user_service.get_user_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == current_owner.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account.",
        )

    user = await user_service.deactivate_user(user, db)
    await db.commit()
    await db.refresh(user)

    clients = await user_service.get_user_assigned_clients(user_id, db)
    return _to_response(user, clients)


@router.put("/{user_id}/clients", response_model=UserResponse)
async def replace_user_clients(
    user_id: uuid.UUID,
    client_ids: list[uuid.UUID],
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Replace all client assignments for a user (owner only)."""
    user = await user_service.get_user_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    await user_service.replace_client_assignments(user_id, client_ids, db)
    await db.commit()

    clients = await user_service.get_user_assigned_clients(user_id, db)
    return _to_response(user, clients)

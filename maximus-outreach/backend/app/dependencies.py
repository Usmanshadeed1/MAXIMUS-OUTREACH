import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client
from app.models.user import User, UserClientAssignment
from app.security import decode_access_token

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT, return the authenticated User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("user_id")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def require_owner(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that raises 403 if the authenticated user is not an owner."""
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Owner role required.",
        )
    return current_user


async def require_client_access(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    Dependency for all client-scoped routes.
    Owner: access to any active client.
    Manager: only clients explicitly assigned to them.
    Raises 404 if client doesn't exist, 403 if not permitted.
    """
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.is_active == True)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    if current_user.role == "owner":
        return client

    # Manager — must be explicitly assigned
    assignment = await db.execute(
        select(UserClientAssignment).where(
            UserClientAssignment.user_id == current_user.id,
            UserClientAssignment.client_id == client_id,
        )
    )
    if assignment.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not assigned to this client.",
        )

    return client

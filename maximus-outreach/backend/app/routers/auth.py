from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.client import Client
from app.models.user import User, UserClientAssignment
from app.schemas.auth import AssignedClientInfo, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.security import create_access_token, hash_password, verify_password
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])

_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_WINDOW_SECONDS = 60


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_owner(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create the owner account. Only one owner is allowed.
    Returns 400 if an owner already exists.
    """
    # Enforce single owner rule
    result = await db.execute(select(func.count()).select_from(User).where(User.role == "owner"))
    owner_count = result.scalar()
    if owner_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner account already exists. Use /auth/login to sign in.",
        )

    # Check email not already taken
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role="owner",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        assigned_clients=[],
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email + password. Works for both owner and managers.
    Returns a JWT access token.
    Rate limited: max 5 attempts per IP per minute.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{client_ip}"

    if not limiter.is_allowed(rate_key, _LOGIN_MAX_ATTEMPTS, _LOGIN_WINDOW_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait a minute before trying again.",
            headers={"Retry-After": "60"},
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    token = create_access_token(
        {"user_id": str(user.id), "role": user.role, "email": user.email}
    )
    # Reset rate limit counter on successful login
    limiter.clear(rate_key)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Return the currently authenticated user's profile,
    including their role and list of assigned clients.
    """
    assigned_clients: list[AssignedClientInfo] = []

    if current_user.role == "owner":
        # Owner sees all active clients
        result = await db.execute(select(Client).where(Client.is_active == True))
        clients = result.scalars().all()
        assigned_clients = [AssignedClientInfo(id=c.id, name=c.name) for c in clients]
    else:
        # Manager sees only assigned clients — explicit join without ORM relationship
        result = await db.execute(
            select(Client)
            .join(UserClientAssignment, UserClientAssignment.client_id == Client.id)
            .where(
                UserClientAssignment.user_id == current_user.id,
                Client.is_active == True,
            )
        )
        clients = result.scalars().all()
        assigned_clients = [AssignedClientInfo(id=c.id, name=c.name) for c in clients]

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        assigned_clients=assigned_clients,
    )

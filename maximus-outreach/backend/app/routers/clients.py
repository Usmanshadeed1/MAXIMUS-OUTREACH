import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_owner
from app.models.user import User
from app.schemas.clients import ClientCreate, ClientList, ClientResponse, ClientUpdate
from app.services import client_service

router = APIRouter(prefix="/clients", tags=["Client Management"])


async def _to_response(client, db: AsyncSession) -> ClientResponse:
    stats = await client_service.get_client_stats(client.id, db)
    return ClientResponse(
        id=client.id,
        name=client.name,
        business_type=client.business_type,
        services=client.services,
        target_audience=client.target_audience,
        tone=client.tone,
        pitch=client.pitch,
        website=client.website,
        phone=client.phone,
        from_email=client.from_email,
        from_name=client.from_name,
        custom_instructions=client.custom_instructions,
        is_active=client.is_active,
        created_at=client.created_at,
        lead_count=stats["lead_count"],
        active_campaigns_count=stats["active_campaigns_count"],
    )


@router.get("", response_model=ClientList)
async def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List clients. Owner sees all; manager sees only assigned clients."""
    clients, total = await client_service.list_clients_for_user(current_user, db, page, page_size)
    items = [await _to_response(c, db) for c in clients]
    return ClientList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single client with stats. Owner or assigned manager only."""
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    if not await client_service.user_can_access_client(current_user, client_id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await _to_response(client, db)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Create a new client. Owner only."""
    client = await client_service.create_client(payload, current_user.id, db)
    await db.commit()
    await db.refresh(client)
    return await _to_response(client, db)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Update a client. Owner only."""
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    client = await client_service.update_client(client, payload, db)
    await db.commit()
    await db.refresh(client)
    return await _to_response(client, db)


@router.delete("/{client_id}", response_model=ClientResponse)
async def deactivate_client(
    client_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a client (is_active = false). Owner only."""
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    client = await client_service.deactivate_client(client, db)
    await db.commit()
    await db.refresh(client)
    return await _to_response(client, db)

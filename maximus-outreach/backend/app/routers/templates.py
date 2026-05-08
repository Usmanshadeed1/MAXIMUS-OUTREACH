"""Router: Message Templates — CRUD per client."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import client_service, template_service

router = APIRouter(prefix="/clients/{client_id}/templates", tags=["Templates"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TemplateCreate(BaseModel):
    name: str
    subject: str | None = None
    body: str


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None


class TemplateResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    subject: str | None
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helper: verify client access
# ---------------------------------------------------------------------------

async def _get_client(client_id: uuid.UUID, user: User, db: AsyncSession):
    client = await client_service.get_client_by_id(client_id, db)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.role != "owner":
        accessible = await client_service.get_accessible_client_ids(user.id, db)
        if client_id not in accessible:
            raise HTTPException(status_code=403, detail="Access denied")
    return client


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_client(client_id, current_user, db)
    return await template_service.list_templates(client_id, db)


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    client_id: uuid.UUID,
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_client(client_id, current_user, db)
    tmpl = await template_service.create_template(
        client_id=client_id,
        name=payload.name,
        body=payload.body,
        subject=payload.subject,
        db=db,
    )
    await db.commit()
    return tmpl


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    client_id: uuid.UUID,
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_client(client_id, current_user, db)
    tmpl = await template_service.get_template(template_id, client_id, db)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    tmpl = await template_service.update_template(
        tmpl=tmpl,
        name=payload.name,
        body=payload.body,
        subject=payload.subject,
        db=db,
    )
    await db.commit()
    return tmpl


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    client_id: uuid.UUID,
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_client(client_id, current_user, db)
    tmpl = await template_service.get_template(template_id, client_id, db)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await template_service.delete_template(tmpl, db)
    await db.commit()

"""Router: Global (default) Message Templates — not tied to any client."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import template_service

router = APIRouter(prefix="/templates", tags=["Global Templates"])


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
    client_id: uuid.UUID | None
    name: str
    subject: str | None
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TemplateResponse])
async def list_global_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await template_service.list_global_templates(db)


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_global_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage global templates")
    tmpl = await template_service.create_template(
        client_id=None,
        name=payload.name,
        body=payload.body,
        subject=payload.subject,
        db=db,
    )
    await db.commit()
    return tmpl


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_global_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage global templates")
    tmpl = await template_service.get_global_template(template_id, db)
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
async def delete_global_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage global templates")
    tmpl = await template_service.get_global_template(template_id, db)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await template_service.delete_template(tmpl, db)
    await db.commit()

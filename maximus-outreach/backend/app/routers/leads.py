import math
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_owner
from app.models.user import User
from app.schemas.leads import (
    ImportHistoryResponse,
    LeadCreate,
    LeadImportResponse,
    LeadList,
    LeadResponse,
    LeadUpdate,
    VALID_STATUSES,
)
from app.services import client_service, csv_import_service, lead_service

router = APIRouter(prefix="/clients/{client_id}/leads", tags=["Leads"])


async def _check_client_access(client_id: uuid.UUID, current_user: User, db: AsyncSession):
    """Raise 404 if client doesn't exist, 403 if user has no access."""
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    if not await client_service.user_can_access_client(current_user, client_id, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return client


@router.get("", response_model=LeadList)
async def list_leads(
    client_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: str | None = Query(None),
    has_email: bool | None = Query(None),
    has_phone: bool | None = Query(None),
    has_social: bool | None = Query(None),
    search: str | None = Query(None, max_length=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)

    if status and status not in VALID_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid status filter.")

    leads, total = await lead_service.get_leads(
        client_id, db, page, page_size, status, has_email, has_phone, has_social, search
    )
    return LeadList(
        items=[LeadResponse.from_lead(l) for l in leads],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/import-history", response_model=list[ImportHistoryResponse])
async def import_history(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    records = await lead_service.get_import_history(client_id, db)
    return [ImportHistoryResponse.model_validate(r) for r in records]


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    client_id: uuid.UUID,
    payload: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    lead = await lead_service.create_lead(client_id, payload, db)
    await db.commit()
    await db.refresh(lead)
    return LeadResponse.from_lead(lead)


@router.post("/import", response_model=LeadImportResponse, status_code=status.HTTP_201_CREATED)
async def import_leads(
    client_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are accepted.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    result = await csv_import_service.import_csv(content, file.filename, client_id, db)
    await db.commit()
    return result


@router.patch("/bulk-status", status_code=status.HTTP_200_OK)
async def bulk_update_status(
    client_id: uuid.UUID,
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Body: {"lead_ids": [...], "status": "contacted"}"""
    await _check_client_access(client_id, current_user, db)

    lead_ids = payload.get("lead_ids", [])
    new_status = payload.get("status")

    if not lead_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lead_ids must not be empty.")
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status.")

    try:
        ids = [uuid.UUID(str(i)) for i in lead_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid UUID in lead_ids.")

    count = await lead_service.bulk_update_status(client_id, ids, new_status, db)
    await db.commit()
    return {"updated": count}


@router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete(
    client_id: uuid.UUID,
    payload: dict = Body(...),
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Body: {"lead_ids": [...]}  — Owner only."""
    client = await client_service.get_client_by_id(client_id, db)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    lead_ids = payload.get("lead_ids", [])
    if not lead_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lead_ids must not be empty.")

    try:
        ids = [uuid.UUID(str(i)) for i in lead_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid UUID in lead_ids.")

    count = await lead_service.bulk_delete(client_id, ids, db)
    await db.commit()
    return {"deleted": count}


# --- Parameterized routes LAST (so /bulk and /import-history are not shadowed) ---

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    client_id: uuid.UUID,
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    lead = await lead_service.get_lead_by_id(lead_id, client_id, db)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    return LeadResponse.from_lead(lead)


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    client_id: uuid.UUID,
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    lead = await lead_service.get_lead_by_id(lead_id, client_id, db)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    lead = await lead_service.update_lead(lead, payload, db)
    await db.commit()
    await db.refresh(lead)
    return LeadResponse.from_lead(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    client_id: uuid.UUID,
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_client_access(client_id, current_user, db)
    lead = await lead_service.get_lead_by_id(lead_id, client_id, db)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    await lead_service.delete_lead(lead, db)
    await db.commit()

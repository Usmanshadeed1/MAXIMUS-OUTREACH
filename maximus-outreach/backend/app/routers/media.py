"""
14.1 — Media Library Router

POST /media/upload   — multipart upload (jpg, png, gif, mp4, pdf), max 10 MB
GET  /media          — list (paginated, filterable by client_id)
GET  /media/{id}     — serve file
DELETE /media/{id}   — delete file + DB record
"""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.media import MediaFile
from app.models.user import User

router = APIRouter(prefix="/media", tags=["Media"])

# ---------------------------------------------------------------------------
# Allowed types
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "mp4", "pdf"}
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif",
    "video/mp4",
    "application/pdf",
}
MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024   # default 10 MB


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _ensure_upload_dir() -> Path:
    d = Path(settings.UPLOAD_DIR) / "media"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# POST /media/upload
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    client_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate extension
    ext = _ext(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not allowed. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    # Validate MIME type reported by client (secondary check; extension is primary)
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"MIME type '{file.content_type}' not allowed.",
        )

    # Read & size check
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit.",
        )

    # Save to disk
    upload_dir = _ensure_upload_dir()
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    dest = upload_dir / stored_name
    dest.write_bytes(data)

    # Persist record
    record = MediaFile(
        client_id=client_id,
        file_name=stored_name,
        original_name=file.filename or stored_name,
        file_path=str(dest),
        file_type=ext,
        mime_type=file.content_type or f"application/{ext}",
        file_size=len(data),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": str(record.id),
        "file_name": record.file_name,
        "original_name": record.original_name,
        "file_type": record.file_type,
        "mime_type": record.mime_type,
        "file_size": record.file_size,
        "uploaded_at": record.uploaded_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /media
# ---------------------------------------------------------------------------

@router.get("")
async def list_media(
    client_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(MediaFile)
    if client_id:
        q = q.where(MediaFile.client_id == client_id)

    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    items_q = (
        q.order_by(MediaFile.uploaded_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(items_q)).scalars().all()

    return {
        "items": [
            {
                "id": str(m.id),
                "original_name": m.original_name,
                "file_type": m.file_type,
                "mime_type": m.mime_type,
                "file_size": m.file_size,
                "uploaded_at": m.uploaded_at.isoformat(),
            }
            for m in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ---------------------------------------------------------------------------
# GET /media/{id} — serve file
# ---------------------------------------------------------------------------

@router.get("/{media_id}")
async def serve_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (await db.execute(
        select(MediaFile).where(MediaFile.id == media_id)
    )).scalar_one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="Media file not found")

    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="File missing from storage")

    return FileResponse(
        path=record.file_path,
        media_type=record.mime_type,
        filename=record.original_name,
    )


# ---------------------------------------------------------------------------
# DELETE /media/{id}
# ---------------------------------------------------------------------------

@router.delete("/{media_id}", status_code=204)
async def delete_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (await db.execute(
        select(MediaFile).where(MediaFile.id == media_id)
    )).scalar_one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="Media file not found")

    # Delete file from disk (ignore if already gone)
    try:
        os.remove(record.file_path)
    except FileNotFoundError:
        pass

    await db.delete(record)
    await db.commit()

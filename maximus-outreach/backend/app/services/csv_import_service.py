"""CSV import service for lead ingestion.

Supports two CSV formats from the lead scraper tool:
- Simple  (11–12 cols): keyword,location,title,address,phone,website,rating,reviews,place_id,data_id,[serpapi_link],needs_scraping
- Enriched (19 cols):   same + email,facebook,instagram,linkedin,youtube,twitter,tiktok,scrape_status
"""

import csv
import io
import uuid
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadImport
from app.schemas.leads import LeadImportResponse

# Columns that carry no lead data — always skipped
_SKIP_COLUMNS = {
    "keyword", "location", "place_id", "data_id",
    "serpapi_link", "needs_scraping", "scrape_status",
}

# Enriched-only columns (present only in 19-col format)
_ENRICHED_COLUMNS = {"email", "facebook", "instagram", "linkedin", "youtube", "twitter", "tiktok"}


def _clean(value: str | None, max_len: int = 0) -> str | None:
    """Strip whitespace; return None for empty strings. Optionally truncate."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if max_len and len(v) > max_len:
        return v[:max_len]
    return v


def _clean_email(value: str | None) -> str | None:
    """Extract first valid-looking email from a possibly multi-email cell."""
    if not value or not value.strip():
        return None
    # Scraper sometimes concatenates multiple emails with commas/spaces
    import re
    candidates = re.split(r"[,\s]+", value.strip())
    email_re = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    for c in candidates:
        c = c.strip()
        if email_re.match(c) and len(c) <= 255:
            return c.lower()
    return None


def _to_decimal(value: str | None) -> Decimal | None:
    if not value or not value.strip():
        return None
    try:
        return Decimal(value.strip())
    except InvalidOperation:
        return None


def _to_int(value: str | None) -> int | None:
    if not value or not value.strip():
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


def _is_enriched(headers: list[str]) -> bool:
    header_set = {h.strip().lower() for h in headers}
    return bool(_ENRICHED_COLUMNS & header_set)


def _row_to_lead_fields(row: dict, enriched: bool) -> dict:
    """Map a CSV row dict to Lead constructor kwargs."""
    fields: dict = {
        "business_name": _clean(row.get("title"), max_len=500),
        "address":       _clean(row.get("address"), max_len=500),
        "phone":         _clean(row.get("phone"), max_len=100),
        "website":       _clean(row.get("website"), max_len=500),
        "rating":        _to_decimal(row.get("rating")),
        "reviews":       _to_int(row.get("reviews")),
        "source":        "csv_import",
        "status":        "new",
    }
    if enriched:
        fields.update({
            "email":     _clean_email(row.get("email")),
            "facebook":  _clean(row.get("facebook"), max_len=500),
            "instagram": _clean(row.get("instagram"), max_len=500),
            "linkedin":  _clean(row.get("linkedin"), max_len=500),
            "youtube":   _clean(row.get("youtube"), max_len=500),
            "twitter":   _clean(row.get("twitter"), max_len=500),
            "tiktok":    _clean(row.get("tiktok"), max_len=500),
        })
    return fields


async def _existing_emails(client_id: uuid.UUID, db: AsyncSession) -> set[str]:
    result = await db.execute(
        select(Lead.email).where(Lead.client_id == client_id, Lead.email.isnot(None))
    )
    return {row[0].lower() for row in result.all()}


async def _existing_phones(client_id: uuid.UUID, db: AsyncSession) -> set[str]:
    result = await db.execute(
        select(Lead.phone).where(Lead.client_id == client_id, Lead.phone.isnot(None))
    )
    return {row[0] for row in result.all()}


async def _existing_names(client_id: uuid.UUID, db: AsyncSession) -> set[str]:
    """Fallback dedup key for leads with no email and no phone."""
    result = await db.execute(
        select(Lead.business_name).where(Lead.client_id == client_id, Lead.business_name.isnot(None))
    )
    return {row[0].lower() for row in result.all()}


async def import_csv(
    file_content: bytes,
    file_name: str,
    client_id: uuid.UUID,
    db: AsyncSession,
) -> LeadImportResponse:
    """Parse CSV bytes, dedup, insert leads, track import record."""

    text = file_content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    enriched = _is_enriched(headers)

    # Load existing dedup sets once up-front
    seen_emails = await _existing_emails(client_id, db)
    seen_phones = await _existing_phones(client_id, db)
    seen_names = await _existing_names(client_id, db)

    # Create import record first (gets filled in after processing)
    import_record = LeadImport(
        client_id=client_id,
        file_name=file_name,
        status="processing",
    )
    db.add(import_record)
    await db.flush()  # get import_record.id

    total_rows = 0
    imported = 0
    duplicates = 0
    errors = 0

    for row in reader:
        total_rows += 1
        try:
            fields = _row_to_lead_fields(row, enriched)

            email = fields.get("email")
            phone = fields.get("phone")
            name = fields.get("business_name")

            # Dedup: skip if email OR phone already exists for this client
            if email and email.lower() in seen_emails:
                duplicates += 1
                continue
            if phone and phone in seen_phones:
                duplicates += 1
                continue
            # Fallback dedup for leads with no contact info: match by business_name
            if not email and not phone and name and name.lower() in seen_names:
                duplicates += 1
                continue

            lead = Lead(
                client_id=client_id,
                import_id=import_record.id,
                **fields,
            )
            db.add(lead)

            # Track in local sets to catch intra-file duplicates too
            if email:
                seen_emails.add(email.lower())
            if phone:
                seen_phones.add(phone)
            if not email and not phone and name:
                seen_names.add(name.lower())

            imported += 1

        except Exception:
            errors += 1

    # Update import record with final counts
    import_record.total_rows = total_rows
    import_record.imported_count = imported
    import_record.duplicates_skipped = duplicates
    import_record.errors_count = errors
    import_record.status = "completed"

    return LeadImportResponse(
        file_name=file_name,
        total_rows=total_rows,
        imported_count=imported,
        duplicates_skipped=duplicates,
        errors_count=errors,
    )

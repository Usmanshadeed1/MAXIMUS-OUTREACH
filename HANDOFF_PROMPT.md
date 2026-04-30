# Lead Outreach Scheduler — Handoff Prompt for Next Developer

## Status
**Phase:** User Decision Pending  
**Progress:** Code review complete. Awaiting user answers to architecture questions.  
**What's Done:** Full codebase analysis, architecture assessment, 3 implementation paths designed.  
**What's Blocked:** User hasn't chosen between Options A, B, or C yet.

---

## Context

The user wants to build a **Celery Beat scheduled task** that automates outreach to leads in a CSV file (`kitchen_cabinet_leads_enriched.csv`). The scheduler reads leads, applies 4 rules (daily cap, cooldown, response check, next platform), sends messages through Email → Facebook → Instagram → WhatsApp in sequence, and writes results back to the CSV.

**Original spec is in:** `AI Dev Prompt.md` (detailed rules and pseudocode)

---

## Critical Finding: Architecture Mismatch

**The user's spec describes:** CSV-only scheduler (read CSV → apply rules → write CSV)  
**The existing system is:** Database-driven, multi-tenant, async/await

### The Problem

The existing send functions **cannot work standalone:**

```python
# email_service.py
async def send_email(to, subject, body_html, db, ...) -> dict:
    # Requires db to:
    limit = _effective_limit(smtp)  # fetch from db
    if smtp.sent_today >= limit:
        return {"error": "Daily limit reached"}
    # ... send ...
    await _increment_sent_today(smtp, db)  # update db counter
```

```python
# whatsapp_service.py
async def send_whatsapp(to, body, client_id, db, ...) -> dict:
    # Requires db to:
    settings = await get_settings(db)  # fetch credentials
    phone_number = await get_number_for_client(client_id, db)  # client-specific number
    # ... send ...
    phone_number.sent_today += 1  # update counter
```

**Key constraints:**
- Email requires database to track daily SMTP limits
- WhatsApp requires `client_id` for multi-tenant routing and database for credentials
- Facebook/Instagram have NO automation API — only manual queue system

---

## Three Implementation Paths

### Option A: CSV-Only Standalone
**Read/write CSV directly, no database involvement**

**Code locations:**
- Create: `app/workers/csv_outreach_worker.py`
- Modify: `app/workers/celery_app.py` (add Beat schedule)

**Pros:**
- Matches user's original spec exactly
- No database required
- Simple to understand

**Cons:**
- Cannot reuse `email_service.send_email()` or `whatsapp_service.send_whatsapp()`
- Must write new lightweight send functions OR refactor existing ones
- No daily limit tracking (would need CSV headers or separate config)
- WhatsApp requires credentials somewhere (how?)
- Email requires SMTP account selection (which one?)

**Effort:** Medium  
**Risk:** High (untested send paths, credential management unclear)

---

### Option B: Light Database Integration (RECOMMENDED)
**Leads in database, lightweight tracking table for sent dates**

**Code locations:**
- Create: `app/workers/csv_outreach_worker.py`
- Create: `app/models/csv_tracking.py` (new table: `csv_outreach_tracking`)
- Modify: `app/workers/celery_app.py`

**New table schema:**
```python
class CsvOutreachTracking(Base):
    __tablename__ = "csv_outreach_tracking"
    id: Mapped[uuid.UUID] = primary_key
    lead_id: Mapped[uuid.UUID] = ForeignKey("leads.id")
    email_sent: Mapped[datetime | None] = None
    facebook_sent: Mapped[datetime | None] = None
    instagram_sent: Mapped[datetime | None] = None
    whatsapp_sent: Mapped[datetime | None] = None
    responded: Mapped[str | None] = None  # "YES" if responded
    restart_needed: Mapped[str | None] = None  # "YES" if all tried
```

**Pros:**
- Reuses proven `email_service.send_email()` and `whatsapp_service.send_whatsapp()`
- Reuses credential management and daily limit logic
- Can reuse existing `csv_import_service.py` to import from CSV
- Aligns with multi-tenant architecture
- Future-proof (can expand to multiple clients)
- Can generate reports from database

**Cons:**
- Requires user to set up SMTP account(s) and WhatsApp credentials in database
- Requires creating a Client record (or using existing one)
- Slightly more setup

**Effort:** Low-Medium  
**Risk:** Low (reuses tested code)

**Implementation steps:**
1. Import CSV leads via `csv_import_service.import_csv()`
2. Create Client record if needed
3. Build `csv_outreach_worker.py` that:
   - Queries leads from database
   - Applies 4 rules
   - Calls `email_service.send_email()` and `whatsapp_service.send_whatsapp()`
   - Queues Facebook/Instagram to `SocialDmQueue`
   - Updates `CsvOutreachTracking` table with sent dates
4. Add Beat schedule entry for daily run

---

### Option C: Full Campaign System
**Import CSV → create Campaign with 4 Steps → use existing scheduler/outreach workers**

**Code locations:**
- Reuse: `app/workers/scheduler_worker.py` (already runs campaigns)
- Reuse: `app/workers/outreach_worker.py` (already sends messages)
- No new worker needed

**Pros:**
- Zero new code (mostly API calls)
- Reuses all existing monitoring, retry logic, tracking
- Most robust
- Can manage from UI

**Cons:**
- Overkill for a simple CSV scheduler
- Adds pacing, enrollment complexity
- Harder to understand

**Effort:** Very Low  
**Risk:** Very Low

**Implementation:**
1. Import CSV: `csv_import_service.import_csv()`
2. Create Campaign with 4 CampaignSteps (email, facebook, instagram, whatsapp)
3. Enroll leads: `campaign_service.enroll_leads(campaign_id, lead_ids)`
4. Start campaign: `campaign_service.start_campaign(campaign)`
5. System automatically dispatches via existing workers every 5 minutes

---

## Files Already Reviewed

### Core Services
- `app/services/email_service.py` — SMTP, daily limits, tracking pixels, link rewriting
- `app/services/whatsapp_service.py` — Meta Cloud API, templates, freeform text, media
- `app/services/social_dm_service.py` — Platform detection, manual queue
- `app/services/csv_import_service.py` — CSV parsing, format detection, deduplication
- `app/services/campaign_service.py` — Campaign execution, step scheduling, template rendering

### Workers
- `app/workers/celery_app.py` — Celery config, Beat schedule definition
- `app/workers/outreach_worker.py` — Message dispatch per channel (email/SMS/WhatsApp)
- `app/workers/scheduler_worker.py` — Campaign step dispatch

### Models
- `app/models/lead.py` — Lead and LeadImport
- `app/models/outreach.py` — OutreachLog and SocialDmQueue
- `app/models/campaign.py` — Campaign, CampaignStep, CampaignEnrollment
- `app/models/settings.py` — SMTP, WhatsApp, SMS credentials

---

## CSV File Details

**Location:** `Sample data csvs/kitchen_cabinet_leads_enriched.csv`

**Current columns (19):**
- `keyword`, `location`, `title`, `address`, `phone`, `website`, `rating`, `reviews`, `place_id`, `data_id`, `needs_scraping`, `email`, `facebook`, `instagram`, `linkedin`, `youtube`, `twitter`, `tiktok`, `scrape_status`

**Column mapping:**
- `title` → Lead.business_name
- `phone` → Lead.phone (for WhatsApp)
- `email` → Lead.email (for Email)
- `facebook` → Lead.facebook
- `instagram` → Lead.instagram

**Columns to add** (per user spec):
- `email_sent` — YYYY-MM-DD format
- `facebook_sent` — YYYY-MM-DD format
- `instagram_sent` — YYYY-MM-DD format
- `whatsapp_sent` — YYYY-MM-DD format
- `responded` — "YES" if lead replied (human-set)
- `restart_needed` — "YES" if all 4 platforms exhausted (scheduler-set)

**Sample data:** 4 kitchen cabinet leads. Most have phone numbers, empty email/social (typical for Google Maps scraper).

---

## Documentation Created for User

Three HTML files in the project root guide the user:

1. **`QUESTIONS.html`** (initial)
   - Basic questions about implementation approach
   - Message templates
   - WhatsApp setup

2. **`ANSWERS.html`** (updated)
   - Form for user to provide answers
   - Dropdown options and text areas
   - Auto-generates summary on submit

3. **`CODE_REVIEW_SUMMARY.html`** (NEW — comprehensive)
   - Explains the architecture mismatch
   - Compares 3 implementation paths
   - Details what's working/not working
   - CSV file analysis
   - Celery setup info

4. **Plan file** (private)
   - `C:\Users\Eddie\.claude\plans\that-is-a-pretty-calm-muffin.md`
   - Technical findings and implementation notes

---

## What User Needs to Decide

**Critical question:** Which path?

**Required info** (fill in ANSWERS.html):
1. **Architecture choice:** A (CSV-only), B (light DB), or C (full campaign)?
2. **Message templates:** What text to send on each platform?
3. **Facebook/Instagram:** Queue for manual or skip?
4. **WhatsApp template:** Approved template name (if applicable)?
5. **CSV location:** Use kitchen_cabinet_leads_enriched.csv?
6. **Run time:** What time daily? (6 AM UTC / 6 AM Pakistan / custom?)
7. **If Option B/C:** Do they have SMTP and WhatsApp credentials set up in database?

---

## Next Steps When User Provides Answers

1. **Read their answers** from ANSWERS.html
2. **Confirm their architecture choice** (A, B, or C)
3. **For Option A (CSV-only):**
   - Design lightweight send functions (no db required)
   - Handle WhatsApp credentials (env var? hardcoded? external API?)
   - Handle SMTP account selection (which account to use?)
   - Implement CSV read/write with the 6 new columns
   - Implement 4 rules with in-memory daily counters
   - Implement logging

4. **For Option B (Light DB) - RECOMMENDED:**
   - Create migration: `alembic revision --autogenerate -m "Add csv_outreach_tracking table"`
   - Create model: `app/models/csv_tracking.py`
   - Create worker: `app/workers/csv_outreach_worker.py`
   - Modify: `app/workers/celery_app.py` (add schedule entry)
   - Implement:
     - Import CSV to database
     - Query leads and tracking
     - Apply 4 rules
     - Call `email_service.send_email()` and `whatsapp_service.send_whatsapp()`
     - Queue Facebook/Instagram to `SocialDmQueue`
     - Update tracking table
   - Add logging

5. **For Option C (Full Campaign):**
   - Just call existing APIs to create campaign and steps
   - Enroll leads
   - Start campaign
   - Done (existing workers handle the rest)

---

## Key Code Patterns to Follow

### Async/Await Pattern
All database operations are async. Example:
```python
async def _async_run() -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Lead).where(...))
        leads = result.scalars().all()
        # ...
        await db.commit()
    return {...}
```

### Celery Task Pattern
Wrap async in sync task using `asyncio.run()`:
```python
@celery_app.task(name="app.workers.csv_outreach_worker.run_csv_outreach")
def run_csv_outreach() -> dict:
    return asyncio.run(_async_run())
```

### Database Query Pattern
```python
from sqlalchemy import select
result = await db.execute(select(Lead).where(Lead.client_id == client_id))
leads = result.scalars().all()
```

### Template Rendering
```python
def _render_template(template: str, lead: Lead) -> str:
    return (
        template
        .replace("{business_name}", lead.business_name or "")
        .replace("{phone}", lead.phone or "")
        .replace("{email}", lead.email or "")
        .replace("{address}", lead.address or "")
    )
```

---

## Testing Checklist

Once implemented:
- [ ] Task runs without errors
- [ ] All 4 rules applied correctly
- [ ] Daily caps respected (10 per platform)
- [ ] Cooldown check (3 days) working
- [ ] Response check (skip if responded=YES) working
- [ ] Next platform logic (Email → Facebook → Instagram → WhatsApp) working
- [ ] CSV columns updated (for Option A) or database updated (for B/C)
- [ ] Logging shows all activity
- [ ] Edge cases handled:
  - [ ] Lead with no email, no phone, no social
  - [ ] Send fails — date NOT written
  - [ ] All 4 platforms tried — restart_needed marked
  - [ ] Mid-run daily cap hit — continue other platforms

---

## Environment

**Stack:**
- FastAPI 0.115
- SQLAlchemy 2.0 async
- PostgreSQL (via asyncpg)
- Redis (Celery broker/backend)
- Celery 5.4
- Python 3.10+

**Running on:** FastAPI backend + Celery workers

**Config file:** `app/config.py` (Pydantic BaseSettings from .env)

---

## Important Notes

1. **Windows compatibility:** Code uses `asyncio.WindowsSelectorEventLoopPolicy()` for asyncpg on Windows
2. **Beat schedule timezone:** Currently UTC. Update if user needs different timezone.
3. **Retry logic:** Celery retries up to 3 times with 60s delay. Inherited by new task if using same pattern.
4. **Logging:** Each task returns a dict with counts. Add logging module for detailed output.
5. **Multi-tenant:** System is designed for multiple clients. If Option B/C, ensure client_id is handled correctly.
6. **CSV format:** Both simple (11-col) and enriched (19-col) supported by import_csv. This uses enriched format.

---

## Quick Reference: File Locations

```
maximus-outreach/
├── backend/
│   ├── app/
│   │   ├── workers/
│   │   │   ├── celery_app.py          ← ADD BEAT SCHEDULE HERE
│   │   │   ├── csv_outreach_worker.py  ← CREATE THIS
│   │   │   ├── outreach_worker.py      (reference)
│   │   │   └── scheduler_worker.py     (reference)
│   │   ├── services/
│   │   │   ├── email_service.py        (use for Option B/C)
│   │   │   ├── whatsapp_service.py     (use for Option B/C)
│   │   │   ├── social_dm_service.py    (use for Facebook/Instagram)
│   │   │   ├── campaign_service.py     (use for Option C)
│   │   │   └── csv_import_service.py   (use for imports)
│   │   ├── models/
│   │   │   ├── lead.py                 (reference)
│   │   │   ├── outreach.py             (reference)
│   │   │   ├── campaign.py             (use for Option C)
│   │   │   └── csv_tracking.py         (CREATE FOR Option B)
│   │   ├── config.py                   (reference)
│   │   └── database.py                 (reference)
│   └── requirements.txt                (all deps installed)
├── Sample data csvs/
│   └── kitchen_cabinet_leads_enriched.csv  ← INPUT FILE
└── (project root)
    ├── QUESTIONS.html                  (user reference)
    ├── ANSWERS.html                    (user fills this out)
    ├── CODE_REVIEW_SUMMARY.html        (detailed analysis)
    ├── SCHEDULER_EXPLANATION.html      (user-facing intro)
    └── AI Dev Prompt.md                (original spec)
```

---

## When You're Ready to Code

1. **Ask user:** "Have you filled out ANSWERS.html and provided your responses?"
2. **Read their answers** — especially the architecture choice
3. **If Option A:** Clarify credential management before starting
4. **If Option B:** Good to go — recommend this path
5. **If Option C:** Good to go — simplest path
6. **Implement systematically** — start with Task structure, then add business logic
7. **Test thoroughly** — especially the 4 rules and edge cases
8. **Document your code** — comment the 4 rules clearly

---

## Questions to Ask User If Unclear

- "Which architecture path (A/B/C) do you prefer?"
- "Do you have SMTP credentials already set up in the database?" (for Options B/C)
- "Do you have WhatsApp credentials already set up?" (for Options B/C)
- "What is your default client_id?" (for Options B/C)
- "What exactly should each message say?" (provide full templates)
- "Do you have an approved WhatsApp template name?" (for WhatsApp first contact)

---

**Status Summary:**  
✅ Code reviewed  
✅ Architecture analyzed  
✅ 3 paths designed  
⏳ Awaiting user decision on path  
⏳ Awaiting message templates  
⏳ Ready to implement once answers provided

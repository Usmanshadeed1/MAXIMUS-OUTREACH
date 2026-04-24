# MAXIMUS OUTREACH — Master Development Prompt

---

## META PROMPT — FOR LLM DEVELOPER AGENT

You are a team of senior software developers building **Maximus Outreach** — a multi-tenant AI-powered outreach automation platform. This platform allows a digital marketing agency owner to manage multiple business clients, import leads (from CSV), and run automated multi-channel outreach campaigns using AI-generated personalized messages.

### Your Roles:

| Role | Responsibility |
|---|---|
| **Senior Backend Developer** | Python FastAPI, PostgreSQL, Celery workers, API integrations (Twilio, WhatsApp, SMTP, AI), security, database schema, migrations |
| **Senior Frontend Developer** | Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, Recharts, accessibility (WCAG 2.1 AA), dark/light theme, responsive design, clean component architecture |
| **QA Engineer** | End-to-end testing, integration tests, unit tests, security audit |

### Rules For Development:

1. **Work phase by phase, task by task** — Complete task 1.1 fully before moving to 1.2
2. **Test after each task** — Run the test described in each task before proceeding
3. **Clean code** — No dead code, no console.logs left behind, proper error handling at boundaries
4. **Type safety** — TypeScript strict mode on frontend, Pydantic models on backend
5. **Security first** — Parameterized queries, input validation, rate limiting, JWT auth, CORS configured
6. **Git commit after each completed phase** — Message format: `Phase X.Y: description`
7. **Do not skip steps** — Each task builds on the previous one
8. **Ask if unclear** — If a task description is ambiguous, ask before implementing

---

## PROJECT OVERVIEW

### What Is Maximus Outreach?

A self-hosted platform with **role-based access** (Owner + Managers) where:

**Owner (you — the agency operator) can:**
1. **Create clients** (e.g., Maximus Kitchens, Maximus Construction, Maximus Gaming)
2. **Create manager accounts** and assign them to specific clients
3. **Configure AI** to generate personalized outreach messages per client (unique tone, services, pitch)
4. **Access all settings** (SMTP, AI keys, Twilio, WhatsApp)
5. **See everything** — all clients, all analytics, all data
6. **Do everything managers can do** (below)

**Managers (your employees) can:**
1. **Import leads** for assigned clients (multiple CSV uploads, manual entry)
2. **Build campaign sequences** (configurable channel order, delays, stop conditions)
3. **Pace lead enrollment** — control how many leads enter the campaign per day/week (anti-ban protection)
4. **Execute outreach** automatically (Email, SMS/MMS, WhatsApp) and semi-automatically (Social DMs)
5. **Handle responses** (AI drafts replies, human reviews and approves before sending)
6. **Track analytics** for their assigned clients only

**Managers CANNOT:** create/edit/delete clients, access settings, manage users, bulk delete leads.

**Client switching:** Users with multiple assigned clients see a client selector dropdown in the top nav. Each client's data is fully isolated.

### Outreach Channels:

| Channel | Automation Level | API/Method |
|---|---|---|
| **Email** | Fully automatic | SMTP (user's Hostgator or any SMTP provider) |
| **SMS/MMS** | Fully automatic (text + images + videos) | Twilio API |
| **WhatsApp** | Fully automatic (text + media + documents) | WhatsApp Business Cloud API (Meta) |
| **Social Media DMs** | Semi-automatic (AI writes message, user copy-pastes and sends manually) | Supports ALL platforms: Facebook, Instagram, LinkedIn, TikTok, Twitter/X, Snapchat, YouTube, any URL |
| **AI Voice Calls** | Future addition | Not in current scope |

### Key Design Principles:

- **Multi-tenant**: Each client is isolated — own leads, campaigns, settings, analytics
- **Role-based access**: Owner sees everything, Managers see only assigned clients
- **AI-native**: Every outreach message is AI-generated using lead data + client context
- **Configurable**: Campaign sequences, channels, delays, follow-ups — all customizable per client
- **Safe sending**: Email warmup, enrollment pacing, rate limits per channel, auto-stop on reply, skip missing channels
- **Batch-safe for large lists**: Upload 4000+ leads — system paces enrollment over weeks to prevent bans
- **Professional UI**: Dark/light theme, WCAG 2.1 AA accessible, responsive, modern design system

---

## ANTI-BAN PROTECTION SYSTEM

### The Problem:
Uploading 4000 leads and blasting them all on day 1 = banned/blacklisted on every channel.

### The Solution: Enrollment Pacing

When starting a campaign with a large lead list, the owner configures a **pacing schedule**:

```
CAMPAIGN PACING SETTINGS:
┌──────────────────────────────────────────────────┐
│  Total enrolled leads: 4,000                     │
│                                                  │
│  Pacing Mode: [Gradual Ramp-Up ▼]               │
│                                                  │
│  Week 1:  50 leads/day  (350/week)               │
│  Week 2:  100 leads/day (700/week)               │
│  Week 3:  150 leads/day (1,050/week)             │
│  Week 4+: 200 leads/day (1,400/week)             │
│                                                  │
│  Estimated completion: ~5 weeks                  │
│  Send during: 9:00 AM - 6:00 PM (business hours)│
│                                                  │
│  [Custom Schedule] [Save]                        │
└──────────────────────────────────────────────────┘
```

### How It Works:

1. User uploads CSV → all 4000 leads imported with status `new`
2. User enrolls all 4000 into a campaign
3. Campaign enrollment status for each lead:
   - `queued` — waiting for their turn (pacing not reached them yet)
   - `active` — currently in the sequence (messages being sent)
   - `completed` — all steps done
   - `replied` — lead replied, sequence stopped
   - `stopped` — manually stopped
4. The scheduler activates X leads per day based on the pacing schedule
5. Only `active` leads get their campaign steps executed
6. Dashboard shows: "Campaign Progress: 750 of 4,000 leads activated (Week 3)"

### Pacing Modes:

| Mode | Description | Best For |
|---|---|---|
| **All at once** | Activate all leads immediately | Small lists (<100) |
| **Fixed daily** | Same number per day (e.g., 50/day) | Steady outreach |
| **Gradual ramp-up** | Start slow, increase weekly | Large lists, new domains/numbers |
| **Custom schedule** | User defines exact leads/day per week | Full control |

### Per-Channel Rate Limits (In Addition to Pacing):

| Channel | Default Daily Limit | Configurable? | Notes |
|---|---|---|---|
| Email | Follows SMTP warmup schedule | Yes | Start 20/day, ramp to 200/day over 3 weeks |
| SMS | 500/day per Twilio number | Yes | Register for A2P 10DLC ($15 one-time) |
| WhatsApp | 250/day (new) → 1K → 10K | Partly | Meta controls tier upgrades automatically |
| Social DM | 30/day recommended | Suggested | Human sending pace, not API limited |

### Multiple CSV Imports:

- Upload multiple CSV files over time to the same client
- Each import is tracked: filename, date, lead count, duplicates skipped
- Deduplication: same email OR same phone within a client = skip
- Import history visible: "Import #1: 500 leads (Apr 16), Import #2: 300 leads (Apr 20)..."
- Can import enriched CSV (with emails/social) or simple CSV (just business info)

---

## TECH STACK

### Backend:

| Component | Technology | Why |
|---|---|---|
| Framework | **Python 3.11+ / FastAPI** | Async native, auto API docs (Swagger), Pydantic validation |
| Database | **PostgreSQL 16** | Robust, free, handles complex queries, JSON support |
| ORM | **SQLAlchemy 2.0 + Alembic** | Async ORM, migration management |
| Task Queue | **Celery + Redis** | Scheduled outreach, background jobs, retries, rate limiting |
| Cache | **Redis** | Session cache, rate limit counters, job status |
| Auth | **JWT (python-jose + passlib)** | Stateless auth, bcrypt password hashing |
| Email | **aiosmtplib** | Async SMTP sending |
| SMS/MMS | **twilio** | Official Twilio Python SDK |
| WhatsApp | **httpx** | Direct Meta Cloud API calls |
| AI | **httpx** | OpenRouter / Groq API calls (OpenAI-compatible format) |
| File Storage | **Local filesystem** | Media uploads stored in `/uploads/` |
| Validation | **Pydantic v2** | Request/response schemas |
| Testing | **pytest + pytest-asyncio + httpx** | Async test support |

### Frontend:

| Component | Technology | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Server components, file-based routing |
| Language | **TypeScript (strict mode)** | Type safety |
| Styling | **Tailwind CSS 3** | Utility-first, dark/light theme via class strategy |
| Components | **shadcn/ui** | Accessible (Radix UI), customizable, professional |
| Charts | **Recharts** | React-native charting, responsive |
| Data Fetching | **TanStack Query (React Query)** | Caching, refetching, loading states |
| Forms | **React Hook Form + Zod** | Validation, performance |
| Icons | **Lucide React** | Clean, consistent icon set |
| Theme | **next-themes** | Dark/light toggle with system preference |
| Notifications | **Sonner** | Toast notifications |
| Tables | **TanStack Table** | Sortable, filterable, paginated data tables |

### Infrastructure (Windows VPS Deployment):

| Component | Technology |
|---|---|
| OS | Windows Server (Remote Desktop VPS) |
| Python | 3.11+ via official installer |
| Node.js | 20 LTS via official installer |
| PostgreSQL | 16 via official Windows installer |
| Redis | Memurai (Redis-compatible for Windows) or Redis via WSL2 |
| Process Manager | NSSM (Non-Sucking Service Manager) — runs FastAPI + Celery + Next.js as Windows services |
| Reverse Proxy | Caddy (auto HTTPS with Let's Encrypt) |

---

## DATABASE SCHEMA

### Entity Relationship Overview:

```
Users (Owner + Managers)
 ├── Owner (1) — full access to everything
 └── Managers (many) — assigned to specific clients
      └── User-Client Assignments (which manager → which clients)

Clients (many)
 ├── Client Settings (tone, services, AI config)
 ├── Leads (many, imported via multiple CSVs)
 │    └── Lead Import History (which CSV, when, how many)
 ├── Campaigns (many)
 │    ├── Campaign Steps (ordered sequence)
 │    │    └── Step Media Attachments (images, videos)
 │    ├── Campaign Pacing Config (leads/day per week)
 │    └── Campaign Enrollments (lead + campaign)
 │         └── Outreach Log (per step execution)
 └── Conversations (responses from leads)
      └── Messages (thread)

Global Settings (Owner only):
 ├── SMTP Accounts (multiple, with warmup)
 ├── AI API Keys (OpenRouter/Groq, rotation pool)
 ├── Twilio Config
 └── WhatsApp Config
```

### Table Definitions:

```sql
-- Users (Owner + Managers)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'manager',  -- 'owner' or 'manager'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User-Client Assignments (which managers can access which clients)
-- Owner has implicit access to ALL clients (no rows needed)
-- Managers only see clients they are assigned to
CREATE TABLE user_client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Clients (multi-tenant)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(255),
    services TEXT,
    target_audience TEXT,
    tone VARCHAR(50) DEFAULT 'professional',
    pitch TEXT,
    website VARCHAR(500),
    phone VARCHAR(50),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    custom_instructions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Lead Import History (tracks each CSV upload)
CREATE TABLE lead_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    total_rows INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    duplicates_skipped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    imported_at TIMESTAMP DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    import_id UUID REFERENCES lead_imports(id) ON DELETE SET NULL,
    business_name VARCHAR(500),
    address TEXT,
    phone VARCHAR(100),
    website VARCHAR(500),
    email VARCHAR(255),
    rating DECIMAL(3,1),
    reviews INTEGER,
    facebook VARCHAR(500),
    instagram VARCHAR(500),
    linkedin VARCHAR(500),
    youtube VARCHAR(500),
    twitter VARCHAR(500),
    tiktok VARCHAR(500),
    snapchat VARCHAR(500),
    other_social JSONB DEFAULT '{}',
    source VARCHAR(100) DEFAULT 'csv_import',
    status VARCHAR(50) DEFAULT 'new',
    tags JSONB DEFAULT '[]',
    notes TEXT,
    imported_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, email),
    UNIQUE(client_id, phone)
);

-- Campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    stop_on_reply BOOLEAN DEFAULT true,
    max_attempts INTEGER DEFAULT 1,
    repeat_delay_days INTEGER DEFAULT 14,
    -- Pacing settings
    pacing_mode VARCHAR(50) DEFAULT 'gradual_rampup',
    pacing_leads_per_day JSONB DEFAULT '{"week1": 50, "week2": 100, "week3": 150, "week4_plus": 200}',
    send_window_start TIME DEFAULT '09:00',
    send_window_end TIME DEFAULT '18:00',
    send_timezone VARCHAR(50) DEFAULT 'America/New_York',
    total_enrolled INTEGER DEFAULT 0,
    total_activated INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Steps (the sequence)
CREATE TABLE campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    channel VARCHAR(50) NOT NULL,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    message_template TEXT,
    use_ai_generation BOOLEAN DEFAULT true,
    ai_prompt_override TEXT,
    subject_template VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Step Media (images/videos/documents attached to a step)
CREATE TABLE step_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID REFERENCES campaign_steps(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Enrollments (which leads are in which campaigns)
CREATE TABLE campaign_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'queued',
    current_step INTEGER DEFAULT 0,
    current_attempt INTEGER DEFAULT 1,
    activated_at TIMESTAMP,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(campaign_id, lead_id)
);

-- Outreach Log (every message sent or queued)
CREATE TABLE outreach_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES campaign_enrollments(id) ON DELETE CASCADE,
    step_id UUID REFERENCES campaign_steps(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    message_content TEXT,
    subject VARCHAR(500),
    media_urls JSONB DEFAULT '[]',
    social_platform VARCHAR(50),
    social_profile_url VARCHAR(500),
    ai_model_used VARCHAR(100),
    external_id VARCHAR(255),
    error_message TEXT,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversations (response handling)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]',
    is_ai_generated BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Social DM Queue (manual sending queue)
CREATE TABLE social_dm_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outreach_log_id UUID REFERENCES outreach_log(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    profile_url VARCHAR(500) NOT NULL,
    message_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMTP Settings (global, multiple accounts)
CREATE TABLE smtp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 587,
    username VARCHAR(255) NOT NULL,
    password_encrypted VARCHAR(500) NOT NULL,
    use_tls BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    daily_limit INTEGER DEFAULT 200,
    sent_today INTEGER DEFAULT 0,
    warmup_enabled BOOLEAN DEFAULT false,
    warmup_start_date DATE,
    warmup_current_daily_limit INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT true,
    last_health_check TIMESTAMP,
    health_status VARCHAR(50) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI API Keys (rotation pool — supports any OpenAI-compatible provider)
CREATE TABLE ai_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    api_key_encrypted VARCHAR(500) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    requests_today INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 1000,
    last_health_check TIMESTAMP,
    health_status VARCHAR(50) DEFAULT 'unknown',
    last_error TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMS Provider Settings (one active record — Twilio OR Telnyx, owner's choice)
CREATE TABLE sms_provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,           -- 'twilio' or 'telnyx'
    -- Twilio fields
    twilio_account_sid VARCHAR(255),
    twilio_auth_token_encrypted VARCHAR(500),
    -- Telnyx fields
    telnyx_api_key_encrypted VARCHAR(500),
    -- Shared
    is_active BOOLEAN DEFAULT true,
    health_status VARCHAR(50) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMS Phone Numbers (one per client — Option B; works for both Twilio and Telnyx)
CREATE TABLE sms_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,  -- NULL = pool/unassigned
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255),
    daily_limit INTEGER DEFAULT 500,
    sent_today INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Note: leads table has a 'carrier' VARCHAR(50) column for Email-to-SMS gateway lookup
-- e.g. 'att', 'verizon', 'tmobile', 'sprint', 'unknown'

-- WhatsApp Settings
CREATE TABLE whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id VARCHAR(255) NOT NULL,
    access_token_encrypted VARCHAR(500) NOT NULL,
    business_account_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 250,
    sent_today INTEGER DEFAULT 0,
    health_status VARCHAR(50) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email Warmup Schedule
CREATE TABLE email_warmup_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smtp_id UUID REFERENCES smtp_settings(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    daily_limit INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics Events (denormalized for fast queries)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID,
    lead_id UUID,
    channel VARCHAR(50),
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_client ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_import ON leads(import_id);
CREATE INDEX idx_outreach_log_status ON outreach_log(status);
CREATE INDEX idx_outreach_log_scheduled ON outreach_log(scheduled_at);
CREATE INDEX idx_social_dm_queue_status ON social_dm_queue(status);
CREATE INDEX idx_analytics_client ON analytics_events(client_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
CREATE INDEX idx_enrollments_status ON campaign_enrollments(status);
CREATE INDEX idx_enrollments_campaign ON campaign_enrollments(campaign_id);
CREATE INDEX idx_lead_imports_client ON lead_imports(client_id);
CREATE INDEX idx_user_assignments_user ON user_client_assignments(user_id);
CREATE INDEX idx_user_assignments_client ON user_client_assignments(client_id);
```

---

## PROJECT STRUCTURE

```
maximus-outreach/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry point
│   │   ├── config.py                  # Settings from .env
│   │   ├── database.py                # Async SQLAlchemy engine + session
│   │   ├── security.py                # JWT, password hashing, encryption
│   │   ├── dependencies.py            # FastAPI dependency injection
│   │   ├── models/                    # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── client.py
│   │   │   ├── lead.py
│   │   │   ├── campaign.py
│   │   │   ├── outreach.py
│   │   │   ├── conversation.py
│   │   │   ├── settings.py
│   │   │   └── analytics.py
│   │   ├── schemas/                   # Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── client.py
│   │   │   ├── lead.py
│   │   │   ├── campaign.py
│   │   │   ├── outreach.py
│   │   │   ├── conversation.py
│   │   │   ├── settings.py
│   │   │   └── analytics.py
│   │   ├── routers/                   # API route handlers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py               # User management (owner only)
│   │   │   ├── clients.py
│   │   │   ├── leads.py
│   │   │   ├── campaigns.py
│   │   │   ├── outreach.py
│   │   │   ├── social_queue.py
│   │   │   ├── conversations.py
│   │   │   ├── review_queue.py
│   │   │   ├── settings.py
│   │   │   ├── analytics.py
│   │   │   └── media.py
│   │   ├── services/                  # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── user_service.py        # User CRUD, client assignment
│   │   │   ├── ai_service.py         # AI message generation with key rotation
│   │   │   ├── email_service.py      # SMTP sending with warmup
│   │   │   ├── sms_service.py        # Twilio SMS/MMS sending
│   │   │   ├── whatsapp_service.py   # WhatsApp Cloud API sending
│   │   │   ├── social_dm_service.py  # Social DM queue management
│   │   │   ├── campaign_service.py   # Campaign execution + pacing logic
│   │   │   ├── scheduler_service.py  # Sequence scheduling + rate limits
│   │   │   ├── pacing_service.py     # Enrollment pacing (leads/day activation)
│   │   │   ├── conversation_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── csv_import_service.py # CSV parsing and lead import
│   │   ├── workers/                   # Celery task workers
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── outreach_worker.py    # Process outreach queue
│   │   │   ├── scheduler_worker.py   # Check scheduled messages
│   │   │   ├── pacing_worker.py      # Activate queued leads per pacing schedule
│   │   │   ├── warmup_worker.py      # Manage email warmup
│   │   │   ├── health_worker.py      # Check API/SMTP health
│   │   │   └── analytics_worker.py   # Aggregate analytics
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── encryption.py         # Fernet encryption for secrets
│   │       └── validators.py         # Phone, email, URL validation
│   ├── alembic/
│   │   ├── alembic.ini
│   │   └── versions/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_users.py
│   │   ├── test_clients.py
│   │   ├── test_leads.py
│   │   ├── test_campaigns.py
│   │   ├── test_pacing.py
│   │   ├── test_ai_service.py
│   │   └── test_outreach.py
│   ├── uploads/
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Dashboard home
│   │   │   ├── login/page.tsx
│   │   │   ├── users/                  # User management (owner only)
│   │   │   │   └── page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── leads/page.tsx
│   │   │   │       ├── campaigns/page.tsx
│   │   │   │       └── analytics/page.tsx
│   │   │   ├── campaigns/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── builder/page.tsx
│   │   │   ├── social-queue/page.tsx
│   │   │   ├── review-queue/page.tsx
│   │   │   ├── conversations/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── smtp/page.tsx
│   │   │       ├── ai-keys/page.tsx
│   │   │       ├── twilio/page.tsx
│   │   │       └── whatsapp/page.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui (auto-generated)
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   ├── client-selector.tsx # Client dropdown in top nav
│   │   │   │   ├── theme-toggle.tsx
│   │   │   │   └── breadcrumbs.tsx
│   │   │   ├── clients/
│   │   │   │   ├── client-card.tsx
│   │   │   │   └── client-form.tsx
│   │   │   ├── leads/
│   │   │   │   ├── lead-table.tsx
│   │   │   │   ├── csv-import-modal.tsx
│   │   │   │   ├── import-history.tsx
│   │   │   │   └── lead-detail-sheet.tsx
│   │   │   ├── campaigns/
│   │   │   │   ├── campaign-card.tsx
│   │   │   │   ├── sequence-builder.tsx
│   │   │   │   ├── step-editor.tsx
│   │   │   │   └── pacing-config.tsx
│   │   │   ├── outreach/
│   │   │   │   ├── social-dm-card.tsx
│   │   │   │   └── review-card.tsx
│   │   │   ├── analytics/
│   │   │   │   ├── stats-cards.tsx
│   │   │   │   ├── channel-chart.tsx
│   │   │   │   ├── conversion-funnel.tsx
│   │   │   │   └── timeline-chart.tsx
│   │   │   └── shared/
│   │   │       ├── data-table.tsx
│   │   │       ├── status-badge.tsx
│   │   │       ├── role-guard.tsx      # Hide UI elements by role
│   │   │       ├── loading-spinner.tsx
│   │   │       ├── confirm-dialog.tsx
│   │   │       └── empty-state.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── utils.ts
│   │   │   └── constants.ts
│   │   ├── hooks/
│   │   │   ├── use-auth.ts            # includes role, assigned clients
│   │   │   ├── use-clients.ts         # filtered by assignment
│   │   │   ├── use-leads.ts
│   │   │   ├── use-campaigns.ts
│   │   │   └── use-analytics.ts
│   │   └── types/
│   │       └── index.ts
│   ├── public/logo.svg
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.local
├── .gitignore
└── README.md
```

---

## EMAIL WARMUP STRATEGY

When a new SMTP account is added with warmup enabled, auto-generate this schedule:

```
Day 1-3:    20 emails/day
Day 4-7:    50 emails/day
Day 8-14:   100 emails/day
Day 15-21:  150 emails/day
Day 22+:    200 emails/day (or user-configured max)
```

**Rules:**
- Scheduler checks `warmup_current_daily_limit` before queuing emails
- Limit auto-increases daily based on schedule
- If bounce rate > 5%, reduce daily limit by 50% and alert user
- Counter `sent_today` resets at midnight via Celery beat task
- Multiple SMTP accounts rotate to spread volume

---

## AI MESSAGE GENERATION SYSTEM

### How It Works:

1. Campaign step needs a message → AI service called
2. AI service selects next available API key (rotation: priority + daily usage + health)
3. Constructs prompt using: client data + lead data + channel rules
4. Calls OpenRouter or Groq API (both OpenAI-compatible format)
5. Returns generated message
6. For email/sms/whatsapp → queued for automatic sending
7. For social DMs → queued in social DM manual queue

### AI System Prompt Template:

```
You are a professional outreach copywriter for {client.name}, a {client.business_type} business.

ABOUT THE BUSINESS:
- Services: {client.services}
- Target audience: {client.target_audience}
- Website: {client.website}
- Tone: {client.tone}
{client.custom_instructions}

YOUR TASK:
Write a personalized {channel} message to reach out to a potential customer.

LEAD INFORMATION:
- Business: {lead.business_name}
- Location: {lead.address}
- Rating: {lead.rating} stars ({lead.reviews} reviews)
- Website: {lead.website}

CHANNEL RULES:
{channel_specific_rules}

IMPORTANT:
- Keep it concise
- Include a clear call-to-action
- Do NOT use generic phrases like "I came across your business"
- Make it specific to THEIR business
- {tone} tone
```

### Channel-Specific Rules:

```
EMAIL:
- Subject line: Short, curiosity-driven, no spam trigger words
- Body: 3-5 sentences max
- Include call-to-action (reply, book call, visit link)
- Professional signature

SMS:
- Max 160 characters
- Casual, direct
- Include sender business name
- One clear CTA

MMS:
- Max 300 characters with media attachment
- Reference the attached image/video

WHATSAPP:
- Conversational tone
- 2-3 sentences
- Can use emojis sparingly
- Greeting + value + question

SOCIAL DM (adapts per platform):
- Instagram: Casual, short, reference their feed/work
- Facebook: Friendly, reference their page/reviews
- LinkedIn: Professional, reference their company/role
- TikTok: Very casual, reference their content
- Twitter/X: Short, punchy
- All: 2-3 sentences max, end with a question
```

### API Key Rotation Logic:

```python
def get_next_ai_key():
    keys = get_active_keys(order_by='priority DESC')
    for key in keys:
        if key.requests_today < key.daily_limit:
            if key.health_status != 'error':
                return key
    raise NoAvailableKeysError("All AI API keys exhausted or unhealthy")
```

### Dynamic Model Support:
- Admin adds any model name in the settings (text input, no hardcoded list)
- Works with any model available on OpenRouter or Groq
- Examples: `llama-3.1-70b-versatile`, `gpt-4o-mini`, `mixtral-8x7b-32768`, `gemma2-9b-it`
- Test button verifies the model name + API key combo works

---

## PHASES AND TASKS

---

### PHASE 1: Project Scaffolding & Database Setup
**Role: Senior Backend Developer**

#### Task 1.1: Initialize Backend Project
- Create `maximus-outreach/backend/` directory
- Create Python virtual environment
- Create `requirements.txt`:
  ```
  fastapi==0.115.*
  uvicorn[standard]==0.34.*
  sqlalchemy[asyncio]==2.0.*
  asyncpg==0.30.*
  alembic==1.14.*
  python-jose[cryptography]==3.3.*
  passlib[bcrypt]==1.7.*
  python-dotenv==1.0.*
  pydantic==2.10.*
  pydantic-settings==2.7.*
  celery==5.4.*
  redis==5.2.*
  aiosmtplib==3.0.*
  twilio==9.*
  httpx==0.28.*
  python-multipart==0.0.*
  cryptography==44.*
  ```
- Create `.env.example` with all required environment variables
- Create `.gitignore`
- **Test:** `pip install -r requirements.txt` completes without errors

#### Task 1.2: Configure FastAPI Application
- Create `app/main.py` with FastAPI app instance
- Configure CORS middleware (allow frontend origin)
- Add health check endpoint: `GET /health` returns `{"status": "ok"}`
- Create `app/config.py` using pydantic-settings `BaseSettings` to load `.env`
- **Test:** `uvicorn app.main:app --reload` starts, `GET /health` returns 200

#### Task 1.3: Configure Database Connection
- Create `app/database.py` with async SQLAlchemy engine and session factory
- Configure Alembic for migrations
- Update `alembic/env.py` to use async engine and import all models
- **Test:** Alembic connects to PostgreSQL successfully

#### Task 1.4: Create All Database Models
- Create all SQLAlchemy models matching the database schema above (including lead_imports, campaign pacing fields, social_dm_queue)
- Each model in its own file under `app/models/`
- Create `app/models/__init__.py` that imports all models
- **Test:** `alembic revision --autogenerate -m "initial schema"` generates correct migration

#### Task 1.5: Run Initial Migration
- Review generated migration file
- Run `alembic upgrade head`
- Verify all tables, indexes, and constraints created
- **Test:** Connect to PostgreSQL, `\dt` shows all tables

#### Task 1.6: Create Encryption Utility
- Create `app/utils/encryption.py` using `cryptography.fernet.Fernet`
- Functions: `encrypt_value(plaintext) -> str`, `decrypt_value(ciphertext) -> str`
- Load encryption key from `.env` (`ENCRYPTION_KEY`)
- **Test:** Encrypt → decrypt → verify match. Encrypted value is not human-readable.

---

### PHASE 2: Authentication & Security
**Role: Senior Backend Developer**

#### Task 2.1: Create Auth Schemas
- `RegisterRequest`: email, password (min 8 chars), name (used only for initial owner creation)
- `LoginRequest`: email, password
- `TokenResponse`: access_token, token_type
- `UserResponse`: id, email, name, role, is_active, created_at, assigned_clients (list of client IDs + names)
- **Test:** Schema validation with valid/invalid data

#### Task 2.2: Create Security Module
- `app/security.py`:
  - `hash_password(password) -> str` (bcrypt)
  - `verify_password(plain, hashed) -> bool`
  - `create_access_token(data, expires_delta) -> str` (python-jose, HS256)
  - `decode_access_token(token) -> dict`
- JWT payload includes: user_id, role, email
- JWT secret from `.env`, default 24h expiry
- **Test:** Hash/verify password. Create/decode token. Token contains role.

#### Task 2.3: Create Auth Router
- `POST /auth/register` — Create owner (limit to 1 owner, return 400 if owner exists). Only used during initial setup.
- `POST /auth/login` — Verify credentials, return JWT (works for both owner and managers)
- `GET /auth/me` — Return current user profile with role + assigned clients
- `get_current_user` dependency for protected endpoints (returns user with role)
- `require_owner` dependency — raises 403 if user.role != 'owner'
- **Test:** Register owner → login → /auth/me returns role='owner'. Second register → 400.

#### Task 2.4: Auth Middleware & Role Guards
- All routes except `/auth/*`, `/health`, `/webhooks/*` require valid JWT
- Invalid/expired token → 401
- Role-based guards:
  - Settings routes (`/settings/*`) → owner only (403 for managers)
  - User management routes (`/users/*`) → owner only
  - Client create/edit/delete → owner only
  - Client data routes (leads, campaigns, etc.) → owner OR manager assigned to that client
  - Bulk delete leads → owner only
- Rate limit on login: max 5 attempts per minute
- **Test:** Owner can access settings. Manager gets 403 on settings. Manager can access assigned client. Manager gets 403 on unassigned client.

---

### PHASE 3: User Management (Owner Only)
**Role: Senior Backend Developer**

#### Task 3.1: Create User Management Schemas
- `UserCreate`: email, password, name, role (always 'manager' — cannot create another owner), assigned_client_ids (list of UUIDs)
- `UserUpdate`: name, email, password (optional), is_active, assigned_client_ids
- `UserResponse`: id, email, name, role, is_active, created_at, assigned_clients (list of {id, name})
- `UserList`: paginated
- **Test:** Schema validation. Cannot set role='owner'.

#### Task 3.2: Create User Management Router & Service
- All endpoints require `require_owner` dependency (403 for managers)
- `GET /users` — List all users (owner sees all, includes assigned client names)
- `GET /users/{id}` — Single user with assignments
- `POST /users` — Create manager (hash password, create assignments)
- `PUT /users/{id}` — Update (change name, email, password, active status, reassign clients)
- `DELETE /users/{id}` — Deactivate (is_active = false, preserve data)
- `PUT /users/{id}/clients` — Update client assignments (replace all)
- Service: `get_accessible_clients(user) -> list[Client]` — returns all clients for owner, only assigned for manager
- **Test:** Owner creates manager. Assigns 2 clients. Manager logs in, can only access those 2. Owner reassigns. Manager sees updated list. Manager tries to create user → 403.

---

### PHASE 4: Client Management
**Role: Senior Backend Developer**

#### Task 4.1: Create Client Schemas
- `ClientCreate`: name, business_type, services, target_audience, tone, pitch, website, phone, from_email, from_name, custom_instructions
- `ClientUpdate`: all fields optional
- `ClientResponse`: all fields + id, is_active, created_at, lead_count, active_campaigns_count
- `ClientList`: paginated
- **Test:** Schema validation

#### Task 4.2: Create Client Router & Service
- `GET /clients` — List clients (owner: all, manager: only assigned)
- `GET /clients/{id}` — Single client with stats (check access: owner or assigned manager)
- `POST /clients` — Create (owner only → 403 for managers)
- `PUT /clients/{id}` — Update (owner only)
- `DELETE /clients/{id}` — Soft delete (owner only, is_active = false)
- All client-scoped routes (leads, campaigns, etc.) must check: `is_owner OR is_assigned_to_client`
- **Test:** Owner CRUD works. Manager lists only assigned. Manager tries create → 403. Manager accesses unassigned client → 403.

---

### PHASE 5: Lead Management & CSV Import
**Role: Senior Backend Developer**

#### Task 5.1: Create Lead Schemas
- `LeadCreate`, `LeadUpdate`, `LeadResponse` (with `available_channels` computed field)
- `LeadList`: paginated with filters (status, has_email, has_phone, search)
- `LeadImportResponse`: total_imported, duplicates_skipped, errors
- `ImportHistoryResponse`: list of past imports with file_name, date, counts
- **Test:** Schema validation

#### Task 5.2: Create CSV Import Service
- `app/services/csv_import_service.py`:
  - Accept multipart CSV upload
  - Map columns from lead scraper CSV: `title` → `business_name`, etc.
  - Auto-detect social platform from URL
  - Dedup: same email OR phone within client = skip
  - Track import in `lead_imports` table (file_name, counts)
  - Support both simple CSV (11 columns) and enriched CSV (19 columns)
  - Return: imported count, skipped count, error count
- **Test:** Upload actual CSV from lead scraper tool. Upload a second CSV — duplicates skipped. Check import history.

#### Task 5.3: Create Lead Router
- `GET /clients/{client_id}/leads` — Paginated, filterable, searchable
- `GET /clients/{client_id}/leads/{id}` — Single lead
- `POST /clients/{client_id}/leads` — Create manually
- `POST /clients/{client_id}/leads/import` — Upload CSV
- `GET /clients/{client_id}/leads/import-history` — List past imports
- `PUT /clients/{client_id}/leads/{id}` — Update
- `DELETE /clients/{client_id}/leads/{id}` — Delete (single: any user with client access)
- `PATCH /clients/{client_id}/leads/bulk-status` — Bulk status update
- `DELETE /clients/{client_id}/leads/bulk` — Bulk delete (owner only)
- All routes check client access (owner or assigned manager)
- **Test:** Import CSV, list leads, filter by has_email, search by name, check import history. Manager can access assigned client leads. Manager bulk delete → 403.

---

### PHASE 6: AI Engine (OpenRouter + Groq)
**Role: Senior Backend Developer**

#### Task 6.1: AI API Key Management
- `GET /settings/ai-keys` — List (masked, show last 4 chars)
- `POST /settings/ai-keys` — Add (provider, api_key, model_name, label, daily_limit, priority)
- `PUT /settings/ai-keys/{id}` — Update
- `DELETE /settings/ai-keys/{id}` — Delete
- `POST /settings/ai-keys/{id}/test` — Send test prompt, return response
- Keys encrypted at rest
- Model name is free-text input (any model the provider supports)
- **Test:** Add Groq key, test it. Add OpenRouter key, test it.

#### Task 6.2: AI Service with Key Rotation
- `app/services/ai_service.py`:
  - `generate_message(client, lead, channel, step) -> str`
  - Key rotation by priority + daily usage + health
  - Prompt construction using system prompt template + channel rules
  - Both providers use OpenAI-compatible format
  - Increment counter, handle errors, try next key on failure
- **Test:** Generate email + SMS + WhatsApp + social DM messages. Test rotation when first key "exhausted".

#### Task 6.3: AI Health Check Worker
- Celery beat: every 30 minutes
- Test each active key with tiny prompt
- Update health_status: healthy / error / rate_limited
- **Test:** Run manually, verify statuses updated.

---

### PHASE 7: Email Channel (SMTP)
**Role: Senior Backend Developer**

#### Task 7.1: SMTP Settings Management
- `GET /settings/smtp` — List SMTP accounts
- `POST /settings/smtp` — Add (host, port, username, password, daily_limit, warmup_enabled)
- `PUT /settings/smtp/{id}` — Update
- `DELETE /settings/smtp/{id}` — Delete
- `POST /settings/smtp/{id}/test` — Send test email
- `POST /settings/smtp/{id}/warmup/start` — Generate warmup schedule
- Password encrypted at rest
- **Test:** Add SMTP, send test email.

#### Task 7.2: Email Sending Service
- `app/services/email_service.py`:
  - `send_email(to, from_email, from_name, subject, body_html, body_text, attachments) -> bool`
  - Uses aiosmtplib (async)
  - Select SMTP account (default or client-specific match)
  - Check daily limit (warmup limit if active)
  - Add tracking pixel for open tracking
  - Add link rewriting for click tracking
  - Increment sent_today
- **Test:** Send email, verify received, check tracking pixel in HTML.

#### Task 7.3: Email Warmup Worker
- Celery beat: daily at midnight
  - Calculate warmup day, update limits
  - Reset sent_today for all SMTP accounts
- **Test:** Start warmup, trigger worker, verify limit updated.

---

### PHASE 8: SMS Channel
**Role: Senior Backend Developer**

**Architecture: Email-to-SMS (free, primary) → Twilio OR Telnyx (paid fallback, owner's choice)**

**Send flow:**
1. Check lead's `carrier` field. If known → send free SMS via email-to-SMS gateway using existing SMTP
2. If carrier unknown OR email-to-SMS delivery fails → fall back to configured SMS provider (Twilio or Telnyx)
3. Log method used: `email_to_sms` / `twilio` / `telnyx` / `failed`
4. Reply detection only works when fallback provider is used (email-to-SMS has no incoming webhook)

**DB tables:**
- `sms_provider_settings`: single record storing provider choice + credentials (Twilio OR Telnyx)
- `sms_phone_numbers`: phone numbers pool, each optionally assigned to a client via `client_id`
- `leads.carrier`: stores carrier slug (`att`, `verizon`, `tmobile`, `sprint`, `unknown`) for email-to-SMS routing

**Carrier email gateways:**
```
att      -> {number}@txt.att.net
verizon  -> {number}@vtext.com
tmobile  -> {number}@tmomail.net
sprint   -> {number}@messaging.sprintpcs.com
```

#### Task 8.1: SMS Settings Management
- `GET /settings/sms` — Get current provider config (credentials masked)
- `POST /settings/sms` — Save/update provider choice + credentials
  - `provider`: `"twilio"` or `"telnyx"`
  - Twilio: `twilio_account_sid`, `twilio_auth_token`
  - Telnyx: `telnyx_api_key`
  - All secrets encrypted at rest
- `POST /settings/sms/test` — Validate credentials against provider API (no SMS sent)
- `GET /settings/sms/numbers` — List all phone numbers
- `POST /settings/sms/numbers` — Add number (`phone_number`, `label`, `client_id` optional, `daily_limit`)
- `PUT /settings/sms/numbers/{number_id}` — Update (reassign client, change limit, toggle active)
- `DELETE /settings/sms/numbers/{number_id}` — Remove number
- **Test:** Save Twilio credentials, add two numbers, assign one to a client, verify list and masking.

#### Task 8.2: SMS Sending Service
- `app/services/sms_service.py`:
  - `send_sms(to, body, client_id, lead_carrier=None) -> dict`
  - **Step 1 (free):** If `lead_carrier` is known and not `"unknown"`, attempt email-to-SMS via `email_service.send_email()`
  - **Step 2 (paid fallback):** If step 1 skipped or failed, load `sms_provider_settings`, select phone number for `client_id`, send via Twilio or Telnyx
  - Phone number selection: number assigned to `client_id` first; fallback to any active unassigned number
  - Check `daily_limit` on selected number, increment `sent_today` on success
  - Return `{success, method, sid, from_number, error}`
  - `method`: `"email_to_sms"` / `"twilio"` / `"telnyx"` / `"failed"`
- **Test:** Test email-to-SMS path (mock SMTP). Test Twilio fallback path. Test Telnyx fallback path. Verify correct from_number per client.

#### Task 8.3: SMS Incoming Webhook
- `POST /webhooks/sms/twilio` — Twilio incoming handler
  - Validate Twilio signature (`X-Twilio-Signature` header)
  - Match `To` number → `sms_phone_numbers` → `client_id`
  - Match `From` number → lead (by phone)
  - Stop active campaign sequence for that lead
  - Create conversation + message record
  - Update lead status to `"replied"`
  - AI drafts response → `pending_review`
- `POST /webhooks/sms/telnyx` — Telnyx incoming handler (same logic, different signature validation)
- **Test:** Simulate incoming webhook payload for each provider, verify lead matched, conversation created, campaign stopped.

---

### PHASE 9: WhatsApp Channel
**Role: Senior Backend Developer**

#### Task 9.1: WhatsApp Settings Management
- `GET /settings/whatsapp` — Get config
- `POST /settings/whatsapp` — Save (phone_number_id, access_token, business_account_id)
- `POST /settings/whatsapp/test` — Send test message
- Token encrypted at rest
- **Test:** Save config, send test message.

#### Task 9.2: WhatsApp Sending Service
- `app/services/whatsapp_service.py`:
  - `send_whatsapp(to, body, media_url=None, media_type=None) -> dict`
  - Meta Cloud API via httpx
  - First contact: use approved template (WhatsApp requirement)
  - Replies: freeform text
  - Media support: images, videos, documents
  - Check daily limit
- **Test:** Send WhatsApp message. Send with image.

#### Task 9.3: WhatsApp Incoming Webhook
- `POST /webhooks/whatsapp/incoming`:
  - GET handler for Meta webhook verification
  - POST handler for incoming messages
  - Same logic: stop campaign, create conversation, AI draft
  - Validate Meta signature
- **Test:** Reply to WhatsApp, verify conversation captured.

---

### PHASE 10: Social Media DM Queue
**Role: Senior Backend Developer**

#### Task 10.1: Social DM Queue Service
- `app/services/social_dm_service.py`:
  - `queue_social_dm(lead, client, message, platform, profile_url) -> SocialDmQueue`
  - Auto-detect platform from URL
  - Store with status "pending"
- **Test:** Queue DMs for different platforms.

#### Task 10.2: Social DM Queue Router
- `GET /social-queue` — List pending DMs (filter by platform, client, date)
- `GET /social-queue/stats` — Counts: pending, sent today, skipped
- `PATCH /social-queue/{id}/mark-sent` — Mark sent
- `PATCH /social-queue/{id}/skip` — Skip
- `PATCH /social-queue/bulk-mark-sent` — Bulk mark
- **Test:** List, mark sent, verify status.

---

### PHASE 11: Campaign Builder, Pacing & Scheduler
**Role: Senior Backend Developer**

#### Task 11.1: Create Campaign & Pacing Schemas
- `CampaignCreate`: name, description, stop_on_reply, max_attempts, repeat_delay_days, pacing_mode, pacing_leads_per_day (JSON), send_window_start, send_window_end, send_timezone
- `CampaignStepCreate`: step_order, channel, delay_days, delay_hours, message_template, use_ai_generation, ai_prompt_override, subject_template
- `CampaignResponse`: all fields + steps + enrollment stats + pacing progress
- `PacingConfig`: mode (all_at_once, fixed_daily, gradual_rampup, custom), schedule JSON
- **Test:** Schema validation

#### Task 11.2: Create Campaign Router
- `GET /clients/{client_id}/campaigns` — List
- `POST /clients/{client_id}/campaigns` — Create
- `PUT /campaigns/{id}` — Update
- `DELETE /campaigns/{id}` — Delete (only draft)
- `GET /campaigns/{id}` — With steps, stats, pacing progress
- Step CRUD: add, update, delete, upload media
- `POST /campaigns/{id}/enroll` — Enroll leads (list of IDs or filter)
- `POST /campaigns/{id}/start` — Activate campaign
- `POST /campaigns/{id}/pause` — Pause
- `POST /campaigns/{id}/resume` — Resume
- `GET /campaigns/{id}/pacing` — Current pacing status (X activated of Y total)
- **Test:** Create campaign with 4 steps + pacing config. Enroll leads. Start.

#### Task 11.3: Create Pacing Service
- `app/services/pacing_service.py`:
  - `activate_next_batch(campaign_id)` — Called by pacing worker
  - Based on pacing_mode and pacing_leads_per_day config:
    - `all_at_once`: activate all immediately
    - `fixed_daily`: activate N per day
    - `gradual_rampup`: week 1 = X/day, week 2 = Y/day, etc.
    - `custom`: read custom JSON schedule
  - Change enrollment status from `queued` → `active`
  - Set `activated_at` timestamp
  - Update campaign counters (total_activated)
  - Respect send_window (only activate during business hours)
- **Test:** Enroll 100 leads with gradual_rampup (10/day week1). Run pacing worker. Verify exactly 10 activated. Run again next "day" → 10 more.

#### Task 11.4: Create Campaign Execution Service
- `app/services/campaign_service.py`:
  - `execute_campaign(campaign_id)`:
    - Only process enrollments with status `active`
    - Calculate which step is due (enrolled_at + delay)
    - Check if lead has data for channel → skip if missing
    - Generate AI message (or use template)
    - Email/SMS/WhatsApp → create outreach_log "queued"
    - Social DM → create social_dm_queue entry
    - If replied → stop enrollment
    - If all steps done → mark completed
- **Test:** Manually call, verify outreach_log entries created.

#### Task 11.5: Create Scheduler & Pacing Workers
- `app/workers/pacing_worker.py`:
  - Celery beat: every 15 minutes
  - For each active campaign: call `activate_next_batch`
  - Only during campaign's send_window hours
- `app/workers/scheduler_worker.py`:
  - Celery beat: every 5 minutes
  - For each active campaign: call `execute_campaign`
  - Spread messages across business hours
- `app/workers/outreach_worker.py`:
  - Process "queued" outreach_log entries
  - Send via appropriate channel service
  - Update status: sent / failed / skipped
  - Retry up to 3 times with exponential backoff
- **Test:** Start campaign with pacing. Verify leads activate gradually. Verify messages sent. Verify rate limits respected.

---

### PHASE 12: Response Handling & Review Queue
**Role: Senior Backend Developer**

#### Task 12.1: Conversation Service
- `handle_incoming_message(channel, from_identifier, content, media)`:
  - Match to lead (email/phone)
  - Find or create conversation
  - Save inbound message
  - Stop campaign sequences for this lead
  - Update lead status → "replied"
  - AI drafts reply (using conversation history + client context)
  - Save draft with `is_approved = false`
- `approve_and_send(message_id)`: Approve + send
- `edit_and_send(message_id, content)`: Edit + approve + send
- **Test:** Simulate incoming reply. Verify conversation, draft, lead status.

#### Task 12.2: Review Queue Router
- `GET /review-queue` — Pending AI drafts (filterable)
- `GET /review-queue/count` — Badge count
- `POST /review-queue/{id}/approve` — Send as-is
- `POST /review-queue/{id}/edit` — Edit + send
- `POST /review-queue/{id}/discard` — Delete draft
- **Test:** Approve, edit, discard drafts.

#### Task 12.3: Conversation Router
- `GET /conversations` — List (filterable by client, channel, status)
- `GET /conversations/{id}` — Full thread
- `POST /conversations/{id}/reply` — Manual reply
- `PATCH /conversations/{id}/close` — Close
- **Test:** View thread, send reply, close.

---

### PHASE 13: Analytics Dashboard
**Role: Senior Backend Developer**

#### Task 13.1: Analytics Service
- `get_dashboard_stats(client_id, date_from, date_to)`:
  - Total leads, messages sent (by channel), replies, reply rate, conversion rate
  - Messages over time (daily), channel performance comparison
  - Lead pipeline: New → Contacted → Replied → Qualified → Customer
  - Top campaigns, cost estimates per channel
  - Pacing progress per campaign
- `get_campaign_analytics(campaign_id)`: Per-step performance, drop-off
- `export_analytics(client_id, format)`: CSV/JSON export
- **Test:** Insert events, verify calculations.

#### Task 13.2: Analytics Router
- `GET /analytics/dashboard` — Global stats
- `GET /analytics/clients/{id}` — Per-client
- `GET /analytics/campaigns/{id}` — Per-campaign (with pacing progress)
- `GET /analytics/channels` — Channel comparison
- `GET /analytics/timeline` — Over time
- `GET /analytics/funnel` — Lead pipeline
- `GET /analytics/export` — Export CSV/JSON
- Date range filtering on all endpoints
- **Test:** All endpoints return correct data structures.

---

### PHASE 14: Media Library
**Role: Senior Backend Developer**

#### Task 14.1: Media Upload
- `POST /media/upload` — Upload (multipart), validate type (jpg, png, gif, mp4, pdf), max 10MB
- `GET /media/{id}` — Serve file
- `GET /media` — List (paginated)
- `DELETE /media/{id}` — Delete file + record
- **Test:** Upload image, video, pdf. Reject .exe. Serve uploaded files.

---

### PHASE 15: Frontend — Foundation & Layout
**Role: Senior Frontend Developer**

#### Task 15.1: Initialize Frontend Project
- Next.js 14+ (App Router) with TypeScript + Tailwind
- Install: `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `recharts`, `lucide-react`, `next-themes`, `sonner`, `axios`
- Initialize shadcn/ui with all needed components
- Configure dark/light theme (class strategy)
- **Test:** `npm run dev` starts without errors.

#### Task 15.2: Layout & Navigation
- Root layout: ThemeProvider + Sonner + QueryClientProvider
- Sidebar:
  - Logo: "Maximus Outreach"
  - Nav items with Lucide icons: Dashboard, Clients, Social DM Queue (badge), Review Queue (badge), Conversations, Analytics, Settings (owner only), Users (owner only)
  - Collapsible (icon-only on mobile)
  - Active route highlighting
  - **Settings and Users nav items hidden for managers**
- Header: Breadcrumbs, **client selector dropdown** (shows assigned clients for managers, all for owner), dark/light toggle (Sun/Moon), user avatar dropdown (name, role badge, logout)
- Theme colors:
  - Dark: bg `#0a0a0a`, sidebar `#111111`, cards `#1a1a1a`, borders `#262626`, text `#fafafa`, accent `#3b82f6`
  - Light: bg `#fafafa`, sidebar `#ffffff`, cards `#ffffff`, borders `#e5e7eb`, text `#111111`, accent `#2563eb`
- Smooth theme transitions, keyboard navigable
- **Test:** Navigate all links. Toggle theme. Tab through nav. Responsive.

#### Task 15.3: API Client & Auth
- Axios instance with JWT from localStorage
- 401 → redirect to login
- Login page: centered card, email + password, validation (works for both owner and managers)
- Auth guard on all pages
- **Role guard**: store user role + assigned clients from `/auth/me` response
- **`<RoleGuard role="owner">`** wrapper component: hides children if user is not owner
- **Test:** Owner login → sees all nav items. Manager login → Settings/Users hidden. Manager navigates to /settings → redirected to dashboard.

---

### PHASE 16: Frontend — Client Management
**Role: Senior Frontend Developer**

#### Task 16.1: Clients List Page
- Grid of client cards (responsive: 1/2/3 columns)
- Card: name, type, lead count, active campaigns, status
- Search bar, empty state
- **Owner**: sees all clients + "Create Client" button
- **Manager**: sees only assigned clients, no create button
- **Test:** Owner sees all + create. Manager sees only assigned. Manager has no create button.

#### Task 16.2: Client Create/Edit Form
- **Owner only** (wrap in RoleGuard, API returns 403 for managers)
- Sections: Basic Info, Services & Pitch, Communication (tone selector, AI instructions), Email (from_email, from_name)
- Zod validation, unsaved changes confirmation
- **Test:** Owner creates, edits. Manager navigates to /clients/new → redirected.

#### Task 16.3: Client Detail Page
- Header with stats row (leads, campaigns, sent, reply rate)
- Tabs: Leads | Campaigns | Analytics
- Quick actions: Import leads, Create campaign
- Accessible by owner (all clients) and manager (assigned clients only)
- **Test:** Navigate tabs, see stats. Manager accesses assigned → works. Manager accesses unassigned → 403 redirect.

---

### PHASE 17: Frontend — Lead Management
**Role: Senior Frontend Developer**

#### Task 17.1: Leads Table
- TanStack Table: Name, Email, Phone, Website, Status, Rating, Social icons, Actions
- Sorting, column visibility, pagination (25/50/100)
- Filters: status, has_email, has_phone, search
- Bulk actions: change status, enroll in campaign. **Bulk delete: owner only** (button hidden for managers)
- Lead detail slide-over (Sheet): all info, social links (clickable), outreach history, notes
- **Test:** 50+ leads, sort, filter, bulk action, detail view.

#### Task 17.2: CSV Import Modal
- Drag-drop or browse file upload (.csv only)
- Preview first 5 rows
- Column mapping display
- Import progress + results ("65 imported, 3 duplicates, 2 errors")
- **Test:** Import CSV from lead scraper. Verify mapping. See results.

#### Task 17.3: Import History
- `src/components/leads/import-history.tsx`:
  - Table: file name, date, total rows, imported, duplicates, errors
  - Shows all past imports for this client
- **Test:** Import 2 CSVs, verify both appear in history.

---

### PHASE 18: Frontend — Campaign Builder
**Role: Senior Frontend Developer**

#### Task 18.1: Campaigns List
- Campaign cards: name, status badge, enrolled, sent, replies
- Quick actions: Start, Pause, Resume
- Create Campaign button
- **Test:** View, start/pause from list.

#### Task 18.2: Campaign Sequence Builder
- Campaign settings: name, stop_on_reply, max_attempts, repeat_delay
- **Pacing Configuration Section** (`src/components/campaigns/pacing-config.tsx`):
  - Pacing mode dropdown: All at once / Fixed daily / Gradual ramp-up / Custom
  - For fixed: input leads/day
  - For gradual: inputs for week1, week2, week3, week4+ leads/day
  - For custom: add rows (week number → leads/day)
  - Send window: start time, end time, timezone dropdown
  - Shows estimate: "4,000 leads will take ~5 weeks at this pace"
  - Progress bar when campaign is active: "750 of 4,000 activated (Week 3)"
- Steps as vertical connected cards (timeline/flowchart):
  - Each step: channel icon, delay, message preview
  - Add Step button, reorder (drag or arrows)
- Step editor (expand/modal):
  - Channel selector with icons (Email, SMS, MMS, WhatsApp, Social DM)
  - Delay: X days, X hours
  - AI generation toggle + optional prompt override
  - Manual template with variables: `{business_name}`, `{address}`, `{rating}`, etc.
  - Email subject field
  - Media upload (drag-drop, thumbnails)
- Enroll Leads section: filter + select + count
- Start Campaign button with confirmation
- **Test:** Create 4-step campaign with gradual pacing. Upload media. Enroll leads. Start.

---

### PHASE 19: Frontend — Outreach Queues & Conversations
**Role: Senior Frontend Developer**

#### Task 19.1: Social DM Queue Page
- Stats: X pending, Y sent today, Z skipped
- Filter by platform (with colored platform icons), client
- Each card:
  - Lead name + business
  - Platform badge (Instagram gradient, Facebook blue, LinkedIn blue, TikTok black, Twitter/X black, etc.)
  - Profile URL (opens new tab)
  - AI message in styled block
  - Buttons: **Copy Message** (clipboard + "Copied!" toast), **Open Profile** (new tab), **Mark Sent** (removes with animation), **Skip**
- Keyboard shortcuts: C=copy, O=open, S=mark sent, N=next
- **Test:** 10 items. Copy → clipboard. Open → new tab. Mark sent → animation. Filter.

#### Task 19.2: Review Queue Page
- Pending count badge
- Filter by client, channel
- Expandable cards:
  - Lead name + channel badge
  - Their message (what they said)
  - AI draft (editable textarea)
  - Conversation history (collapsible)
  - Buttons: Approve & Send (green), Edit & Send (blue), Discard (red)
- **Test:** Approve, edit, discard.

#### Task 19.3: Conversations Page
- Split view: list (left) + thread (right)
- List: lead name, channel icon, last message preview, time, unread badge
- Thread: chat bubbles (inbound left/muted, outbound right/accent), AI labels
- Reply input: textarea + "Generate AI Reply" button + Send button
- **Test:** Select conversation, see thread, send reply, generate AI reply.

---

### PHASE 20: Frontend — Analytics Dashboard
**Role: Senior Frontend Developer**

#### Task 20.1: Analytics Dashboard Page
- Date range picker + client filter
- **Stats Cards** (4): Total Leads, Messages Sent, Replies, Reply Rate (with trend arrows)
- **Channel Performance** (Recharts BarChart): Sent vs Replied per channel
- **Messages Over Time** (AreaChart): stacked sent/replied per day
- **Conversion Funnel**: New → Contacted → Replied → Qualified → Customer (counts + %)
- **Campaign Progress Cards**: For each active campaign with pacing: "750/4000 activated (Week 3)" with progress bar
- **Top Campaigns Table**: Campaign, Client, Sent, Replies, Reply Rate, Status
- **Cost Estimates**: Email $0, SMS X×$0.0079, WhatsApp X×$0.05, Social Free
- Charts respect dark/light theme, animate on load
- Export CSV button
- **Test:** Data renders. Date range works. Client filter works. Both themes. Export.

#### Task 20.2: Per-Client Analytics
- Same layout filtered to one client + per-campaign breakdown table
- **Test:** Compare with global.

---

### PHASE 21: Frontend — Settings & User Management Pages
**Role: Senior Frontend Developer**

#### Task 21.1: SMTP Settings Page (Owner Only)
- List SMTP accounts as cards: name, host, sent/limit, health badge, warmup status
- Add SMTP dialog: host, port, username, password, daily_limit, warmup toggle
- Buttons: Edit, Test (sends email), Delete
- **Test:** Add, test, see warmup status.

#### Task 21.2: AI Models Page (Owner Only)
- List API keys as cards: provider badge (OpenRouter/Groq), model name, label, usage bar, health badge, priority, last check
- Add key dialog: provider dropdown, API key (password field), model name (free text input), label, daily_limit, priority
- Health check all button
- **Test:** Add keys, test, see rotation priorities, run health check.

#### Task 21.3: Twilio & WhatsApp Pages (Owner Only)
- Twilio: SID, token (hidden), phone, daily_limit, sent counter, test button
- WhatsApp: phone_number_id, token (hidden), business_account_id, daily_limit, tier info, test button
- **Test:** Save configs, test each.

#### Task 21.4: User Management Page (Owner Only)
- List users as table: name, email, role badge, assigned clients (chips), status badge (active/inactive), actions
- Create User dialog: name, email, password, multi-select client assignment
- Edit User dialog: same fields, password optional (blank = keep current)
- Toggle active/inactive with confirmation
- Shows "No managers yet" empty state with create button
- **All settings/user pages**: wrapped in RoleGuard, redirect managers to dashboard
- **Test:** Create manager, assign 2 clients. Edit, reassign. Deactivate. Manager can't access page.

---

### PHASE 22: Frontend — Accessibility & Polish
**Role: Senior Frontend Developer**

#### Task 22.1: Accessibility Audit (WCAG 2.1 AA)
- Visible focus indicators (ring-2 ring-offset-2)
- All images have alt text
- Color contrast: 4.5:1 text, 3:1 large text
- Forms have labels (not just placeholders)
- Error messages linked with aria-describedby
- Tables have proper th/scope
- Modals trap focus
- Keyboard navigable sidebar
- Skip-to-content link
- Toast notifications: role="alert"
- Page titles update on route change
- **Test:** Keyboard-only navigation. axe DevTools audit → 0 critical/serious.

#### Task 22.2: Responsive Design
- Sidebar → bottom nav on mobile (<768px)
- Tables → horizontal scroll on mobile
- Cards → single column on mobile
- Campaign builder → vertical layout on mobile
- Conversations → stacked view on mobile
- Modals → full screen on mobile
- Touch targets: minimum 44x44px
- **Test:** Test at 375px, 768px, 1920px widths.

#### Task 22.3: Loading States & Error Handling
- Skeleton loaders (shimmer) for all pages
- Error boundaries with retry button
- Empty states with illustrations
- Optimistic updates: Mark sent → disappear + undo toast (3 seconds)
- Offline indicator if API unreachable
- **Test:** Throttle network → skeletons. Kill API → error boundary. Empty DB → empty states.

---

### PHASE 23: QA Testing
**Role: QA Engineer**

#### Task 23.1: Backend Unit Tests
- All services: AI, email, SMS, WhatsApp, campaign, pacing, CSV import, analytics
- Minimum 80% coverage
- **Test:** `pytest --cov=app tests/ -v` — all pass, coverage >= 80%

#### Task 23.2: Backend Integration Tests
- Full workflows:
  - Create client → assign manager → manager imports CSV → create campaign with pacing → start → pacing activates leads gradually → scheduler sends messages → lead replies → campaign stops → conversation + AI draft → approve → sent
  - Upload 4000 leads → gradual rampup pacing → verify day 1 = 50, day 8 = 100, etc.
  - Social DM queue → mark sent → status updated
  - Multiple CSV imports → dedup across imports
  - Role-based access: manager can't access unassigned client, can't access settings, can't bulk delete
- Auth, rate limits, error handling
- **Test:** All integration tests pass

#### Task 23.3: Frontend E2E Tests (Playwright)
- **Owner flow:** Login, create client, create manager, assign client, import CSV (check import history), create campaign with pacing, add steps, enroll, start
- **Manager flow:** Login, see only assigned clients, import leads, create campaign, handle social queue, review queue
- **Role enforcement:** Manager navigates to /settings → redirected. Manager tries /users → redirected.
- Social queue: copy, open, mark sent
- Review queue: approve, edit, discard
- Conversations: view, reply
- Analytics: charts render, filters, export
- Settings: all config pages
- Theme toggle, responsive, accessibility
- **Test:** `npx playwright test` — all pass

#### Task 23.4: Security Audit
- All endpoints authenticated (except auth/health/webhooks)
- Webhook signature validation (Twilio, Meta)
- Parameterized queries only (SQLAlchemy)
- No XSS (React auto-escapes, no dangerouslySetInnerHTML)
- JWT in header (no CSRF risk)
- File upload validation (type + size + no path traversal)
- API keys encrypted at rest (Fernet)
- Login rate limiting (5/minute)
- CORS: frontend origin only
- **Test:** SQL injection attempt → blocked. .exe upload → rejected. Brute force login → rate limited.

---

## FREE TIER STRATEGY — ZERO COST AI

### Multi-Provider Free API Key Rotation

The AI key rotation system supports multiple providers simultaneously. By adding one free key per provider, you get effectively unlimited free AI message generation:

| Provider | API Format | Free Tier Limits | Sign Up |
|---|---|---|---|
| **Groq** | OpenAI-compatible | 30 req/min, ~14,400 req/day | console.groq.com |
| **OpenRouter** (free models) | OpenAI-compatible | Varies per model, many unlimited | openrouter.ai |
| **Google AI Studio** | OpenAI-compatible (via proxy) | 15 req/min, 1,500 req/day | aistudio.google.com |
| **Cerebras** | OpenAI-compatible | Free tier available | cloud.cerebras.ai |
| **Together AI** | OpenAI-compatible | $5 free credit on signup | api.together.xyz |

**How rotation works:**
1. Add ALL free keys to `ai_api_keys` table with priority + daily_limit
2. System picks highest-priority key that still has quota
3. When key hits daily limit → auto-fallback to next provider
4. Health check marks dead/rate-limited keys → skip them
5. Counters reset at midnight → all keys available again

**Example config for ~20,000+ free AI calls/day:**
```
Priority 1: Groq (llama-3.1-70b-versatile)      → 14,400/day
Priority 2: OpenRouter (meta-llama/llama-3.1-8b) → ~5,000/day (free model)
Priority 3: Google AI Studio (gemini-1.5-flash)   → 1,500/day
Priority 4: Together AI (free credit)             → fallback
```

### Channel Cost Summary

| Channel | Cost | Free Alternative? |
|---|---|---|
| **AI Messages** | **$0** (multi-provider rotation) | ✅ Yes — strategy above |
| **Email (SMTP)** | **$0** (use existing Hostgator SMTP) | ✅ Already free |
| **Social DMs** | **$0** (manual copy-paste) | ✅ Already free |
| **SMS/MMS** | ~$0.0079/msg (Twilio) | ❌ No free bulk SMS API exists |
| **WhatsApp** | ~$0.05-0.08/msg (Meta) | ❌ No free bulk WhatsApp exists |
| **Database** | **$0** (PostgreSQL, open-source) | ✅ Already free |
| **Redis** | **$0** (Memurai free edition) | ✅ Already free |
| **Reverse Proxy** | **$0** (Caddy + Let's Encrypt) | ✅ Already free |

**Launch with $0 cost:** Email + Social DMs + Free AI rotation. Add SMS ($32 per 4K msgs) and WhatsApp ($200+ per 4K) only when generating revenue.

### Important Notes for Implementation:
- All providers listed use OpenAI-compatible chat completions format (`/v1/chat/completions`)
- The `ai_api_keys` table already stores `provider` — use this to set the correct base URL per provider:
  - Groq: `https://api.groq.com/openai/v1`
  - OpenRouter: `https://openrouter.ai/api/v1`
  - Google AI Studio: `https://generativelanguage.googleapis.com/v1beta/openai`
  - Together AI: `https://api.together.xyz/v1`
  - Cerebras: `https://api.cerebras.ai/v1`
- Add a `base_url` column to `ai_api_keys` table so users can add ANY OpenAI-compatible provider in the future
- Test button on settings page must use the correct base_url per provider

---

## ENVIRONMENT VARIABLES REFERENCE

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/maximus_outreach

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=<random-64-char-string>
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000

# Environment
ENV=development
LOG_LEVEL=info

# File uploads
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=10

# Email tracking
TRACKING_BASE_URL=https://yourdomain.com/api
```

---

## MESSAGE TEMPLATE VARIABLES

Available in templates and AI prompts:

```
{business_name}     → Lead's business name
{first_name}        → First word of business name
{address}           → Full address
{city}              → City extracted from address
{phone}             → Phone number
{website}           → Website URL
{rating}            → Star rating
{reviews}           → Number of reviews
{email}             → Lead's email
{client_name}       → Your client's business name
{client_website}    → Your client's website
{client_phone}      → Your client's phone
{client_services}   → Your client's services description
```

---

## NOTES FOR LLM DEVELOPER

1. **Start backend first, frontend second.** Backend fully functional before frontend.
2. **Use Swagger UI** (`/docs`) to test all API endpoints during backend dev.
3. **Seed data**: After Phase 5, create a seed script with 1 owner + 2 managers + 3 test clients + 50 test leads. Assign managers to different clients.
4. **Social DM queue is NOT automated sending.** AI generates messages, user copy-pastes manually. This is intentional — automated social DMs violate platform ToS.
5. **Email warmup is critical.** Never skip. 1000 emails from new domain = blacklisted.
6. **Enrollment pacing is critical.** 4000 leads must NOT be contacted day 1. Gradual ramp-up protects all channels.
7. **All secrets encrypted at rest** (Fernet). Never plaintext in database.
8. **Celery on Windows**: Must use `--pool=solo`. Windows doesn't support prefork.
9. **Test with real APIs** in Phase 6-9 before campaign execution in Phase 11.
10. **Both dark and light mode must work perfectly.** Test every page in both.
11. **Accessibility is required.** WCAG 2.1 AA. Semantic HTML, ARIA, keyboard nav.
12. **Multiple CSV imports per client.** Track each import separately. Dedup across all imports.
13. **AI model names are free-text.** Do not hardcode a list. User types any model their provider supports.
14. **Role-based access is mandatory.** Every API endpoint that touches client data must check: is user owner OR assigned to this client? Settings/user management = owner only. Never expose other clients' data to managers.
15. **Client selector dropdown** in the header/nav: Owner sees all clients. Manager sees only assigned. This is how users switch context.

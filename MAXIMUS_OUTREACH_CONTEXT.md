# Maximus Outreach — Project Context & Decisions

> **Purpose:** Share this file with the LLM developer agent before starting work.  
> It provides the full context behind every decision in the master prompt.

---

## Who Am I?

I am the owner of a digital marketing agency. I run multiple businesses under the "Maximus" brand:
- Maximus Kitchens (kitchen remodeling)
- Maximus Construction
- Maximus Gaming
- Maximus Digital Marketing (the agency itself)

I have **employees (managers)** who handle day-to-day operations for specific clients. I need them to have their own logins and only see the clients they're assigned to.

I already have a **Lead Scraper Tool** (Maximus-Leads-Scraper) that scrapes Google Maps for business leads and enriches them with emails, social media profiles, and websites. It outputs CSV files.

Now I need **Maximus Outreach** — a platform that takes those leads and runs automated outreach campaigns to convert them into clients.

---

## What Problem Does This Solve?

1. I scrape 4,000+ leads per client using my lead scraper tool
2. I need to contact all of them across multiple channels (email, SMS, WhatsApp, social DMs)
3. Doing this manually is impossible at scale
4. Blasting 4,000 messages on day 1 gets you banned everywhere
5. I need AI to write personalized messages (not copy-paste templates)
6. I need to track who replied and manage conversations
7. I need all of this in one dashboard, not 10 different tools

---

## Key Decisions Made During Planning

### Architecture
- **Multi-tenant**: Each client (Maximus Kitchens, Construction, etc.) is isolated — own leads, campaigns, settings, analytics
- **Role-based access (Owner + Manager)**:
  - **Owner** (me): Full access to everything — all clients, settings, user management, analytics
  - **Manager** (employees): Only see assigned clients. Can import leads, run campaigns, handle social DM queue, review AI replies, view conversations, view analytics. CANNOT create/edit/delete clients, access settings (SMTP, AI, Twilio, WhatsApp), manage users, or bulk delete leads.
  - One manager CAN handle multiple clients (e.g., Ahmed manages Kitchens + Construction)
  - Clients are switched via a dropdown in the top nav (separate views, never mixed)
  - Owner creates manager accounts from a User Management page (no self-registration)
- **Modular approach**: Each service, router, model, component in its own file. Easy to modify one channel without touching others
- **Backend first, frontend second**: Build and test all APIs via Swagger UI (Phases 1-14), then build the frontend that connects to working endpoints (Phases 15-22)

### AI Strategy
- **Multiple free AI providers with key rotation** to achieve zero-cost AI messaging
- Providers: Groq (free), OpenRouter (free models), Google AI Studio (free), Cerebras (free), Together AI (free credits)
- All use OpenAI-compatible format — same code talks to all providers
- Key rotation: highest priority first, auto-fallback when daily limit hit, health checks every 30 min
- **Model names are free-text** — user types any model their provider supports (no hardcoded dropdown list)
- Each API key has its own `base_url` so any OpenAI-compatible provider can be added in the future

### Outreach Channels
- **Email**: Fully automatic via SMTP. I use Hostgator hosting which includes SMTP ($0 extra cost). Email warmup is critical — start 20/day, ramp to 200/day over 3 weeks. Never skip warmup.
- **SMS/MMS**: Fully automatic via Twilio API. Supports text + images + videos (up to 5MB). This is a PAID channel (~$0.0079/SMS). Optional — can skip if budget is tight.
- **WhatsApp**: Fully automatic via Meta WhatsApp Business Cloud API. First contact must use approved template (WhatsApp rule). PAID channel (~$0.05-0.08/msg). Optional.
- **Social Media DMs**: SEMI-AUTOMATIC only. AI generates the message, I manually copy-paste and send on each platform. This is intentional — automated social DMs violate every platform's ToS and get accounts banned. Supports ALL platforms: Instagram, Facebook, LinkedIn, TikTok, Twitter/X, Snapchat, YouTube, any URL.

### Anti-Ban Protection (Critical Feature)
- **Enrollment Pacing**: When 4,000 leads are enrolled in a campaign, they don't all get contacted on day 1
- Pacing modes: All at once (small lists), Fixed daily (e.g. 50/day), Gradual ramp-up (50→100→150→200/day over weeks), Custom schedule
- Leads start as "queued" → pacing worker activates X leads per day → only "active" leads get messages
- Business hours only (configurable send window, e.g. 9 AM - 6 PM)
- This works ON TOP of per-channel rate limits (email warmup, SMS daily cap, WhatsApp tier limits)
- Dashboard shows progress: "750 of 4,000 leads activated (Week 3)"

### Multiple CSV Imports
- Upload multiple CSV files over time to the same client
- Each import is tracked in `lead_imports` table: filename, date, lead count, duplicates skipped
- Deduplication: same email OR same phone within a client = skip (don't contact same person twice)
- Supports both simple CSV (11 columns from basic scrape) and enriched CSV (19 columns with emails/social)

### Response Handling
- **AI Auto-Reply with Human Review**: When a lead replies, AI drafts a response, but I review and approve before it's sent
- I can edit the AI draft or approve as-is
- Review Queue shows all pending drafts with the conversation history
- This prevents AI from saying something wrong to a potential client

### Campaign Sequences
- Each campaign has ordered steps: Step 1 (Email, day 0) → Step 2 (SMS, day 3) → Step 3 (WhatsApp, day 7) → Step 4 (Social DM, day 10)
- Fully configurable per client — different channel order, different delays
- If lead replies at any point → sequence stops automatically
- If lead doesn't have data for a channel (no phone = can't SMS) → skip that step
- Can repeat the full sequence after X days (configurable)

### Frontend Design
- **Dark AND light theme** — both must work perfectly (next-themes with class strategy)
- Dark: black/dark gray backgrounds (#0a0a0a, #111111, #1a1a1a), blue accent (#3b82f6)
- Light: white/gray backgrounds, darker blue accent
- Professional, clean design using shadcn/ui (Radix-based accessible components)
- WCAG 2.1 AA accessibility required — keyboard navigation, screen reader support, color contrast
- Responsive: works on desktop and mobile

### Infrastructure
- I have a **Windows VPS** (Remote Desktop) — everything deploys there
- PostgreSQL 16 (free, Windows installer)
- Memurai = Redis for Windows (free edition)
- NSSM = runs everything as Windows services (survives reboot)
- Caddy = reverse proxy with automatic HTTPS (Let's Encrypt)
- Celery workers must use `--pool=solo` on Windows (doesn't support prefork)

---

## Cost Summary

| What | Cost |
|---|---|
| AI (multi-provider free rotation) | $0 |
| Email (Hostgator SMTP) | $0 |
| Social DMs (manual) | $0 |
| Database (PostgreSQL) | $0 |
| Redis (Memurai) | $0 |
| All frameworks/libraries | $0 |
| **Total to launch** | **$0** |
| SMS/MMS (Twilio, optional) | ~$0.0079/msg |
| WhatsApp (Meta, optional) | ~$0.05/msg |

---

## CSV Format From My Lead Scraper

**Simple scrape (11 columns):**
```
title, rating, reviews, phone, address, website, facebook, instagram, linkedin, youtube, twitter
```

**Enriched scrape (19 columns):**
```
title, rating, reviews, phone, address, website, facebook, instagram, linkedin, youtube, twitter, email, tiktok, snapchat, [additional enriched fields]
```

The CSV import service needs to map these column names to the lead database fields.

---

## What The Lead Scraper Tool Looks Like

The existing lead scraper (separate project, already working) is a Flask + Python app with:
- SerpAPI for Google Maps scraping
- Playwright for website enrichment (finds emails, social links)
- Dark-themed web UI at localhost:5000
- Outputs CSV files to an `output/` folder

Maximus Outreach reads those CSV outputs. The two tools are separate projects — the scraper feeds leads into the outreach platform.

---

## Development Notes

1. **Start backend first (Phases 1-14), frontend second (Phases 15-22).** Test backend via Swagger UI (`/docs`).
2. After Phase 5 (leads), create a seed script with 1 owner + 2 managers + 3 test clients + 50 test leads. Assign managers to different clients.
3. All secrets (API keys, SMTP passwords, tokens) must be encrypted at rest using Fernet. Never plaintext in database.
4. Social DM queue is NOT automated sending — this is intentional to avoid platform bans.
5. Email warmup cannot be skipped — 1000 emails from a new domain = blacklisted.
6. Enrollment pacing cannot be skipped — 4000 contacts on day 1 = banned on every channel.
7. Celery on Windows: must use `--pool=solo`.
8. Test with real APIs only in Phases 6-9 (I'll provide credentials when ready). Use mocks/placeholders before that.
9. Both dark and light theme must work on every page.
10. Accessibility is required, not optional.
11. **Role-based access must be enforced on EVERY endpoint.** Every client-scoped route checks: is user owner OR assigned to this client? Settings and user management = owner only. Managers must never see data from unassigned clients.

---

## How To Start

```
Read the file MAXIMUS_OUTREACH_MASTER_PROMPT.md completely. 
This is your full project specification.

Follow it phase by phase, task by task, exactly as written.
Start with Phase 1, Task 1.1.

Rules:
- Complete each task fully before moving to the next
- Test each task as described before proceeding  
- Ask me if anything is unclear
- Ask me before using any real API keys or credentials
- Commit after each completed phase
- Do not skip any task
```

## How To Resume (After a Break or New Session)

Open `MAXIMUS_OUTREACH_CHECKLIST.html` in your browser, check off completed tasks, click "Copy Status for LLM", then:

```
Read the file MAXIMUS_OUTREACH_MASTER_PROMPT.md completely.

Here is the current build status:
[PASTE CHECKLIST STATUS HERE]

Continue from the first unchecked task. Do not redo completed tasks.
All checked tasks are fully built and tested.
```

# MAXIMUS OUTREACH — Developer Handoff Guide

> Read this FIRST before doing anything. This tells you how to start everything, what's built, and what's next.

---

## HOW TO START EVERYTHING

### 1. Start the Backend (FastAPI)
```powershell
cd "C:\Users\Dell\Desktop\MAXIMUS OUTREACH\maximus-outreach\backend"
.\venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000
```
- Runs at: **http://localhost:8000**
- Swagger docs: **http://localhost:8000/docs**
- Hot-reload enabled — saves auto-restart

### 2. Start the Frontend (Next.js)
```powershell
cd "C:\Users\Dell\Desktop\MAXIMUS OUTREACH\maximus-outreach\frontend"
npm run dev
```
- Runs at: **http://localhost:3000**
- Turbopack hot-reload enabled

### 3. Start Redis (required for Celery workers)
Memurai (Redis for Windows) — start from Services or:
```powershell
Start-Service Memurai
```
If not installed, Celery workers will fail (but API still works without it).

### 4. Start Celery Workers (optional — only needed for background tasks)
```powershell
cd "C:\Users\Dell\Desktop\MAXIMUS OUTREACH\maximus-outreach\backend"
.\venv\Scripts\celery.exe -A app.workers.celery_app worker --pool=solo --loglevel=info
```

---

## DATABASE

| Setting | Value |
|---|---|
| Engine | PostgreSQL 18 |
| Host | localhost:5432 |
| Database | maximus_outreach |
| User | postgres |
| Password | MAXIMUS_OUTREACH |
| Status | ✅ Running (Windows Service: postgresql-x64-18) |
| Migrations | ✅ At HEAD (all 6 migrations applied) |

### Connect via psql:
```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"
$env:PGPASSWORD = "MAXIMUS_OUTREACH"
psql -U postgres -d maximus_outreach
```

### Run migrations (if needed):
```powershell
cd "C:\Users\Dell\Desktop\MAXIMUS OUTREACH\maximus-outreach\backend"
.\venv\Scripts\alembic.exe upgrade head
```
Note: alembic prints INFO to stderr which PowerShell shows as errors — ignore exit code 1 if it says "head".

---

## LOGIN CREDENTIALS

| Account | Email | Password | Role |
|---|---|---|---|
| Owner | owner@maximus.com | Maximus123! | owner (full access) |

### Create a test manager (via API):
```powershell
# First get a token
$token = (Invoke-RestMethod -Method POST -Uri "http://localhost:8000/auth/login" -ContentType "application/json" -Body '{"email":"owner@maximus.com","password":"Maximus123!"}').access_token

# Create manager
Invoke-RestMethod -Method POST -Uri "http://localhost:8000/users" -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"Test Manager","email":"manager@test.com","password":"Manager123!","assigned_client_ids":[]}'
```

---

## TECH STACK DETAILS

### Backend
- **Python 3.13.7** — venv at `backend/venv/`
- **FastAPI 0.115** + **uvicorn** — entry point: `app/main.py`
- **SQLAlchemy 2.0 async** + **asyncpg** — async ORM
- **Alembic** — migrations in `backend/alembic/versions/`
- **passlib + bcrypt 4.0.1** — password hashing (bcrypt 4.0.1 pinned in venv to fix passlib compat issue)
- **python-jose** — JWT tokens (HS256, 24h expiry)
- **Celery + Redis** — background workers
- **Fernet encryption** — for API keys, SMTP passwords stored in DB

### Frontend
- **Next.js 16.2.4** (App Router, Turbopack) — NO `src/` directory
- **TypeScript strict mode**
- **Tailwind CSS v4** — NO tailwind.config.ts; all CSS vars in `app/globals.css` using `@theme inline`
- **shadcn/ui** — uses `@base-ui/react` (NOT Radix UI). **Critical: `DropdownMenuTrigger` does NOT support `asChild` prop**
- **next-themes** — dark/light (class strategy, dark default)
- **TanStack Query** — server state / API calls
- **React Hook Form + Zod** — forms and validation
- **Zustand** (persisted) — client selector state
- **Sonner** — toast notifications
- **Recharts** — analytics charts
- **Axios** — HTTP client with JWT interceptor

---

## ENVIRONMENT FILES

### Backend: `backend/.env`
```
DATABASE_URL=postgresql+asyncpg://postgres:MAXIMUS_OUTREACH@localhost:5432/maximus_outreach
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change-this-to-a-random-64-character-string-before-production
ENCRYPTION_KEY=DgvW05izeGUxvjZlPYPqQCtbygl6WXcXyegzoCh4Ds4=
CORS_ORIGINS=http://localhost:3000
ENV=development
```

### Frontend: `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## FILE STRUCTURE (Frontend — NO src/ dir)

```
frontend/
├── app/
│   ├── globals.css          ← Tailwind v4 theme vars (brand colors)
│   ├── layout.tsx           ← Root layout (Providers wrapper)
│   ├── page.tsx             ← Redirects to /dashboard
│   ├── providers.tsx        ← QueryClient + ThemeProvider + AuthProvider + Toaster
│   ├── login/
│   │   └── page.tsx         ← Login page (email + password, Zod validation)
│   └── (app)/               ← Route group: all authenticated pages
│       ├── layout.tsx       ← Wraps with AppShell (auth guard)
│       ├── dashboard/page.tsx
│       ├── clients/page.tsx
│       ├── social-queue/page.tsx
│       ├── review-queue/page.tsx
│       ├── conversations/page.tsx
│       ├── analytics/page.tsx
│       ├── settings/page.tsx   ← Owner only (redirects managers)
│       └── users/page.tsx      ← Owner only (redirects managers)
├── components/
│   ├── ui/                  ← shadcn auto-generated components
│   ├── layout/
│   │   ├── app-shell.tsx    ← Auth guard + Sidebar + Header + main
│   │   ├── sidebar.tsx      ← Nav (Settings/Users hidden from managers)
│   │   ├── header.tsx       ← Breadcrumbs + ClientSelector + ThemeToggle + Avatar
│   │   ├── client-selector.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── theme-toggle.tsx
│   ├── auth/
│   │   └── role-guard.tsx   ← <RoleGuard role="owner"> hides from managers
│   └── clients/             ← (being built in Phase 16)
├── contexts/
│   └── auth-context.tsx     ← AuthProvider: user, isLoading, isOwner, login(), logout()
├── stores/
│   └── client-store.ts      ← Zustand: selectedClientId (persisted)
├── lib/
│   ├── api.ts               ← Axios instance: JWT auto-attach, 401→/login
│   ├── constants.ts         ← ROLES, CHANNELS, LEAD_STATUSES, etc.
│   └── hooks/               ← TanStack Query hooks per domain
├── types/
│   └── index.ts             ← All TypeScript interfaces (User, Client, Lead, Campaign, etc.)
```

---

## BRAND COLORS (Dark Theme)
| Variable | Value | Use |
|---|---|---|
| Background | `#0a0a0a` | Page background |
| Sidebar | `#111111` | Sidebar bg |
| Cards | `#1a1a1a` | Card bg |
| Borders | `#262626` | Borders |
| Accent | `#3b82f6` | Primary blue |
| Text | `#fafafa` | Primary text |

---

## ROLE-BASED ACCESS RULES

| Feature | Owner | Manager |
|---|---|---|
| See all clients | ✅ | ❌ (assigned only) |
| Create/edit/delete clients | ✅ | ❌ (403) |
| Settings pages | ✅ | ❌ (redirect to /dashboard) |
| Users page | ✅ | ❌ (redirect to /dashboard) |
| Bulk delete leads | ✅ | ❌ (button hidden) |
| Import leads | ✅ | ✅ |
| Build campaigns | ✅ | ✅ |
| Social DM queue | ✅ | ✅ |
| Review queue | ✅ | ✅ |
| Analytics | ✅ | ✅ (own clients only) |

Use `<RoleGuard role="owner">` to hide UI elements. Backend enforces via `require_owner` dependency.

---

## PROGRESS TRACKER

### Backend — ALL COMPLETE ✅
- Phase 1: Project scaffold + DB schema + migrations
- Phase 2: Auth (JWT, bcrypt, register/login/me, role guards)
- Phase 3: User management (owner only)
- Phase 4: Client management (CRUD, role filtering)
- Phase 5: Lead management + CSV import (dedup, import history)
- Phase 6: AI engine (OpenRouter/Groq, key rotation, health worker)
- Phase 7: Email channel (SMTP, warmup, open/click tracking)
- Phase 8: SMS channel (Email-to-SMS free + Twilio/Telnyx fallback, webhooks)
- Phase 9: WhatsApp channel (Meta Cloud API, webhooks)
- Phase 10: Social DM queue
- Phase 11: Campaign builder + pacing + scheduler workers
- Phase 12: Response handling + review queue
- Phase 13: Analytics
- Phase 14: Media library

### Frontend — IN PROGRESS
- Phase 15 ✅ — Foundation (scaffold, layout, auth, login, RoleGuard)
- Phase 16 🔄 — **NEXT: Client Management** (list, create/edit form, detail page)
- Phase 17 ⬜ — Lead Management (table, CSV import modal, import history)
- Phase 18 ⬜ — Campaign Builder (list, sequence builder, pacing config)
- Phase 19 ⬜ — Outreach Queues + Conversations
- Phase 20 ⬜ — Analytics Dashboard
- Phase 21 ⬜ — Settings + User Management pages
- Phase 22 ⬜ — Accessibility + Polish
- Phase 23 ⬜ — QA Testing
- Phase 24 ⬜ — Deployment (NSSM services + Caddy)

---

## KNOWN ISSUES / GOTCHAS

1. **shadcn `DropdownMenuTrigger` has no `asChild`** — style it directly with className instead of wrapping a Button
2. **Tailwind v4** — use `@theme inline` in globals.css, NOT tailwind.config.ts
3. **Alembic exits with code 1** on PowerShell even when successful — stderr INFO logs look like errors
4. **bcrypt passlib compat** — passlib 1.7 has a bug with bcrypt 4.x; fixed by installing bcrypt==4.0.1
5. **Dev server always on port 3000** (PID 17468 already running) — don't start another one
6. **Backend already running** — check before starting another uvicorn instance

---

## QUICK TEST COMMANDS

```powershell
# Test backend health
Invoke-RestMethod http://localhost:8000/health

# Test login
Invoke-RestMethod -Method POST -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"owner@maximus.com","password":"Maximus123!"}'

# Build frontend (check for TypeScript errors)
cd "C:\Users\Dell\Desktop\MAXIMUS OUTREACH\maximus-outreach\frontend"
npm run build
```

# Maximus Outreach - VPS Deployment Progress (2026-04-24)

## Current Status
Deployment for testing is working on VPS via dev servers.

## Completed
- Cloned repo to VPS:
  - `C:\maximus-outreach\MAXIMUS-OUTREACH`
- Backend environment setup:
  - Python venv created
  - `requirements.txt` installed
- PostgreSQL setup:
  - PostgreSQL 16 installed
  - Database created: `maximus_outreach`
- Backend DB setup:
  - Alembic URL corrected in `alembic.ini`
  - Tables created successfully (model-based create)
- Auth setup:
  - Owner account created:
    - `owner@maximus.com`
    - password: `Maximus123!`
  - Login API validated (`/auth/login` + `/auth/me`)
- Frontend setup:
  - `npm install` completed
  - `next dev` running on port 3000
- Network access:
  - Backend reachable on `http://142.147.96.207:8000`
  - Frontend reachable on `http://142.147.96.207:3000`
- CORS checks:
  - OPTIONS preflight validated for origin `http://142.147.96.207:3000`
- Login issue resolved:
  - Root cause: frontend was using stale API target (`localhost:8000`)
  - Fixed by restarting frontend with explicit env:
    - `NEXT_PUBLIC_API_URL=http://142.147.96.207:8000`

## Current Runtime (Testing Mode)
- Backend running in terminal:
  - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Frontend running in terminal:
  - `npm run dev -- --port 3000`
- Note: terminals must stay open in this mode.

## Still Pending (Production-Grade)
- Convert backend/frontend to Windows services (NSSM) so terminals are not required
- Configure Celery worker + beat as services
- Configure Caddy route/domain/HTTPS for this app
- Final end-to-end channel QA:
  - Email
  - SMS
  - WhatsApp
- Reboot persistence verification (services auto-start after reboot)

## Key Config Used
- Backend `.env` includes:
  - `DATABASE_URL=postgresql+asyncpg://postgres:MaximusPg2026@localhost:5432/maximus_outreach`
  - `REDIS_URL=redis://localhost:6379/0`
  - `CORS_ORIGINS=http://142.147.96.207:3000,http://localhost:3000`
- Frontend `.env.local`:
  - `NEXT_PUBLIC_API_URL=http://142.147.96.207:8000`

## Quick Access URLs
- Frontend: `http://142.147.96.207:3000`
- Backend docs: `http://142.147.96.207:8000/docs`
- Backend health: `http://142.147.96.207:8000/health`

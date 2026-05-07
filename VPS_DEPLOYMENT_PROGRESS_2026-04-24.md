# Maximus Outreach - VPS Deployment Progress (2026-04-24, updated 2026-04-25)

## Current Status
✅ Fully running on VPS in background — no terminals required. Login works.

---

## Quick Access URLs
- Frontend: `http://142.147.96.207:3000`
- Backend API docs: `http://142.147.96.207:8001/docs`
- Backend health: `http://142.147.96.207:8001/health`

## Login Credentials
- Email: `owner@maximus.com`
- Password: `Maximus123!`

---

## Port Assignment
| Service | Port | Notes |
|---|---|---|
| Backend (uvicorn) | **8001** | Port 8000 was already taken by another tool on this VPS |
| Frontend (Next.js) | **3000** | |

---

## How It Runs (Background — No Terminals Needed)

Both backend and frontend run as hidden background processes. All terminals can be closed.

---

## Start / Restart Everything (One Command)

Use this single command to stop all running services and restart backend, Celery worker, Celery beat, and frontend. Run from any PowerShell window on VPS:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "uvicorn app.main:app" -and $_.CommandLine -match "--port 8001" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "celery.exe" -and $_.CommandLine -match "maximus-outreach" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "next dev" -and $_.CommandLine -match "maximus-outreach" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Start-Sleep -Seconds 3; Start-Process -FilePath "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend\venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8001" -WorkingDirectory "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend" -WindowStyle Hidden; Start-Process -FilePath "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend\venv\Scripts\celery.exe" -ArgumentList "-A app.workers.celery_app worker --pool=solo --loglevel=info" -WorkingDirectory "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend" -WindowStyle Hidden; Start-Process -FilePath "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend\venv\Scripts\celery.exe" -ArgumentList "-A app.workers.celery_app beat --loglevel=info --schedule celerybeat-schedule" -WorkingDirectory "C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend" -WindowStyle Hidden; Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList '/c "cd /d C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\frontend && npm run dev -- --port 3000"' -WindowStyle Hidden; Start-Sleep -Seconds 10; try { (Invoke-WebRequest "http://localhost:8001/health" -UseBasicParsing).StatusCode } catch { "backend not ready yet" }
```

Returns `200` = everything running. You can close the terminal after.

## Pull Latest Code from GitHub + Restart

Run this after every `git push` from local to update VPS:

```powershell
cd C:\maximus-outreach\MAXIMUS-OUTREACH; git pull
```

Then run the full restart command above.

## If VPS Reboots — Restart Everything

Run the "Start / Restart Everything" command above from any PowerShell window.

### Verify both are running:
```powershell
netstat -ano | findstr ":8001 \|:3000 "
```
Both ports should show `LISTENING`.

### Test backend health:
```powershell
Invoke-RestMethod http://localhost:8001/health
```
Should return `status: ok`.

### Test login API:
```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:8001/auth/login" -ContentType "application/json" -Body '{"email":"owner@maximus.com","password":"Maximus123!"}'
```
Should return a JWT `access_token`.

---

## Key Config

### Backend `.env` (`C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\backend\.env`):
```
DATABASE_URL=postgresql+asyncpg://postgres:MaximusPg2026@localhost:5432/maximus_outreach
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://142.147.96.207:3000,http://localhost:3000
```

### Frontend `.env.local` (`C:\maximus-outreach\MAXIMUS-OUTREACH\maximus-outreach\frontend\.env.local`):
```
NEXT_PUBLIC_API_URL=http://142.147.96.207:8001
```

---

## Database
| Setting | Value |
|---|---|
| Engine | PostgreSQL 16 |
| Host | localhost:5432 |
| Database | maximus_outreach |
| User | postgres |
| Password | MaximusPg2026 |

### Connect via psql:
```powershell
$env:PGPASSWORD = "MaximusPg2026"
psql -U postgres -d maximus_outreach
```

---

## Firewall Rules Added
- Port **8001** opened for inbound TCP: rule name `maximus-outreach-backend`
- Port **3000** was already open from previous setup

---

## Completed Setup Steps
- Cloned repo to VPS: `C:\maximus-outreach\MAXIMUS-OUTREACH`
- Python venv created, `requirements.txt` installed
- PostgreSQL 16 installed, database `maximus_outreach` created
- Alembic migrations applied, all tables created
- Owner account created (`owner@maximus.com` / `Maximus123!`)
- `npm install` completed for frontend
- `.env.local` updated to point to port 8001
- Windows Firewall rule added for port 8001
- Both backend and frontend running as hidden background processes

## Still Pending (Production-Grade)
- Configure Celery worker + beat as background services
- Configure Caddy + domain + HTTPS
- Final end-to-end channel QA (Email, SMS, WhatsApp)
- Add auto-start on reboot (Windows Scheduled Task or NSSM)

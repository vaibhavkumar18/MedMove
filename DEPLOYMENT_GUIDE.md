# MedMove — Deployment Guide

**Stack:** FastAPI (Render) · Neon PostgreSQL · React/Vite (Vercel)
**Monorepo layout:**

```
MedMove/
├── Backend/          # FastAPI application
│   ├── app/
│   ├── alembic/
│   └── backend-requirements.txt
├── Frontend/         # React + Vite
│   └── src/
├── Optimizer/        # OR-Tools CP-SAT package (not installed as wheel)
│   └── medmove_optimizer/
└── DEPLOYMENT_GUIDE.md
```

> **Important:** The Backend imports `medmove_optimizer` directly from the sibling
> `Optimizer/` directory at runtime — it is not installed as a Python wheel. The
> Render build command must add the `Optimizer/` directory to `PYTHONPATH`.

---

## 1. Neon PostgreSQL — Database

### Connection string

1. Open your Neon project → **Connection Details**.
2. Select **psycopg (Python)** as the driver.
3. Copy the connection string. It looks like:
   ```
   postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Set this as `DATABASE_URL` in your Render backend service environment variables.

### Schema migrations

Run migrations once after the first deploy (and after any schema changes):

```bash
cd Backend
PYTHONPATH=. alembic upgrade head
```

On Render you can run this as a one-off job or add it to the build command.

> The existing Alembic revision is `196ffc20a50f`. The migration creates all
> required tables. Do not run `alembic downgrade` or drop tables manually.

### Seed the demo dataset

After migrations, seed facilities, medicines, plans, routes, and the coordinator account:

```bash
cd Backend
PYTHONPATH=. python scripts/seed_demo.py
```

> This script is idempotent — safe to run multiple times.

---

## 2. Backend — Render

### Why the repo root must be the Render root

The `Backend/` application imports `medmove_optimizer` from the sibling `Optimizer/`
directory at runtime. If Render is configured with `Backend/` as the root directory,
the `Optimizer/` directory will not be present and imports will fail.

**Set the Render root directory to the monorepo root (`/` or leave blank).**

### Render service settings

| Setting | Value |
|---|---|
| **Environment** | Python 3 |
| **Root directory** | *(leave blank — monorepo root)* |
| **Build command** | See below |
| **Start command** | See below |
| **Health check path** | `/api/v1/health` |

### Build command

```bash
pip install -r Backend/backend-requirements.txt
```

This installs all Python dependencies including `ortools`. The `Optimizer/`
package is loaded from source at runtime — no separate install needed.

### Start command

```bash
cd Backend && PYTHONPATH=.:../Optimizer uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

`PYTHONPATH=.:../Optimizer` ensures:
- `.` resolves `app.*` imports inside `Backend/`
- `../Optimizer` resolves `medmove_optimizer` imports from the sibling directory

### Database migration (one-off job or pre-deploy hook)

```bash
cd Backend && PYTHONPATH=. alembic upgrade head
```

### Required environment variables on Render

| Variable | Required | Example / note |
|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql+psycopg://user:pass@host/neondb?sslmode=require` |
| `JWT_SECRET_KEY` | **Yes** | 64-char random hex — `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRES_MINUTES` | No | `480` (8 hours) |
| `COORDINATOR_EMAIL` | **Yes** | Must match what was used in the seed script |
| `COORDINATOR_PASSWORD` | **Yes** | Must match the seeded coordinator hash |
| `FRONTEND_ORIGINS` | **Yes** | `https://your-app.vercel.app` (exact Vercel URL, no trailing slash) |
| `AUTH_COOKIE_SECURE` | **Yes** | `true` (HTTPS in production) |
| `AUTH_COOKIE_SAMESITE` | **Yes** | `none` (cross-site cookie between Render + Vercel) |
| `AUTH_COOKIE_DOMAIN` | No | Leave blank unless using a shared custom domain |
| `AUTH_COOKIE_NAME` | No | `medmove_access_token` |
| `DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS` | No | `500000` |
| `DEFAULT_PLANNING_DATE` | No | `2027-01-15` |

> **Cookie note for cross-site deployment:** Because the frontend (Vercel) and
> backend (Render) are on different origins, the HttpOnly cookie requires
> `AUTH_COOKIE_SAMESITE=none` AND `AUTH_COOKIE_SECURE=true`. The `FRONTEND_ORIGINS`
> value must be the exact production Vercel URL — not a wildcard.

> **CORS note:** `allow_credentials=True` is set in the application. With
> credentials enabled, `FRONTEND_ORIGINS` must list exact origins — never `*`.

### Local development

```bash
cd Backend
cp .env.example .env        # fill in your local values
PYTHONPATH=.:../Optimizer uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 3. Frontend — Vercel

### Vercel project settings

| Setting | Value |
|---|---|
| **Framework Preset** | Vite |
| **Root directory** | `Frontend` |
| **Build command** | `npm run build` (runs `tsc -b && vite build`) |
| **Output directory** | `dist` |
| **Install command** | `npm install` |

### Environment variables on Vercel

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-render-service.onrender.com/api/v1` |

> All `VITE_*` variables are bundled into the client-side JavaScript bundle at
> build time. **Never** put secrets (database passwords, JWT signing keys, API
> tokens) in `VITE_*` variables.

### Local development

```bash
cd Frontend
cp .env.example .env        # set VITE_API_BASE_URL=http://localhost:8000/api/v1
npm install
npm run dev
```

---

## 4. Full local development setup

```bash
# Terminal 1 — Backend
cd Backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r backend-requirements.txt
cp .env.example .env            # fill in DATABASE_URL and JWT_SECRET_KEY
set PYTHONPATH=.;..\Optimizer   # Windows
# export PYTHONPATH=.:../Optimizer  # macOS/Linux

# Run migrations (first time or after schema changes)
alembic upgrade head

# Seed demo data (first time only; idempotent)
python scripts/seed_demo.py

# Start backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 — Frontend
cd Frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

---

## 5. Environment variable reference

### Backend (`Backend/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | Neon PostgreSQL connection string |
| `JWT_SECRET_KEY` | **Yes** | `super-secret-dev-key-change-in-prod` | JWT signing key — change before any shared deployment |
| `JWT_EXPIRES_MINUTES` | No | `480` | Token lifetime in minutes |
| `COORDINATOR_EMAIL` | **Yes** | `coordinator@medmove.test` | Seed/login email for the coordinator account |
| `COORDINATOR_PASSWORD` | **Yes** | `coordinator-password` | Seed/login password for the coordinator account |
| `DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS` | No | `500000` | Default budget for triggered runs in INR paise |
| `DEFAULT_PLANNING_DATE` | No | `2027-01-15` | Planning date for automatic trigger runs |
| `AUTH_COOKIE_NAME` | No | `medmove_access_token` | HttpOnly cookie name |
| `AUTH_COOKIE_SECURE` | **Prod** | `false` | Must be `true` in production (HTTPS) |
| `AUTH_COOKIE_SAMESITE` | **Prod** | `lax` | Use `none` for cross-site (Render + Vercel) |
| `AUTH_COOKIE_DOMAIN` | No | — | Only set when frontend/API share a domain |
| `FRONTEND_ORIGINS` | **Yes** | `http://localhost:5173,...` | Comma-separated exact frontend origins for CORS |

### Frontend (`Frontend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | Backend API root including `/api/v1` — bundled into client JS |

---

## 6. Health check

The backend exposes a public health endpoint:

```
GET /api/v1/health
→ 200 {"status": "ok", "service": "medmove-api"}
```

Configure this as the Render health check path: `/api/v1/health`

---

## 7. Checklist before go-live

- [ ] `DATABASE_URL` points to Neon Development (not a local PostgreSQL)
- [ ] `JWT_SECRET_KEY` is a strong random value (not the default)
- [ ] `COORDINATOR_EMAIL` and `COORDINATOR_PASSWORD` match the seeded account
- [ ] `FRONTEND_ORIGINS` contains the exact Vercel production URL
- [ ] `AUTH_COOKIE_SECURE=true` and `AUTH_COOKIE_SAMESITE=none` for cross-site
- [ ] Alembic migration `196ffc20a50f` applied: `alembic upgrade head`
- [ ] `scripts/seed_demo.py` run successfully at least once
- [ ] `VITE_API_BASE_URL` on Vercel points to the Render service URL (includes `/api/v1`)
- [ ] Vercel root directory set to `Frontend`
- [ ] Render root directory is the monorepo root (not `Backend/`)
- [ ] Health check responds at `/api/v1/health`

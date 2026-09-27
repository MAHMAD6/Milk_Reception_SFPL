# Milk_Reception_SFPL

Milk Reception Management System for **Shakarganj Food Products Ltd. (SFPL)**.

This application manages the complete milk reception workflow from dispatch through plant reception, quality testing, weighing, unloading, silo receipt, and gate exit.

## Technology Stack

* Next.js 16 (App Router, Turbopack) · React 19
* TypeScript 7 (type checking) — `typescript` resolves to the TS 6 API for tooling
* PostgreSQL 18 · Prisma 7 (node-postgres driver adapter, `prisma.config.ts`)
* Tailwind CSS 4 · shadcn/ui (Radix) · framer-motion · sonner — see `docs/ui-guidelines.md`
* JWT authentication (jose)
* Node.js 24 LTS (`.nvmrc`; minimum 22.12)

## Current Architecture

```text
Next.js Application
        ↓
Backend APIs / Services
        ↓
Prisma ORM
        ↓
PostgreSQL
```

PostgreSQL is the authoritative source of truth for operational data.

## Main Operational Modules

* MPD Dispatch
* Security / Gate Entry & Exit
* Plant QA
* Weighbridge
* Production / Unloading
* Silo Inventory
* Super Admin

## Vehicle Reception Workflow

```text
DISPATCHED
→ TOKEN_ISSUED
→ PLANT_QA
→ READY_FOR_GROSS
→ GROSS_WEIGHED
→ READY_FOR_UNLOADING
→ UNLOADING
→ READY_FOR_TARE
→ TARE_WEIGHED
→ READY_FOR_GATE_EXIT
→ COMPLETED
```

All-rejected vehicles bypass weighing, unloading, tare, and final silo receipt and may proceed directly to gate exit after QA completion.

## Operational Time Model

The system keeps the following time concepts strictly separate:

* **Operational Date & Time** — actual physical event time (e.g. gate entry, weighment, testing, discharge)
* **Submitted At** — immutable server timestamp when the record was persisted
* **Performed By** — authenticated user who submitted the action
* **Plant Business Date** — plant reporting date based on the 08:00 AM cutoff, **applied only at authoritative Plant Gate Exit** (`VehicleVisit.operational_date`).
* **Upstream Facility Dates** — ZMCC Gate Entry/Exit, MOT collections/journeys, Local Supplier arrivals, and MPD Dispatches strictly use Pakistan calendar dates (`Asia/Karachi`) with no 08:00 AM shift.

Plant timezone:

```text
Asia/Karachi
```

Plant Business Day (applied at Plant Gate Exit):

```text
08:00 AM
to
07:59:59.999 AM next calendar day
```

## Milk Volume & Inventory Authority

The application uses centralized backend formulas and standardized terminology:

* **Gross Liters** — current physical inventory term for actual volumetric milk (`Physical Liters = Net Kg / Density`).
* **@13TS Liters** — commercial standardized volume for payment, quality valuation, and standardized accounting (`@13TS Liters = Gross Liters × TS / 13`).

```text
Density = 1 + LR / 1000

SNF % = LR / 4 + (0.22 × Fat %) + 0.72

TS % = Fat % + SNF %

SNF : Fat Ratio = SNF % / Fat %

Gross Liters (Physical Liters) = Net Kg / Density

@13 TS Liters = Gross Liters × TS / 13
```

## Final Silo Receipt

Final milk receipt is recorded at vehicle level into plant storage silos.

Canonical idempotency key:

```text
FINAL_RECEIPT:VISIT:<visitId>
```

Gross, Tare, Net Kg, Gross Liters, and Final Silo Receipt belong to the vehicle reception process.

## Procurement Sources

Current operational source configuration includes:

* ZMCC Hasilpur
* ZMCC Jhang
* ZMCC Kabirwala
* Al Mehmood Dairy
* Al Khair Dairy

Visits use a real `procurement_source_id` relation rather than hardcoded source names.

## Development Database

Development currently uses local PostgreSQL.

The project contains versioned Prisma migrations and can recreate the database schema using:

```bash
npx prisma migrate deploy
```

For development schema changes, use:

```bash
npx prisma migrate dev
```

Do not use `prisma db push` as the normal deployment workflow.

## Local Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env` and fill it in. Every variable is documented there.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Session signing key; ≥ 32 random chars in production (`openssl rand -base64 48`) |
| `APP_URL` / `ALLOWED_ORIGINS` | recommended | Origins allowed to make state-changing API calls |
| `TRUST_PROXY` | behind a proxy | Trust `X-Forwarded-*` headers (client IP for rate limiting, forwarded host) |
| `SESSION_COOKIE_SECURE` | no | Defaults to secure cookies in production; `false` only for a plain-HTTP intranet |
| `BOOTSTRAP_ADMIN_*` | first deploy | Creates the first Super Admin when the production seed runs on an empty database |
| `CRON_SECRET` | for SMS | Shared secret for `/api/cron/*` |
| `SMS_PROVIDER_URL` / `SMS_PROVIDER_TOKEN` / `SMS_SENDER_ID` | for SMS | HTTPS gateway for MOT collection receipts; messages stay `PENDING` until set |
| `TV_BOARD_ACCESS_KEY` | no | Lets an unattended yard screen open `/tv-board?key=…` without signing in |
| `ENABLE_DEMO_LOGIN` | no | Demo sign-in shortcuts (on automatically under `npm run dev`); **never** enable on real data |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push | Web Push keys (`npx web-push generate-vapid-keys`); the public key is inlined into the browser bundle at build time |

The server validates its environment at startup and refuses to start in production with a
missing or weak `JWT_SECRET` or a missing `DATABASE_URL`.

The real `.env` file must never be committed (it is in `.gitignore` and `.dockerignore`).

## Development Safety

The following should not be committed:

```text
.env
node_modules/
.next/
log files
local build/cache files
```

These are excluded through `.gitignore`.

## Project Verification

Common validation commands:

```bash
npx prisma validate
npx prisma generate
npm run db:drift            # migrations and schema.prisma agree
npm run lint
npm run typecheck
npm test                    # unit tests (no database needed)
npm run test:integration    # route-handler tests; needs DATABASE_URL on a migrated, seeded DB
npm run build
```

## Security Model

* **Sessions** — HS256 JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), with pinned
  algorithm, issuer and audience. Role, scope and active status are re-read from PostgreSQL on every
  request; changing or resetting a password revokes every existing session for that user.
* **Sign-in** — generic failure messages (no account enumeration), constant-time comparison for
  unknown users, and a lockout of 10 attempts per username / 50 per client IP per 15 minutes.
  The limiter is in-process: run a single instance or add a shared limiter at the reverse proxy.
* **Authorization** — every API route authenticates and checks role and procurement-source scope
  server-side; source-scoped roles only ever see their own ZMCC/contractor data, and roles without
  an explicit grant are refused (fail closed).
* **Request proxy** (`src/proxy.ts`) — redirects signed-out page loads to `/login`, rejects
  cross-origin state-changing API requests, and sets CSP, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` and (over HTTPS) HSTS.
* **Errors** — API responses never include database or runtime error details; those are logged
  server-side only.

## Deployment

The app is provider-neutral: any host that can run Node.js 24 or a container and reach PostgreSQL.

### Container (recommended)

```bash
cp .env.example .env        # set JWT_SECRET, POSTGRES_PASSWORD, BOOTSTRAP_ADMIN_PASSWORD, ...
docker compose up -d --build
```

`docker-compose.yml` runs PostgreSQL, a one-off `migrate` job (`prisma migrate deploy` then the
production-safe seed) and the app, which only starts once migrations succeed. The image is a
non-root, standalone Next.js build with a built-in health check.

To use an existing PostgreSQL instead, build the two images and run them yourself:

```bash
docker build --target migrator -t milk-reception:migrator .
docker build --target runner   -t milk-reception:app .
docker run --rm --env-file .env milk-reception:migrator                        # each release
docker run --rm --env-file .env milk-reception:migrator npx prisma db seed     # first deploy
docker run -d  --env-file .env -p 3000:3000 milk-reception:app
```

### Bare Node.js

```bash
npm ci
npm run db:migrate                             # apply migrations
NODE_ENV=production npm run db:seed            # first deploy: reference data + bootstrap admin
npm run build
NODE_ENV=production npm start
```

### Production seed

With `NODE_ENV=production` (or `SEED_MODE=production`), `prisma db seed` only creates missing
reference data (lab tests, procurement sources, chiller ownership) and — if no active Super Admin
exists — one Super Admin from `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` (≥ 12 chars).
It never creates demo accounts and never overwrites data edited in the app. Sign in and rotate the
bootstrap password immediately.

Demo data scripts (`scripts/*demo*`, `prisma/reset-dev-login-passwords.ts`) refuse to run with
`NODE_ENV=production` and require `ALLOW_DEMO_RESET=true`.

### Operations

* **Health check** — `GET /api/health` returns `200 {"status":"ok"}` when the database is reachable, `503` otherwise.
* **Scheduled jobs** — call these every minute from cron, a systemd timer or a Kubernetes CronJob:
  ```bash
  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/process-sms    # MOT SMS receipts
  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/process-push   # browser push alerts
  ```
  SMS messages are retried up to 3 times. Push alerts honour each user's settings (push on/off, quiet hours in
  plant time, immediate or hourly digest); CRITICAL alerts bypass quiet hours and digests, and devices the push
  service reports as gone are revoked automatically. Each user turns alerts on per device under
  **Notification settings → Enable on this device** (browsers only allow the permission prompt from a click).
* **Reverse proxy** — terminate TLS in front of the app, forward `Host`/`X-Forwarded-*`, and set `TRUST_PROXY=true`.
* **Migrations** — `npm run db:drift` (also enforced in CI) fails if `schema.prisma` and the migrations disagree.

### Known limitations

* Emergency vehicle substitution and village-shop rejections are not modelled yet, so the MPD executive
  dashboard shows those sections as empty ("—") rather than estimated figures.

## Repository

This repository contains the development source code for the SFPL Milk Reception Management System.

CI (`.github/workflows/ci.yml`) applies migrations to a fresh PostgreSQL, seeds it, checks for schema
drift, audits production dependencies, typechecks, runs the unit and integration tests, lints, builds,
and builds the production container image.

# CRM Optimaviz Ops

A standalone multi-brand CRM with React frontend, Express backend, authentication, and local JSON database — all in one repo and runtime.

## Stack

- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4
- **Backend:** Express (TypeScript via tsx)
- **Database:** `db.json` (local file, backed up to `backups/ops/`)
- **Auth:** Custom session tokens stored in db.json; bearer token + `optima_session_id` cookie

## Running the app

```
npm run dev       # starts full app (Express + Vite middleware) on port 5000
npm run build     # builds frontend and bundles Express into dist/server.cjs
npm start         # runs production build
```

The workflow `Start application` runs `npm run dev` and serves on port 5000.

## Brands

Optimaviz, TaskGo, IDAO, OptimaClean, NestWise

## Authentication

- Two built-in admin accounts (superadmin and platform admin) — credentials are set via `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` / `ADMIN_BOOTSTRAP_PASSWORD` secrets, or fall back to seeded defaults defined in `server.ts` (change these before any production use)
- Sessions last 30 days; bearer token stored in `localStorage['optima_session_token']`
- `SESSION_SECRET` is configured as a Replit secret

## Key environment variables (optional integrations)

See `STANDALONE_ARCHITECTURE.md` and `WHATSAPP_AND_CALLS_SETUP.md` for full details.
Core runtime:
- `PORT` — defaults to 5000
- `SESSION_SECRET` — session security (set as Replit secret)
- `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` — override superadmin password

## User preferences

- Keep existing project structure and stack; do not migrate or restructure unless asked.

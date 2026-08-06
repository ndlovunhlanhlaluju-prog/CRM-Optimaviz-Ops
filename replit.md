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
The default production mode is one self-contained Node process serving both the
React UI and `/api/*` routes. It does not require Render, Vercel, or another
specific hosting provider.

## Brands

Optimaviz, TaskGo, IDAO, OptimaClean, NestWise

## Authentication

- Two built-in admin accounts (superadmin and platform admin) — credentials are set via `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` / `ADMIN_BOOTSTRAP_PASSWORD` secrets, or fall back to seeded defaults defined in `server.ts` (change these before any production use)
- Sessions last 30 days; bearer token stored in `localStorage['optima_session_token']`
- `SESSION_SECRET` is configured as a Replit secret

## Deployment environment variables

See `STANDALONE_ARCHITECTURE.md` and `WHATSAPP_AND_CALLS_SETUP.md` for full details.
Core runtime:
- `PORT` — defaults to 5000
- `SESSION_SECRET` — session security (set as Replit secret)
- `CRM_DB_FILE` — optional path for the local JSON database
- `CRM_BACKUP_DIR` — optional backup directory
- `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` — override superadmin password
- `VITE_API_BASE_URL` — optional only when the frontend and API are hosted separately
- `PUBLIC_API_URL`, `FRONTEND_URL`, `APP_BASE_URL`, `CORS_ORIGINS` — optional generic URL/origin settings for split hosting

For a single-host deployment, leave the URL override variables unset and run
`npm run build && npm start`. The host must provide a long-running Node
process and persistent storage for `db.json` and `backups/ops/`.

## User preferences

- Keep existing project structure and stack; do not migrate or restructure unless asked.

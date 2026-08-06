# Standalone architecture

This repository is a single deployable CRM application. It contains the React frontend, the Express API, authentication, local persistence, and production static-file serving.

## Runtime

```text
Browser
  └── same origin
      ├── /api/*  → Express routes in server.ts and server/routes/
      └── /*       → React application from dist/
                         │
                         └── db.json + backups/ops/
```

There is no separate SaaS platform backend and no required hosting-provider configuration. By default the browser sends relative `/api/*` requests to the host that served the UI. For an intentional split deployment, set the frontend build variable `VITE_API_BASE_URL` to the API origin.

## Development and production

- `npm run dev` starts the Express server with Vite middleware on port `5000` by default.
- `npm run build` builds the React app and bundles the Express server into `dist/server.cjs`.
- `npm start` runs the production server. The same process serves both the API and the React build.
- `GET /api/health` reports the standalone runtime status.
- `createApp()` is exported from `server.ts` for hosts that provide their own Node/HTTP adapter.

A deployment must use the Node server entry point (`npm start`). Static-only hosting is not supported because it would omit the backend and authentication API. Platforms that only run short-lived serverless functions also require a durable external database instead of the local JSON file.

## Persistence

`db.json` is the authoritative database. Writes are persisted locally and copied to timestamped files under `backups/ops/`.

Optional paths:

- `CRM_DB_FILE` changes the database file location.
- `CRM_BACKUP_DIR` changes the backup directory.

Use persistent storage for both paths in production. The application does not read from or push normal writes to the former SaaS database.

## Environment

Core runtime settings:

- `PORT` — HTTP port; defaults to `5000`.
- `CRM_DB_FILE` — local database path; defaults to `db.json`.
- `CRM_BACKUP_DIR` — backup path; defaults to `backups/ops`.
- `SESSION_SECRET` — secret used for session security.
- `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` — initial owner password for a new database.
- `VITE_API_BASE_URL` — optional frontend build-time API origin for split hosting; leave unset for one-host deployments.
- `PUBLIC_API_URL` — optional public API origin used to build provider callback URLs when the API is behind a proxy.
- `FRONTEND_URL` / `APP_BASE_URL` — optional frontend origin used for OAuth return URLs in split hosting.
- `CORS_ORIGINS` — optional comma-separated frontend origins allowed for cross-origin requests.

Provider credentials for Gmail, Outlook, SMTP, WhatsApp, Meta, or LinkedIn remain optional integrations. They are not part of the frontend/backend architecture and are only needed when their corresponding feature is enabled.

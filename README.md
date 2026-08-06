# CRM Optimaviz Ops

A standalone multi-brand CRM containing its React frontend, Express backend, authentication, integrations, and local database in one repository and one runtime.

## Architecture

- React and Vite provide the user interface.
- Express owns all `/api/*` routes.
- The browser always uses same-origin API requests.
- `db.json` is the authoritative local database, with backups in `backups/ops/`.
- The production Express process serves the compiled React application from `dist/`.
- No separate CRM SaaS platform is required.

## Lifecycle

- `npm run dev` starts the complete development application.
- `npm run build` compiles both frontend and backend.
- `npm start` runs the complete production application.
- `GET /api/health` verifies that the standalone backend is available.

See [STANDALONE_ARCHITECTURE.md](./STANDALONE_ARCHITECTURE.md) for deployment and persistence details.

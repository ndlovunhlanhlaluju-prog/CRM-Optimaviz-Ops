# Git model — CRM Optima Ops

This is a **single-product** repository (internal ops UI).

| Branch | Use |
|--------|-----|
| `main` | Default / production source for the ops host |
| short-lived feature branches | Fixes and UI work; delete after merge |

## Related product

Backend and customer SaaS live in **CRM-Optima-SaaS** (separate folder/repo).

- Do **not** recreate a long-lived `saas-platform` branch here.
- Shared API behaviour belongs in the SaaS repo; ops only needs client changes and `VITE_API_BASE_URL`.

## Data

- Production CRM truth is the SaaS database (internal workspace `workspace-optima-internal`).
- Local `db.json` / backups are dev/safety only — do not commit live data.

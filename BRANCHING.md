# Git model — CRM Optimaviz Ops

This is a single-product, standalone full-stack repository.

| Branch | Use |
|---|---|
| `main` | Default production source for the complete frontend and backend |
| short-lived feature branches | Isolated fixes and product work |

Backend API changes, frontend changes, and database-model changes all belong in this repository. There is no separate SaaS-platform branch or backend repository dependency.

`db.json` and `backups/ops/` are the standalone persistence layer. Production deployments must mount persistent storage for these paths and should not commit live customer data.

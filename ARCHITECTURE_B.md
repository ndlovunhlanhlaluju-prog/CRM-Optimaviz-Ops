# Architecture B — Ops UI + shared SaaS backend

Two public URLs, **one multi-tenant backend and one Supabase CRM database**.

| Host | Role |
|------|------|
| `https://crm-optima-saas.onrender.com` | **SaaS platform** (repo **CRM-Optima-SaaS**) — API, auth, Meta/LinkedIn/WhatsApp, DB |
| `https://crm-optima-updated.onrender.com` | **Internal ops UI** (repo **CRM-Optima-Ops**) — frontend only talks to SaaS API |

Internal Optima CRM is **not** a second product. It is the built-in workspace:

- id: `workspace-optima-internal`
- name: LujuNal Internal CRM
- plan: `internal`

Customer signups create additional workspaces. Social connections, WhatsApp numbers, brands, and leads are scoped by `workspace_id`.

## What is shared

- One Meta app, one LinkedIn app, one WhatsApp Embedded Signup config
- One Supabase project + `SUPABASE_TABLE=crm_data` (+ one logical CRM document)
- One set of platform OAuth secrets on the **SaaS** service

## What stays separate

- **Storage buckets** (optional): e.g. `saas-social-media` for customers, `social-media` for internal uploads  
  Object paths already include `{workspace_id}/…`
- Public UI hostnames / branding
- Render services (two web services)

## Render configuration

### SaaS service (CRM-Optima-SaaS)

```env
PUBLIC_CRM_URL=https://crm-optima-saas.onrender.com
APP_PUBLIC_URL=https://crm-optima-saas.onrender.com
CORS_ORIGINS=https://crm-optima-updated.onrender.com
SUPABASE_URL=https://YOUR_SAAS_PROJECT.supabase.co
SUPABASE_TABLE=crm_data
SUPABASE_RECORD_ID=main
SUPABASE_STORAGE_BUCKET=saas-social-media
# Meta / LinkedIn / WhatsApp / Stripe / etc. live HERE only
```

### Ops service (CRM-Optima-Ops)

```env
# Build-time: point the SPA at the SaaS API
VITE_API_BASE_URL=https://crm-optima-saas.onrender.com
PUBLIC_CRM_URL=https://crm-optima-updated.onrender.com

# Ops does NOT need a second Supabase CRM record for day-to-day use.
# Optional local-only fallback DB is ignored when the browser uses VITE_API_BASE_URL.
```

Rebuild the ops service after setting `VITE_API_BASE_URL` (Vite bakes it into the client bundle).

## Auth across hosts

1. Ops UI posts login to `VITE_API_BASE_URL/api/auth/login`
2. SaaS sets `optima_session_id` cookie with `SameSite=None; Secure` when Origin is the ops host
3. Login JSON also returns `session_token` for `Authorization: Bearer …` (fallback if cookies are blocked)
4. Ops stores the bearer token and sends it on every API call

## Meta / LinkedIn (single apps)

Add SaaS callback URLs only (preferred). Ops UI never needs its own Meta app.

```text
https://crm-optima-saas.onrender.com/api/social/.../callback
https://crm-optima-saas.onrender.com/api/integrations/gmail/callback
https://crm-optima-saas.onrender.com/api/auth/oauth/google/callback
```

## Data rule

- Do **not** run two different Supabase projects for “ops vs saas CRM data”.
- Put all operational leads under `workspace_id = workspace-optima-internal` in the SaaS database.
- Import historical ops dumps into that workspace if needed.

## Import ops snapshot into internal workspace

### CLI (recommended once)

From the **CRM-Optima-SaaS** repo root:

```powershell
# Merge local ops dump into db-saas.json and push to SaaS Supabase
node scripts/import-ops-into-internal-workspace.mjs `
  --source db.json `
  --target db-saas.json `
  --env-file "F:\path\to\LujuNal CRM SaaS.env" `
  --push
```

This:

1. Stamps rows with `workspace_id = workspace-optima-internal`
2. Preserves any existing **customer** workspaces already in the target file
3. Writes `db-saas.json` + `backups/saas/`
4. Upserts Supabase `crm_data` / `SUPABASE_RECORD_ID`

### API (platform owner, while SaaS is running)

```http
POST /api/admin/database/import-ops-snapshot
Authorization: Bearer <platform-owner-session>
Content-Type: application/json

{ "snapshot": { /* full ops db.json object */ } }
```

Then optionally:

```http
POST /api/admin/database/sync-supabase
```

### Compare clouds

```powershell
node scripts/compare-cloud-crm.mjs
```

## Local development

```powershell
# Terminal 1 — SaaS API + UI
npm run dev

# Terminal 2 — Ops UI against local SaaS (optional)
git checkout main
# .env: VITE_API_BASE_URL=http://localhost:5000
npm run dev
```

If both cannot share port 5000, run SaaS on 5000 and set ops Vite port differently with `VITE_API_BASE_URL` pointing at SaaS.

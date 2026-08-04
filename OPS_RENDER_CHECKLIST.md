# Ops + SaaS checklist (Architecture B)

**Ops UI is on Vercel now** (not Render). Full steps: see `OPS_VERCEL_CHECKLIST.md`.

## 1. SaaS service (`saas-platform` branch) — stays on Render

| Key | Value |
|-----|--------|
| `PUBLIC_CRM_URL` | `https://crm-optima-saas.onrender.com` |
| `CORS_ORIGINS` | `https://crm-optima-updated.vercel.app` |
| `SUPABASE_URL` | `https://skzvzqdrxnjvaoiziaiw.supabase.co` |
| `SUPABASE_TABLE` | `crm_data` |
| `SUPABASE_RECORD_ID` | `main` |
| `SUPABASE_STORAGE_BUCKET` | `saas-social-media` |
| `PLATFORM_OWNER_EMAILS` | `mthokozisigatsheni89@gmail.com` |
| `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` | *(known recovery password)* |
| Meta / LinkedIn / WhatsApp / Stripe / Resend | present |

Redeploy SaaS after env changes.

## 2. Ops UI (`main` branch) — Vercel only

| Key | Value |
|-----|--------|
| `VITE_API_BASE_URL` | `https://crm-optima-saas.onrender.com` |
| `PUBLIC_CRM_URL` | `https://crm-optima-updated.vercel.app` |

**Must rebuild** after changing `VITE_API_BASE_URL`.

You do **not** need Supabase or a Node server on Vercel for day-to-day ops.
**Suspend/delete** the old ops Render service once Vercel works.

## 3. Data (done once, re-run if needed)

```powershell
node scripts/import-ops-into-internal-workspace.mjs --source db.json --target db-saas.json --env-file "<SaaS env file>" --push
node scripts/compare-cloud-crm.mjs
```

Expect SaaS cloud ≈ 128 leads (or more) under internal workspace.

## 4. Smoke test

1. Ops URL → Network → `/api/auth/login` host is **saas**
2. Login as platform owner / internal admin
3. Brands + leads visible
4. SaaS customer signup still creates a separate workspace

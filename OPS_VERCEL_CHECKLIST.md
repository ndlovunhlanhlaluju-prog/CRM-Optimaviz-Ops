# Operations CRM on Vercel + SaaS API on Render

Ops UI lives only on **Vercel**. Auth, data, and integrations live on **SaaS Render**.  
You can **delete / suspend** the old ops Render service (`crm-optima-updated.onrender.com`).

| Host | Role | Branch |
|------|------|--------|
| `https://crm-optima-updated.vercel.app` | Ops UI only (static) | `main` |
| `https://crm-optima-saas.onrender.com` | API + DB + integrations | `saas-platform` |

---

## 1. Vercel (ops UI) — Environment Variables

Project → Settings → Environment Variables → Production (and Preview if you want).

| Key | Value | Notes |
|-----|--------|--------|
| `VITE_API_BASE_URL` | `https://crm-optima-saas.onrender.com` | **Required.** Baked in at **build** time. |
| `PUBLIC_CRM_URL` | `https://crm-optima-updated.vercel.app` | Optional branding / absolute links |

**Do not put on Vercel (ops):**

- `SUPABASE_*` keys  
- Meta / WhatsApp / Stripe / Gmail secrets  

Those belong on **SaaS Render** only.

After changing `VITE_API_BASE_URL`, trigger a **Redeploy** (clear build cache if login still hits the wrong host).

`vercel.json` also proxies `/api/*` → SaaS as a fallback if the build env is missing.

---

## 2. SaaS Render (`crm-optima-saas`) — Environment Variables

Update / keep these (Dashboard → Environment):

| Key | Value |
|-----|--------|
| `PUBLIC_CRM_URL` | `https://crm-optima-saas.onrender.com` |
| `APP_PUBLIC_URL` | `https://crm-optima-saas.onrender.com` |
| `CORS_ORIGINS` | `https://crm-optima-updated.vercel.app` |
| `SUPABASE_URL` | *(your SaaS Supabase URL)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(service role)* |
| `SUPABASE_ANON_KEY` | *(anon)* |
| `SUPABASE_TABLE` | `crm_data` |
| `SUPABASE_RECORD_ID` | `main` |
| `SUPABASE_STORAGE_BUCKET` | `saas-social-media` |
| `PLATFORM_OWNER_EMAILS` | `superadmin@optimaviz.com` |
| `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` | *(set a known password you will use to log in; default seed is `admin1234!`)* |
| `BOOTSTRAP_PASSWORD_FORCE` | `true` **once**, then remove after first successful login |

Also keep Meta / LinkedIn / WhatsApp / Stripe / Resend / Gmail secrets on **SaaS only**.

### Login recovery (important)

If SaaS returns *Invalid credentials* for the platform superadmin (`superadmin@optimaviz.com`):

1. Set `PLATFORM_OWNER_BOOTSTRAP_PASSWORD` to the password you want (e.g. a strong secret).
2. Optionally set `BOOTSTRAP_PASSWORD_FORCE=true` for one deploy so the stored hash is reset.
3. Redeploy SaaS, log in once as `superadmin@optimaviz.com` with that password.
4. Remove `BOOTSTRAP_PASSWORD_FORCE` (leave bootstrap password only if you want a recovery key).

Legacy personal owner emails (e.g. old Gmail owner accounts) are blocked and no longer elevated.

---

## 3. Remove ops from Render

1. Confirm Vercel ops login works against SaaS.
2. In Render: **suspend or delete** the ops web service (`crm-optima-updated` / main branch).
3. Remove any old ops-only env vars / custom domains pointing at that Render URL.

---

## 4. Smoke test

1. Open `https://crm-optima-updated.vercel.app`
2. DevTools → Network → login request host must be **`crm-optima-saas.onrender.com`** (or same-origin `/api` proxied to SaaS).
3. Sign in as platform superadmin (`superadmin@optimaviz.com`) with the SaaS bootstrap password.
4. Internal brands + leads load from SaaS Supabase (`workspace-optima-internal`).

---

## Quick copy-paste

### Vercel

```env
VITE_API_BASE_URL=https://crm-optima-saas.onrender.com
PUBLIC_CRM_URL=https://crm-optima-updated.vercel.app
```

### SaaS Render (add/change these for Vercel ops)

```env
CORS_ORIGINS=https://crm-optima-updated.vercel.app
PUBLIC_CRM_URL=https://crm-optima-saas.onrender.com
APP_PUBLIC_URL=https://crm-optima-saas.onrender.com
PLATFORM_OWNER_EMAILS=superadmin@optimaviz.com
PLATFORM_OWNER_BOOTSTRAP_PASSWORD=replace-with-your-login-password
# BOOTSTRAP_PASSWORD_FORCE=true
```

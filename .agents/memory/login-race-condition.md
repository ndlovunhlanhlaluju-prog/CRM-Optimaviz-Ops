---
name: Login race condition fix
description: Why login briefly worked then redirected back to the login page, and how to prevent it.
---

## The rule
Any `useEffect` that makes authenticated API calls (routes protected by `requireAuth`) MUST include `if (!user) return;` at the top and `user?.id` in its dependency array.

**Why:** The global 401 interceptor in AppCore.tsx clears user + session token on any `{ code: 'AUTH_REQUIRED' }` response. Effects that fire on initial mount without a user guard race with the login flow: if their 401 response arrives after the user has just logged in, the interceptor wipes the fresh session.

**How to apply:** Before every `useEffect` that calls an authenticated endpoint, add:
```js
if (!user) return;
```
And include `user?.id` in the deps array so the effect re-fires after login. Do NOT use the full `user` object in deps (it changes reference too often).

## Also fixed
`checkCurrentUser`'s catch block was changed from `catch { setUser(null) }` to only call `setUser(null)` when `err?.response?.data?.code === 'AUTH_REQUIRED'`. This prevents network errors from logging out an already-authenticated user.

## Effects fixed (examples)
- `[activeIntegrationChannel, integrationBrandId]` — was calling `fetchLeadSources` on mount
- `[activeTab, selectedBrandForEmail?.id]` — was calling `fetchEmailConnections` on mount

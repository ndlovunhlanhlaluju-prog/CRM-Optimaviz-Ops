import axios from 'axios';

/**
 * Architecture B: the operational CRM UI (main) can call the SaaS backend API.
 * Set VITE_API_BASE_URL=https://crm-optima-saas.onrender.com at build time on Render.
 * When unset, requests stay same-origin (local full-stack dev on main).
 */
const rawBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (rawBase || '').replace(/\/$/, '');

axios.defaults.withCredentials = true;
if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}

export const SESSION_TOKEN_KEY = 'optima_session_token';

export function getStoredSessionToken(): string {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setSessionToken(token: string | null | undefined) {
  const clean = String(token || '').trim();
  try {
    if (clean) localStorage.setItem(SESSION_TOKEN_KEY, clean);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore quota */
  }
  if (clean) {
    axios.defaults.headers.common.Authorization = `Bearer ${clean}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

export function clearSessionToken() {
  setSessionToken('');
}

// Restore bearer token on cold load (cross-origin cookie may be blocked)
const existing = getStoredSessionToken();
if (existing) {
  axios.defaults.headers.common.Authorization = `Bearer ${existing}`;
}

export const api = axios;
export default axios;

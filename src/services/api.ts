import axios from 'axios';

/**
 * The standalone frontend and backend are served by the same process.
 * Keeping API requests relative ensures the browser always uses the bundled backend.
 */
export const API_BASE_URL = '';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = undefined;

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

// Restore the bearer token on cold load as a complement to the session cookie.
const existing = getStoredSessionToken();
if (existing) {
  axios.defaults.headers.common.Authorization = `Bearer ${existing}`;
}

export const api = axios;

export default axios;

/**
 * Convert API/network/JS errors into short messages safe to show end users.
 * Internal details are logged by callers; never shown here.
 */

const INTERNAL_PATTERN =
  /stack|exception|econnrefused|enotfound|etimedout|econnreset|socket hang up|sql|prisma|mongodb|supabase|postgres|sqlite|at\s+\S+\s*\(|request failed with status|network error|cors|internal server|typeerror|referenceerror|syntaxerror|cannot read prop|undefined is not|is not a function|failed to fetch|axioserror|aggregateerror|ENOENT|EACCES|module not found|vite_|webpack|node_modules|\\n\s*at\s|file:\/\/|https?:\/\/127\.|localhost:\d+|VITE_API|vercel API proxy|frontend-only|configure the API/i;

function looksInternal(message: string): boolean {
  const s = String(message || '').trim();
  if (!s) return true;
  if (s.length > 280) return true;
  if (INTERNAL_PATTERN.test(s)) return true;
  // Long JSON / stack-like blobs
  if ((s.match(/\{/g) || []).length > 2 && s.includes('"')) return true;
  if ((s.match(/\n/g) || []).length >= 3) return true;
  return false;
}

function pickCandidate(err: any): string {
  const data = err?.response?.data;
  const candidates = [
    data?.detail,
    data?.error,
    data?.message,
    data?.error_message,
    data?.failure_reason,
  ];
  for (const raw of candidates) {
    if (raw == null) continue;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      const parts = raw.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && (item.msg || item.message)) return String(item.msg || item.message);
        return '';
      }).filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    if (typeof raw === 'object' && (raw.msg || raw.message)) return String(raw.msg || raw.message);
  }
  return '';
}

/** Safe message for toasts / form errors. Always returns a non-empty string. */
export function toUserFacingError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const safeFallback = String(fallback || 'Something went wrong. Please try again.').trim() || 'Something went wrong. Please try again.';
  try {
    const anyErr = err as any;
    const status = Number(anyErr?.response?.status || 0);

    // Auth / rate-limit: short known cases
    if (status === 401) {
      const detail = pickCandidate(anyErr);
      if (detail && !looksInternal(detail)) return detail.slice(0, 200);
      return 'Please sign in again.';
    }
    if (status === 403) {
      const detail = pickCandidate(anyErr);
      if (detail && !looksInternal(detail)) return detail.slice(0, 200);
      return 'You do not have permission to do that.';
    }
    if (status === 404) {
      const detail = pickCandidate(anyErr);
      if (detail && !looksInternal(detail)) return detail.slice(0, 200);
      return 'That item could not be found.';
    }
    if (status === 429) {
      const detail = pickCandidate(anyErr);
      if (detail && !looksInternal(detail)) return detail.slice(0, 200);
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (status >= 500) {
      return safeFallback;
    }

    // Network / offline (no response)
    if (anyErr && !anyErr.response && (anyErr.request || anyErr.code === 'ERR_NETWORK' || anyErr.message === 'Network Error')) {
      return 'Cannot reach the server. Check your connection and try again.';
    }

    const fromApi = pickCandidate(anyErr);
    if (fromApi && !looksInternal(fromApi)) {
      return fromApi.replace(/\s+/g, ' ').trim().slice(0, 220);
    }

    // Never surface raw Error.message (often internal)
    return safeFallback;
  } catch {
    return safeFallback;
  }
}

/** @deprecated alias — prefer toUserFacingError */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  return toUserFacingError(err, fallback);
}

/**
 * errorToAlert — the central "Layer 1" mapper: any thrown value → on-brand Alert
 * content (severity + human title + optional description). This is the one place
 * that turns an error CLASS into a user-facing message, so callers don't each
 * reinvent it. Pair it with <Alert> (inline/banner) or useToast().
 *
 * Grounded in this codebase's REAL error shapes (verified against the clients):
 *  - SchedulingApiError (services/schedulingApi.ts): has a numeric `.status` and a
 *    server-crafted `.message`; codes 401/403/404/409/422/428/429/5xx.
 *  - analyticsApi.ts: throws PLAIN Error with the status baked into the message
 *    tail ("API error: 404", "Failed to update tenant: 500") — no status field.
 *  - Network failure: fetch rejects with a TypeError before any response.
 *
 * It does NOT attach actions — the remedy (reload / reconnect / retry) is
 * context-specific, so the caller supplies `action` on the Alert. This stays a
 * pure function (no DOM side effects), which keeps it testable.
 */
import type { AlertSeverity } from '../components/shared';

export interface AlertContent {
  severity: AlertSeverity;
  title: string;
  description?: string;
}

/** Pull a numeric HTTP status off either a typed error (`.status`) or the message tail. */
function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  // analyticsApi bakes the status into the message: "API error: 404", "…: 500".
  if (error instanceof Error) {
    const m = error.message.match(/:\s*(\d{3})$/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/**
 * Return the message only when it reads like a server-crafted, user-facing string.
 * Drops the generic internal fallbacks ("API error: 500", "Failed to fetch X: 404",
 * "Not authenticated", raw network errors) so we show friendly copy instead.
 */
function serverMessage(error: unknown): string | undefined {
  const m = error instanceof Error ? error.message.trim() : '';
  if (!m) return undefined;
  if (/:\s*\d{3}$/.test(m)) return undefined; // "...: 404" internal fallbacks
  if (/^not authenticated$/i.test(m)) return undefined;
  if (/^(failed to fetch|load failed|networkerror)/i.test(m)) return undefined;
  return m;
}

export function errorToAlert(error: unknown): AlertContent {
  // Transport — fetch rejects with a TypeError before any HTTP response.
  if (error instanceof TypeError) {
    return { severity: 'error', title: "Can't reach the server", description: 'Check your internet connection and try again.' };
  }

  const status = getStatus(error);
  const msg = serverMessage(error);

  // Auth — session gone (401), or a plain "Not authenticated" from the older clients.
  if (status === 401 || (error instanceof Error && /^not authenticated$/i.test(error.message.trim()))) {
    return { severity: 'error', title: 'Your session expired', description: 'Please reload the page and sign in again.' };
  }
  if (status === 403) {
    return { severity: 'error', title: "You don't have access to do that", description: msg };
  }
  if (status === 404) {
    return { severity: 'error', title: 'Not found', description: msg ?? 'That item no longer exists — try refreshing.' };
  }
  // Optimistic-lock / concurrent edit (409 stale-If-Match, 428 missing If-Match) — recoverable by reload.
  if ((status === 409 && /\b(stale|modified|changed|lock|if-match)\b/i.test(msg ?? '')) || status === 428) {
    return { severity: 'warning', title: 'This was changed somewhere else', description: 'Reload to get the latest version, then make your change again.' };
  }
  // Business-rule conflicts (409 duplicate-name / team-in-use / already-terminal, 422 validation, 400) —
  // the server message is crafted + user-facing, so it IS the headline.
  if (status === 409 || status === 422 || status === 428 || status === 400) {
    return { severity: 'error', title: msg ?? "That didn't work" };
  }
  // Rate limit / cooldown — a soft caution, not a failure.
  if (status === 429) {
    return { severity: 'warning', title: 'Just a moment', description: msg ?? "You're doing that a little too quickly — try again shortly." };
  }
  // Server error.
  if (status !== undefined && status >= 500) {
    return { severity: 'error', title: 'Something went wrong on our end', description: 'This is usually temporary — please try again in a moment.' };
  }

  // Fallback — surface a crafted server message if we have one, else friendly generic.
  return msg
    ? { severity: 'error', title: msg }
    : { severity: 'error', title: 'Something went wrong', description: 'Please try again, or contact support if it keeps happening.' };
}

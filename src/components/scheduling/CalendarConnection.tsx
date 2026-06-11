/**
 * CalendarConnection — Track 2 Surface 1 (ui_plan §3 "Surface 1 — Calendar Connection").
 *
 * Displays the signed-in staff member's calendar connection state (connected / disconnected /
 * stale_connected) and provides a Connect / Reconnect button that initiates the OAuth flow.
 *
 * FLOW:
 *   1. On mount: call GET /scheduling/connection/init (Clerk-authed, via ADA).
 *      On success, immediately call GET <status_url> (plain fetch, init token = auth) to render
 *      current state. Store status_url + connect_url for reuse during the session.
 *   2. Connect / Reconnect button: navigate the browser to connect_url (full-page navigation,
 *      NOT fetch — the OAuth flow 302s to Google consent; a fetch would be blocked by CORS).
 *   3. On return from OAuth: read ?calendar=connected&watch=ok|pending query params from the
 *      current URL, show a success banner, then re-init + re-fetch status to confirm.
 *   4. Fallback: if init fails (e.g. 401, 500) show an inline error with a Retry button.
 *
 * OUT OF SCOPE (v1): Disconnect (no backend route), secondary calendars, timezone editing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initCalendarConnection,
  fetchCalendarConnectionStatus,
  SchedulingApiError,
  type CalendarConnectionInitResponse,
  type CalendarConnectionStatusResponse,
} from '../../services/schedulingApi';

// ─── helpers ────────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 401) return 'Session expired — please reload the page.';
    if (e.status === 403) return 'Calendar connection is not enabled for this account.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Read ?calendar= and ?watch= from a URL search string. */
function parseOAuthReturn(search: string): { isReturn: boolean; watchOk: boolean } {
  const params = new URLSearchParams(search);
  const calendar = params.get('calendar');
  const watch = params.get('watch');
  return {
    isReturn: calendar === 'connected',
    watchOk: watch === 'ok',
  };
}

/** Human-readable label for a connection status. */
function statusLabel(status: CalendarConnectionStatusResponse['status']): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Not connected';
    case 'stale_connected':
      return 'Connection unverified';
  }
}

// ─── component ──────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'error' | 'ready';

interface State {
  load: LoadState;
  loadError: string | null;
  /** Cached init response (connect_url + status_url) for the session. */
  init: CalendarConnectionInitResponse | null;
  status: CalendarConnectionStatusResponse | null;
  /** True when connecting is in progress (button clicked, navigating away). */
  connecting: boolean;
  /** Set after a successful OAuth return — cleared on next status refresh. */
  oauthBanner: { watchOk: boolean } | null;
}

const INITIAL: State = {
  load: 'loading',
  loadError: null,
  init: null,
  status: null,
  connecting: false,
  oauthBanner: null,
};

export function CalendarConnection() {
  const [state, setState] = useState<State>(INITIAL);
  const mountedRef = useRef(true);

  // Detect an OAuth return from the query string (once, on mount).
  const oauthReturn = parseOAuthReturn(window.location.search);

  const initAndFetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setState((s) => ({ ...s, load: 'loading', loadError: null }));
    try {
      const initResp = await initCalendarConnection();
      if (!mountedRef.current) return;

      let statusResp: CalendarConnectionStatusResponse | null = null;
      try {
        statusResp = await fetchCalendarConnectionStatus(initResp.status_url);
      } catch {
        // Non-fatal: status fetch failed but we still have the connect_url.
        // Treat as disconnected so the Connect button is available.
        statusResp = { status: 'disconnected', bookable: false };
      }
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        load: 'ready',
        init: initResp,
        status: statusResp,
        // Preserve any OAuth banner set before the re-fetch.
      }));
    } catch (e) {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, load: 'error', loadError: errMessage(e) }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // If we're returning from an OAuth flow, set the banner before fetching status.
    if (oauthReturn.isReturn) {
      setState((s) => ({ ...s, oauthBanner: { watchOk: oauthReturn.watchOk } }));
      // Remove the query params from the URL without a page reload.
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar');
      url.searchParams.delete('watch');
      window.history.replaceState({}, '', url.toString());
    }
    initAndFetch();
    return () => {
      mountedRef.current = false;
    };
  }, [initAndFetch, oauthReturn.isReturn, oauthReturn.watchOk]);

  function handleConnect() {
    if (!state.init?.connect_url) return;
    setState((s) => ({ ...s, connecting: true }));
    // Full-page navigation — the OAuth server 302s to Google consent.
    window.location.href = state.init.connect_url;
  }

  // ─── render states ────────────────────────────────────────────────────────

  if (state.load === 'loading') {
    return (
      <div
        className="flex items-center gap-2 py-6"
        role="status"
        aria-live="polite"
        aria-label="Loading calendar connection status"
      >
        <div className="w-5 h-5 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" aria-hidden="true" />
        <span className="text-sm text-slate-500">Loading calendar connection…</span>
      </div>
    );
  }

  if (state.load === 'error') {
    return (
      <div className="flex flex-col gap-3" role="alert">
        <p className="text-sm text-red-600">
          {state.loadError ?? 'Could not load calendar connection status.'}
        </p>
        <button
          onClick={initAndFetch}
          className="self-start px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const { status, init, connecting, oauthBanner } = state;
  const isConnected = status?.status === 'connected';
  const isStale = status?.status === 'stale_connected';

  return (
    <section aria-label="Calendar connection" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Calendar</h3>
        <p className="text-xs text-slate-500">
          Connect your Google Calendar to become bookable. Picasso writes confirmed appointments to your primary calendar.
        </p>
      </div>

      {/* OAuth return success banner */}
      {oauthBanner && (
        <div
          className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
          role="status"
          aria-live="polite"
          data-testid="oauth-success-banner"
        >
          {oauthBanner.watchOk
            ? 'Calendar connected. You are now bookable.'
            : 'Calendar connected. Watch channel is being set up — this may take a moment.'}
        </div>
      )}

      {/* Status card */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
        {/* Status row */}
        <div className="flex items-center gap-2" aria-live="polite">
          {/* Status dot */}
          <span
            aria-hidden="true"
            className={[
              'inline-block w-2.5 h-2.5 rounded-full shrink-0',
              isConnected ? 'bg-green-500' : isStale ? 'bg-amber-400' : 'bg-slate-300',
            ].join(' ')}
          />
          <span className="text-sm font-medium text-slate-800">
            {status ? statusLabel(status.status) : 'Unknown'}
          </span>
          {status?.status === 'disconnected' && status.reason === 'revoked' && (
            <span className="text-xs text-amber-600">(access was revoked — please reconnect)</span>
          )}
          {isStale && (
            <span className="text-xs text-amber-600">(could not verify — connect again if bookings fail)</span>
          )}
        </div>

        {/* Connected detail */}
        {isConnected && status?.calendar_id && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">Calendar:</span>{' '}
              <span data-testid="calendar-id">{status.calendar_id}</span>
            </p>
            <p className="text-xs text-slate-400">Provider: Google</p>
          </div>
        )}

        {/* Connect / Reconnect button */}
        <button
          onClick={handleConnect}
          disabled={connecting || !init?.connect_url}
          aria-label={isConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          className={[
            'self-start px-4 py-2 text-sm font-medium rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
            'disabled:opacity-50',
            isConnected
              ? 'text-slate-600 border border-slate-200 hover:bg-slate-50'
              : 'text-white bg-primary-600 hover:bg-primary-700',
          ].join(' ')}
        >
          {connecting ? 'Redirecting to Google…' : isConnected ? 'Reconnect' : 'Connect Google Calendar'}
        </button>

        {/* Scope info (connected) */}
        {isConnected && status?.scopes && status.scopes.length > 0 && (
          <p className="text-[11px] text-slate-400">
            Authorized scopes: {status.scopes.join(', ')}
          </p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Only your primary calendar is used. Picasso never reads email, contacts, or other calendar data.
      </p>
    </section>
  );
}

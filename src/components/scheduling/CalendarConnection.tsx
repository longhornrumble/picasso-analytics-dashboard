/**
 * CalendarConnection — Track 2 Surface 1 (ui_plan §3 "Surface 1 — Calendar Connection").
 *
 * Displays the signed-in staff member's calendar connection state (connected / disconnected /
 * stale_connected) and provides a Connect / Reconnect button that initiates the OAuth flow,
 * and a Disconnect button for connected/stale_connected state (§E11b, WS-T3-DISC-FE).
 *
 * FLOW:
 *   1. On mount: call GET /scheduling/connection/init (Clerk-authed, via ADA) to obtain
 *      `status_url` for the status display.  The init response is stored only for that
 *      purpose — the connect_url from it is intentionally NOT cached for the Connect button
 *      (see item 1 below).
 *   2. Connect / Reconnect button: mints a FRESH init token at click time (TTL 300 s; the
 *      cached token from mount may have already expired while the user reads the page), then
 *      calls `window.location.replace(freshUrl)` — replace, not href, so the token-bearing
 *      URL never enters back-button history. The "Connecting…" label is shown during the mint.
 *   3. On return from OAuth: reads ?calendar=connected&watch=ok|pending from the current URL
 *      (parsed once at module load, before any state is set), strips them via replaceState
 *      FIRST, then shows a success banner and re-inits + re-fetches status to confirm.
 *   4. Fallback: if init fails (e.g. 401, 500) shows an inline error with a Retry button.
 *   5. Disconnect button (§E11b): visible when status ∈ {connected, stale_connected}. Native
 *      window.confirm dialog warns that bookings stop routing + existing events NOT deleted.
 *      On confirm → POST /scheduling/connection/disconnect; success → status flips to
 *      disconnected + disconnect success banner; failure → inline error + retry.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  initCalendarConnection,
  fetchCalendarConnectionStatus,
  disconnectCalendarConnection,
  fetchSchedulingActivation,
  setSchedulingActivation,
  SchedulingApiError,
  type CalendarConnectionInitResponse,
  type CalendarConnectionStatusResponse,
} from '../../services/schedulingApi';

// ─── helpers ────────────────────────────────────────────────────────────────

function errMessage(
  e: unknown,
  fallback = 'Couldn’t load the calendar connection. Please try again or contact support.',
): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 401) return 'Session expired — please reload the page.';
    if (e.status === 403) return 'Calendar connection is not enabled for this account.';
    return e.message;
  }
  // Non-API errors (origin-validation failures, network TypeErrors) carry
  // internals like raw URLs that don’t belong in the UI — the catch sites
  // console.error the original; users get friendly copy + Retry.
  return fallback;
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

// ─── component ──────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'error' | 'ready';

interface State {
  load: LoadState;
  loadError: string | null;
  /** Cached init response — used only for `status_url` (not `connect_url`). */
  init: CalendarConnectionInitResponse | null;
  status: CalendarConnectionStatusResponse | null;
  /** True when minting a fresh init token + navigating away. */
  connecting: boolean;
  /** True while the disconnect POST is in-flight. */
  disconnecting: boolean;
  /** True after a successful disconnect. */
  disconnectBanner: boolean;
  /** Non-null after a disconnect failure — inline error for retry. */
  disconnectError: string | null;
  /** Set after a successful OAuth return; cleared when the user clicks Retry. */
  oauthBanner: { watchOk: boolean } | null;
}

const INITIAL: State = {
  load: 'loading',
  loadError: null,
  init: null,
  status: null,
  connecting: false,
  disconnecting: false,
  disconnectBanner: false,
  disconnectError: null,
  oauthBanner: null,
};

export function CalendarConnection() {
  const { user, refreshFeatures } = useAuth();
  const [state, setState] = useState<State>(INITIAL);
  // Org-level scheduling activation gate. null = still loading. Until scheduling is
  // enabled for the org, calendar connection is unavailable: admins (can_manage) get an
  // Enable action, everyone else gets a locked message. (The backend enforces this too —
  // Calendar_OAuth_Connect 403s when scheduling_enabled is off.)
  const [activation, setActivation] = useState<{ enabled: boolean; canManage: boolean } | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  // Parse the OAuth return params once — using a ref so the value is stable across
  // renders and StrictMode double-invocations.  We read window.location.search at
  // component creation time (inside useState's lazy initializer would also work,
  // but useRef is cleaner and doesn't require a separate state update).
  const oauthReturnRef = useRef<{ isReturn: boolean; watchOk: boolean } | null>(null);
  if (oauthReturnRef.current === null) {
    oauthReturnRef.current = parseOAuthReturn(window.location.search);
  }
  const oauthReturn = oauthReturnRef.current;

  /**
   * initAndFetch: mint a fresh init token + fetch current status.
   * The per-invocation `ignore` flag (closure boolean set in cleanup) prevents
   * stale async results from landing after unmount or a concurrent re-invocation.
   * We do NOT use a shared mountedRef — that is reset to true at the TOP of the
   * effect which means a StrictMode double-fire would flip it back to true before
   * the first async task resolves, making the guard useless.
   */
  const initAndFetch = useCallback(async (ignore: { current: boolean }) => {
    setState((s) => ({ ...s, load: 'loading', loadError: null }));
    try {
      const initResp = await initCalendarConnection();
      if (ignore.current) return;

      let statusResp: CalendarConnectionStatusResponse | null = null;
      try {
        statusResp = await fetchCalendarConnectionStatus(initResp.status_url);
      } catch {
        // Non-fatal: status fetch failed but we still have the connect_url.
        // Treat as disconnected so the Connect button is available.
        statusResp = { status: 'disconnected', bookable: false };
      }
      if (ignore.current) return;
      setState((s) => ({
        ...s,
        load: 'ready',
        init: initResp,
        status: statusResp,
        // Preserve any OAuth banner set before the re-fetch.
      }));
    } catch (e) {
      if (ignore.current) return;
      console.error('Calendar connection init failed:', e);
      setState((s) => ({ ...s, load: 'error', loadError: errMessage(e) }));
    }
  }, []);

  // Stable ref so Retry can call the latest version without re-running the effect.
  const initAndFetchRef = useRef(initAndFetch);
  initAndFetchRef.current = initAndFetch;

  // Guard: ensures the OAuth-param stripping + banner-set runs exactly once,
  // even when StrictMode fires the effect twice (mount → unmount → mount).
  const oauthHandledRef = useRef(false);

  // Fetch the org activation state once on mount.
  // Backward-compat: an API that predates the activation endpoint (e.g. the prod
  // API before lambda#347) 404s here. Rather than fail-closed to a locked state —
  // which would regress a scheduling-entitled tenant's working calendar surface —
  // fall back to the existing dashboard_scheduling entitlement and suppress the
  // management UI (canManage:false), so old backends behave exactly as before:
  // entitled → connect flow, un-entitled → locked. Once the endpoint exists, its
  // can_manage drives the admin enable/disable affordances.
  useEffect(() => {
    let ignore = false;
    fetchSchedulingActivation()
      .then((a) => { if (!ignore) setActivation({ enabled: a.enabled, canManage: a.can_manage }); })
      .catch(() => {
        if (!ignore) {
          setActivation({ enabled: user?.features?.dashboard_scheduling === true, canManage: false });
        }
      });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only touch the calendar-connect API once scheduling is activated for the org —
    // otherwise initCalendarConnection 403s and we'd render a confusing error instead
    // of the locked/enable gate.
    if (activation?.enabled !== true) return;

    // Strip OAuth return params FIRST (before the async fetch), once per mount
    // sequence.  The ref guard prevents StrictMode's second invocation from
    // calling replaceState twice or setting the banner twice.
    if (oauthReturn.isReturn && !oauthHandledRef.current) {
      oauthHandledRef.current = true;
      setState((s) => ({ ...s, oauthBanner: { watchOk: oauthReturn.watchOk } }));
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar');
      url.searchParams.delete('watch');
      window.history.replaceState({}, '', url.toString());
    }

    // Per-invocation ignore flag — guards the async path against StrictMode
    // double-fire and normal unmount races.
    const ignore = { current: false };
    initAndFetchRef.current(ignore);
    return () => {
      ignore.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation?.enabled]); // runs when activation flips to enabled; oauthReturn stable via ref

  /** Admin: enable scheduling for the org, then let the connect flow load. */
  async function handleEnable() {
    setEnabling(true);
    setEnableError(null);
    try {
      const res = await setSchedulingActivation(true);
      setEnabling(false);
      setActivation((a) => ({ enabled: res.enabled, canManage: a?.canManage ?? true }));
      // Sync the cached entitlement so the Scheduling tab (Settings sub-tab + top-nav)
      // appears/disappears with the live activation state instead of going stale.
      void refreshFeatures();
    } catch (e) {
      console.error('Enable scheduling failed:', e);
      setEnabling(false);
      setEnableError(errMessage(e, 'Could not enable scheduling. Please try again.'));
    }
  }

  /** Admin: turn scheduling off for the whole org (confirmed — it's a big switch). */
  async function handleDisableOrg() {
    const ok = window.confirm(
      'Turn off scheduling for your entire organization?\n\n' +
      'New bookings will stop and the assistant will no longer offer scheduling. ' +
      'Connected calendars stay connected — you can turn it back on anytime.',
    );
    if (!ok) return;
    setEnabling(true);
    setEnableError(null);
    try {
      await setSchedulingActivation(false);
      setEnabling(false);
      setActivation((a) => ({ enabled: false, canManage: a?.canManage ?? true }));
      void refreshFeatures();
    } catch (e) {
      console.error('Disable scheduling failed:', e);
      setEnabling(false);
      setEnableError(errMessage(e, 'Could not disable scheduling. Please try again.'));
    }
  }

  /** Retry: re-run initAndFetch with a fresh ignore ref; also clear the oauthBanner. */
  function handleRetry() {
    // Clear oauthBanner on retry so a stale banner from a failed OAuth return
    // doesn't persist after the user manually retries.
    setState((s) => ({ ...s, oauthBanner: null }));
    const ignore = { current: false };
    initAndFetch(ignore);
  }

  /**
   * Connect / Reconnect: mints a FRESH init token at click time.
   * The mount-time token (TTL 300 s) may have expired while the user read the page;
   * using a stale connect_url would send the user to an already-expired OAuth entry
   * point. Minting fresh here closes that window.
   * Uses `window.location.replace` (not `.href = ...`) so the token-bearing URL is
   * NOT pushed into browser history.
   */
  async function handleConnect() {
    setState((s) => ({ ...s, connecting: true }));
    try {
      const freshInit = await initCalendarConnection();
      window.location.replace(freshInit.connect_url);
    } catch (e) {
      // Mint failed (e.g. network error, 401): surface it as a load error so the
      // user can see what went wrong and retry.
      console.error('Calendar connect failed:', e);
      setState((s) => ({ ...s, connecting: false, load: 'error', loadError: errMessage(e) }));
    }
  }

  /**
   * Disconnect: native confirm → POST /scheduling/connection/disconnect.
   * On success: flip status to disconnected + show disconnect success banner.
   * On cancel-at-confirm or failure: show inline error; allow retry.
   * Copy per §E11b: "bookings stop routing to this calendar" + "existing events are NOT deleted".
   */
  async function handleDisconnect() {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your Google Calendar?\n\n' +
      'Bookings will stop routing to this calendar. Existing calendar events will NOT be deleted.',
    );
    if (!confirmed) return;

    setState((s) => ({ ...s, disconnecting: true, disconnectError: null }));
    try {
      await disconnectCalendarConnection();
      setState((s) => ({
        ...s,
        disconnecting: false,
        disconnectBanner: true,
        oauthBanner: null,
        status: { status: 'disconnected', bookable: false },
      }));
    } catch (e) {
      console.error('Calendar disconnect failed:', e);
      setState((s) => ({
        ...s,
        disconnecting: false,
        disconnectError: errMessage(
          e,
          'Could not disconnect the calendar. Please try again or contact support.',
        ),
      }));
    }
  }

  // ─── render states ────────────────────────────────────────────────────────

  // Org activation gate — evaluated before the calendar-connect flow.
  if (activation === null) {
    return (
      <div className="flex items-center gap-2 py-6" role="status" aria-live="polite" aria-label="Loading scheduling status">
        <div className="w-5 h-5 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" aria-hidden="true" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    );
  }

  if (!activation.enabled) {
    return (
      <section aria-label="Calendar connection" className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Calendar</h3>
          <p className="text-xs text-slate-500">
            Connect your Google Calendar to become bookable. Picasso writes confirmed appointments to your primary calendar.
          </p>
        </div>

        {activation.canManage ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50 p-4 flex flex-col gap-2" data-testid="enable-scheduling-panel">
            <p className="text-sm font-semibold text-primary-800">Enable scheduling for your organization</p>
            <p className="text-xs text-slate-600">
              Turn this on to let your team connect their calendars and start taking bookings. You’ll connect your own calendar next.
            </p>
            <div>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50"
              >
                {enabling ? 'Enabling…' : 'Enable scheduling'}
              </button>
            </div>
            {enableError && <p className="text-sm text-red-600" role="alert">{enableError}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="status" data-testid="scheduling-locked">
            <p className="text-sm text-amber-800">
              Your admin needs to enable scheduling for your organization before you can connect your calendar.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Only your primary calendar is used. Picasso never reads email, contacts, or other calendar data.
        </p>
      </section>
    );
  }

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
          onClick={handleRetry}
          className="self-start px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const { status, connecting, disconnecting, disconnectBanner, disconnectError, oauthBanner } = state;
  const isConnected = status?.status === 'connected';
  const isStale = status?.status === 'stale_connected';
  const showDisconnect = isConnected || isStale;

  // Scopes: filter to strings and join (item 8 — guard against non-string entries).
  const scopesStr = (status?.scopes ?? [])
    .filter((s): s is string => typeof s === 'string')
    .join(', ');

  return (
    <section aria-label="Calendar connection" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Calendar</h3>
        <p className="text-xs text-slate-500">
          Connect your Google Calendar to become bookable. Picasso writes confirmed appointments to your primary calendar.
        </p>
      </div>

      {/* OAuth return success banner — persists until the user navigates away */}
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

      {/* Disconnect success banner */}
      {disconnectBanner && (
        <div
          className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700"
          role="status"
          aria-live="polite"
          data-testid="disconnect-success-banner"
        >
          Calendar disconnected. Bookings will no longer route to this calendar.
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

        {/* Connected detail — only rendered when calendar_id is present */}
        {isConnected && status?.calendar_id && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">Calendar:</span>{' '}
              <span data-testid="calendar-id">{status.calendar_id}</span>
            </p>
            <p className="text-xs text-slate-400">Provider: Google</p>
          </div>
        )}

        {/* Connect / Reconnect button — stale_connected shows "Connect" (not "Reconnect") */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleConnect}
            disabled={connecting || disconnecting}
            aria-label={isConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            className={[
              'px-4 py-2 text-sm font-medium rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              'disabled:opacity-50',
              isConnected
                ? 'text-slate-600 border border-slate-200 hover:bg-slate-50'
                : 'text-white bg-primary-600 hover:bg-primary-700',
            ].join(' ')}
          >
            {connecting ? 'Connecting…' : isConnected ? 'Reconnect' : 'Connect Google Calendar'}
          </button>

          {/* Disconnect button — only visible when connected or stale_connected */}
          {showDisconnect && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting || connecting}
              aria-label="Disconnect Google Calendar"
              className={[
                'px-4 py-2 text-sm font-medium rounded-lg',
                'text-red-600 border border-red-200 hover:bg-red-50',
                'focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1',
                'disabled:opacity-50',
              ].join(' ')}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          )}
        </div>

        {/* Disconnect inline error */}
        {disconnectError && (
          <p
            className="text-sm text-red-600"
            role="alert"
            data-testid="disconnect-error"
          >
            {disconnectError}
          </p>
        )}

        {/* Scope info (connected + scopes present) */}
        {isConnected && scopesStr && (
          <p className="text-[11px] text-slate-400">
            Authorized scopes: {scopesStr}
          </p>
        )}
      </div>

      {/* Admin org-level control: scheduling is on; allow turning it back off.
          Only when manageable (real activation endpoint) — suppressed on the
          backward-compat fallback so old backends never show a control that 404s. */}
      {activation.canManage && (
        <p className="text-xs text-slate-500" data-testid="org-scheduling-on">
          Scheduling is on for your organization ·{' '}
          <button
            onClick={handleDisableOrg}
            disabled={enabling}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {enabling ? 'Working…' : 'Disable'}
          </button>
        </p>
      )}
      {enableError && <p className="text-sm text-red-600" role="alert">{enableError}</p>}

      <p className="text-xs text-slate-400">
        Only your primary calendar is used. Picasso never reads email, contacts, or other calendar data.
      </p>
    </section>
  );
}

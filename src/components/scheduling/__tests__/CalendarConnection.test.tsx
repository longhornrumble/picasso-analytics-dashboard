/**
 * CalendarConnection.test.tsx — Track 2 Surface 1 unit tests.
 *
 * Covers:
 *   - Loading state (spinner rendered)
 *   - Connected status: renders status, calendar_id, Reconnect button
 *   - Disconnected status: renders "Not connected", Connect button
 *   - Stale_connected status: renders warning label + Connect (not Reconnect) button
 *   - Revoked disconnected: renders revoked note
 *   - Connect button click: mints FRESH init + navigates via replace (full-page, not fetch)
 *   - Reconnect button also navigates
 *   - Error state: init throws → renders error + Retry button
 *   - Retry button: clears oauthBanner + re-triggers the fetch
 *   - Status fetch error: non-fatal → treats as disconnected
 *   - 401 → "Session expired…" message
 *   - 403 → "not enabled" message
 *   - OAuth return (?calendar=connected&watch=ok): renders banner + strips params
 *   - OAuth return (?calendar=connected&watch=pending): renders "being set up" banner
 *   - OAuth banner: survives after the status fetch (status content also rendered)
 *   - replaceState strips the correct params (not just called)
 *   - statusUrl is passed to fetchCalendarConnectionStatus
 *   - Connected with null calendar_id: detail block not rendered
 *   - Connected + scopes: scopes line renders
 *   - CTA wiring: StaffSchedulingSection needsCalendar warning
 *     - member self-view: link present with href containing settings_tab=calendar
 *     - admin roster: link absent (warning text only)
 */
import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingApiError } from '../../../services/schedulingApi';

// ── schedulingApi mock ───────────────────────────────────────────────────────
const api = {
  initCalendarConnection: vi.fn(),
  fetchCalendarConnectionStatus: vi.fn(),
  fetchTagVocabulary: vi.fn(),
  updateEmployeeScheduling: vi.fn(),
};

vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual,
    initCalendarConnection: () => api.initCalendarConnection(),
    fetchCalendarConnectionStatus: (url: string) => api.fetchCalendarConnectionStatus(url),
    fetchTagVocabulary: () => api.fetchTagVocabulary(),
    updateEmployeeScheduling: (...a: unknown[]) => api.updateEmployeeScheduling(...a),
  };
});

vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { email: 'jordan@example.com', role: 'member', features: { dashboard_scheduling: true } } }),
}));

const mockFetchTeamMembers = vi.fn();
vi.mock('../../../services/analyticsApi', () => ({
  fetchTeamMembers: () => mockFetchTeamMembers(),
  getTenantOverride: () => null,
}));

// ── window.location stub (define once; tests mutate searchStr) ───────────────
// jsdom makes window.location non-configurable after first access in some versions.
// We replace the whole object with a plain writable stub instead.
let searchStr = '';
let navigatedViaReplace: string | undefined;
let navigatedViaHref: string | undefined;

beforeEach(() => {
  searchStr = '';
  navigatedViaReplace = undefined;
  navigatedViaHref = undefined;
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

  const stub = {
    pathname: '/',
    hash: '',
    href: 'http://localhost/',
    search: searchStr,
    assign: vi.fn(),
    replace: vi.fn((val: string) => { navigatedViaReplace = val; }),
  };
  Object.defineProperty(stub, 'href', {
    get: () => `http://localhost/${searchStr}`,
    set: (val: string) => { navigatedViaHref = val; },
    configurable: true,
  });
  Object.defineProperty(stub, 'search', {
    get: () => searchStr,
    configurable: true,
  });
  vi.stubGlobal('location', stub);
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.clearAllMocks();
});

// CalendarConnection reads _oauthReturn from module-level; re-import each test
// so the module re-evaluates with the current searchStr. Each describe block
// imports the component after setting searchStr.
import { CalendarConnection } from '../CalendarConnection';
import { StaffSchedulingSection } from '../StaffSchedulingSection';

// ── fixtures ─────────────────────────────────────────────────────────────────
const INIT_RESP = {
  expires_in: 300,
  connect_url: 'https://staging.schedule.myrecruiter.ai/connect?init=tok123',
  status_url: 'https://staging.schedule.myrecruiter.ai/connection/status?init=tok123',
};
const INIT_RESP_2 = {
  expires_in: 300,
  connect_url: 'https://staging.schedule.myrecruiter.ai/connect?init=tok456',
  status_url: 'https://staging.schedule.myrecruiter.ai/connection/status?init=tok456',
};
const CONNECTED_STATUS = {
  status: 'connected' as const,
  calendar_id: 'staff@example.com',
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
};
const CONNECTED_NO_CAL_ID = {
  status: 'connected' as const,
  calendar_id: null,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
};
const DISCONNECTED_STATUS = { status: 'disconnected' as const, bookable: false };
const STALE_STATUS = { status: 'stale_connected' as const };
const REVOKED_STATUS = { status: 'disconnected' as const, bookable: false, reason: 'revoked' };

// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarConnection (Track 2 Surface 1)', () => {
  it('shows a loading spinner during init', () => {
    api.initCalendarConnection.mockReturnValue(new Promise(() => {}));
    render(<CalendarConnection />);
    expect(screen.getByRole('status', { name: /loading calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/loading calendar connection/i)).toBeInTheDocument();
  });

  it('renders connected status with calendar_id and Reconnect button', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByTestId('calendar-id')).toHaveTextContent('staff@example.com');
    expect(screen.getByRole('button', { name: /reconnect google calendar/i })).toBeInTheDocument();
  });

  it('renders disconnected status with Connect button', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
  });

  it('renders stale_connected with a verification warning', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(STALE_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Connection unverified')).toBeInTheDocument());
    expect(screen.getByText(/could not verify/i)).toBeInTheDocument();
  });

  // item 10c: stale_connected shows Connect (not Reconnect)
  it('stale_connected shows Connect button (not Reconnect)', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(STALE_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Connection unverified')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reconnect google calendar/i })).toBeNull();
  });

  it('shows revocation note when status is disconnected + reason:revoked', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(REVOKED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument());
    expect(screen.getByText(/access was revoked/i)).toBeInTheDocument();
  });

  // item 1: Connect button mints a FRESH init token and uses window.location.replace
  it('Connect button mints a fresh init token and navigates via replace (not href)', async () => {
    api.initCalendarConnection
      .mockResolvedValueOnce(INIT_RESP)   // mount-time init
      .mockResolvedValueOnce(INIT_RESP_2); // fresh mint on click
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /connect google calendar/i }));
    await user.click(screen.getByRole('button', { name: /connect google calendar/i }));
    await waitFor(() => expect(navigatedViaReplace).toBeDefined());
    // Must use the FRESH token URL (INIT_RESP_2), not the stale mount-time one (INIT_RESP)
    expect(navigatedViaReplace).toBe(INIT_RESP_2.connect_url);
    // Must NOT use href= (that would push to history)
    expect(navigatedViaHref).toBeUndefined();
    // initCalendarConnection should have been called twice (mount + click)
    expect(api.initCalendarConnection).toHaveBeenCalledTimes(2);
  });

  it('Reconnect button also mints fresh and navigates via replace', async () => {
    api.initCalendarConnection
      .mockResolvedValueOnce(INIT_RESP)
      .mockResolvedValueOnce(INIT_RESP_2);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /reconnect google calendar/i }));
    await user.click(screen.getByRole('button', { name: /reconnect google calendar/i }));
    await waitFor(() => expect(navigatedViaReplace).toBeDefined());
    expect(navigatedViaReplace).toBe(INIT_RESP_2.connect_url);
    expect(navigatedViaHref).toBeUndefined();
  });

  it('shows an error state + Retry button when init rejects', async () => {
    api.initCalendarConnection.mockRejectedValue(
      new SchedulingApiError(500, 'Internal server error'),
    );
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Retry button re-triggers initAndFetch and renders the ready state', async () => {
    api.initCalendarConnection
      .mockRejectedValueOnce(new SchedulingApiError(500, 'Internal server error'))
      .mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument());
  });

  it('treats a status-fetch error as disconnected (non-fatal — Connect button still shown)', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockRejectedValue(new Error('network error'));
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /connect google calendar/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // item 10b: 401 → "Session expired…"
  it('shows "Session expired" message on 401 init error', async () => {
    api.initCalendarConnection.mockRejectedValue(
      new SchedulingApiError(401, 'Unauthorized'),
    );
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  // item 10b: 403 → "not enabled"
  it('shows "not enabled" message on 403 init error', async () => {
    api.initCalendarConnection.mockRejectedValue(
      new SchedulingApiError(403, 'Forbidden'),
    );
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/not enabled for this account/i)).toBeInTheDocument();
  });

  // item 10e: OAuth-return banner test asserts status content ALSO rendered
  it('shows OAuth success banner (watch=ok), strips params, and status content is rendered', async () => {
    searchStr = '?calendar=connected&watch=ok';
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    // Both the banner AND the connected status (from the status fetch) should be present
    await waitFor(() => screen.getByTestId('oauth-success-banner'));
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByTestId('oauth-success-banner')).toHaveTextContent(
      'Calendar connected. You are now bookable.',
    );
    // item 10a: replaceState called with the params actually stripped
    expect(window.history.replaceState).toHaveBeenCalled();
    const replaceArgs = (window.history.replaceState as ReturnType<typeof vi.fn>).mock.calls[0];
    const strippedUrl: string = replaceArgs[2];
    expect(strippedUrl).not.toContain('calendar=');
    expect(strippedUrl).not.toContain('watch=');
  });

  it('shows OAuth success banner with watch=pending ("being set up")', async () => {
    searchStr = '?calendar=connected&watch=pending';
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => screen.getByTestId('oauth-success-banner'));
    expect(screen.getByTestId('oauth-success-banner')).toHaveTextContent('Watch channel is being set up');
  });

  // item 9: Retry clears the oauthBanner
  it('Retry clears the oauth banner', async () => {
    searchStr = '?calendar=connected&watch=ok';
    api.initCalendarConnection
      .mockRejectedValueOnce(new SchedulingApiError(500, 'error'))
      .mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    expect(screen.queryByTestId('oauth-success-banner')).toBeNull();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.queryByTestId('oauth-success-banner')).toBeNull();
  });

  it('passes the exact status_url from init to fetchCalendarConnectionStatus', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => screen.getByText('Not connected'));
    expect(api.fetchCalendarConnectionStatus).toHaveBeenCalledWith(INIT_RESP.status_url);
  });

  // item 10g (cheap add): connected with null calendar_id skips the detail block
  it('connected with null calendar_id: detail block not rendered', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_NO_CAL_ID);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.queryByTestId('calendar-id')).toBeNull();
  });

  // item 10g (cheap add): scopes line renders when present
  it('scopes line renders when connected with scopes', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByText(/authorized scopes/i)).toBeInTheDocument();
    expect(screen.getByText(/calendar\.events/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CTA wiring: StaffSchedulingSection E13 "Connect calendar" warning
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_ON_TEAM_NO_CAL = {
  employee_id: 'e1',
  email: 'jordan@example.com',
  name: 'Jordan',
  role: 'member' as const,
  scheduling_tags: ['volunteer_coordinators'],
  bookable_override: null,
  calendar_email_override: null,
  calendar_connected: false,
  membership_id: null,
  user_id: null,
  type: 'clerk_user' as const,
  status: 'active' as const,
  joined_at: '2026-01-01',
};

// item 7: member self-view keeps the CTA link
// The top-level vi.mock for useAuth returns jordan@example.com/member, which
// matches MEMBER_ON_TEAM_NO_CAL — so the self-view path renders.
describe('E13 CTA wiring — needsCalendar warning (member self-view)', () => {
  beforeEach(() => {
    api.fetchTagVocabulary.mockResolvedValue([]);
    mockFetchTeamMembers.mockResolvedValue({
      members: [MEMBER_ON_TEAM_NO_CAL],
      admin_count: 0,
      total: 1,
      can_edit: false,
    });
  });

  // item 7 / 10f (self-view): link present with href containing settings_tab=calendar
  // Uses within() scoped to the warning <p> to avoid ambiguity with other role=status elements.
  it('member self-view: "Go to Calendar settings" link with settings_tab=calendar in href', async () => {
    render(<StaffSchedulingSection />);
    // Wait for loading to complete (the "My scheduling" heading appears)
    await waitFor(() => expect(screen.getByRole('heading', { name: /my scheduling/i })).toBeInTheDocument());
    // The warning paragraph has role="status" — there is exactly one after loading
    const warningEl = screen.getByRole('status');
    const link = within(warningEl).getByRole('link', { name: /go to calendar settings/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('settings_tab=calendar');
  });
});
// NOTE: The admin roster "warning text only, no link" test is in StaffSchedulingSection.test.tsx
// (item 7b) where the mockUser vi.fn() pattern allows toggling the role per-test.

// ─────────────────────────────────────────────────────────────────────────────
// assertOAuthUrl — direct unit tests for the origin-validation utility
// These use vi.importActual to get the real function (not the mock used above).
// ─────────────────────────────────────────────────────────────────────────────
describe('assertOAuthUrl (direct unit — item 4)', () => {
  let assertOAuthUrl: (url: string, label: string) => void;

  beforeAll(async () => {
    const mod = await vi.importActual<typeof import('../../../services/schedulingApi')>(
      '../../../services/schedulingApi',
    );
    assertOAuthUrl = mod.assertOAuthUrl;
  });

  it('accepts a valid https URL matching the default OAUTH_ORIGIN', () => {
    // Should not throw for a well-formed https URL on the expected origin.
    expect(() =>
      assertOAuthUrl(
        'https://staging.schedule.myrecruiter.ai/connect?init=tok',
        'connect_url',
      ),
    ).not.toThrow();
  });

  it('rejects an http:// URL (non-https protocol)', () => {
    expect(() =>
      assertOAuthUrl(
        'http://staging.schedule.myrecruiter.ai/connect?init=tok',
        'connect_url',
      ),
    ).toThrow(/non-https/);
  });

  it('rejects a URL whose origin does not match the expected OAUTH_ORIGIN', () => {
    expect(() =>
      assertOAuthUrl(
        'https://evil.attacker.com/connect?init=tok',
        'connect_url',
      ),
    ).toThrow(/does not match expected origin/);
  });
});

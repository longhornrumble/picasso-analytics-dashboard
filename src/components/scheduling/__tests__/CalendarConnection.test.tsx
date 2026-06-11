/**
 * CalendarConnection.test.tsx — Track 2 Surface 1 unit tests.
 *
 * Covers:
 *   - Loading state (spinner rendered)
 *   - Connected status: renders status, calendar_id, Reconnect button
 *   - Disconnected status: renders "Not connected", Connect button
 *   - Stale_connected status: renders warning label
 *   - Revoked disconnected: renders revoked note
 *   - Connect button click: navigates to connect_url (full-page, not fetch)
 *   - Error state: init throws → renders error + Retry button
 *   - Retry button re-triggers the fetch
 *   - Status fetch error: non-fatal → treats as disconnected
 *   - OAuth return (?calendar=connected&watch=ok): renders success banner
 *   - OAuth return (?calendar=connected&watch=pending): renders "being set up" banner
 *   - statusUrl is passed to fetchCalendarConnectionStatus
 *   - CTA wiring: StaffSchedulingSection needsCalendar warning includes Calendar settings link
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
let navigatedTo: string | undefined;

beforeEach(() => {
  searchStr = '';
  navigatedTo = undefined;
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  // Replace window.location with a stub object that behaves like Location for our usage.
  const stub = {
    href: 'http://localhost/',
    search: searchStr,
    assign: vi.fn(),
  };
  Object.defineProperty(stub, 'href', {
    get: () => `http://localhost/${searchStr}`,
    set: (val: string) => { navigatedTo = val; },
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

import { CalendarConnection } from '../CalendarConnection';
import { StaffSchedulingSection } from '../StaffSchedulingSection';

// ── fixtures ─────────────────────────────────────────────────────────────────
const INIT_RESP = {
  expires_in: 300,
  connect_url: 'https://oauth.example.com/connect?init=tok123',
  status_url: 'https://oauth.example.com/connection/status?init=tok123',
};
const CONNECTED_STATUS = {
  status: 'connected' as const,
  calendar_id: 'staff@example.com',
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

  it('shows revocation note when status is disconnected + reason:revoked', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(REVOKED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument());
    expect(screen.getByText(/access was revoked/i)).toBeInTheDocument();
  });

  it('Connect button navigates to connect_url (full-page, not fetch)', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /connect google calendar/i }));
    await user.click(screen.getByRole('button', { name: /connect google calendar/i }));
    expect(navigatedTo).toBe(INIT_RESP.connect_url);
  });

  it('Reconnect button also navigates to connect_url', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    const user = userEvent.setup();
    render(<CalendarConnection />);
    await waitFor(() => screen.getByRole('button', { name: /reconnect google calendar/i }));
    await user.click(screen.getByRole('button', { name: /reconnect google calendar/i }));
    expect(navigatedTo).toBe(INIT_RESP.connect_url);
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

  it('shows OAuth success banner (watch=ok) and calls replaceState to strip params', async () => {
    searchStr = '?calendar=connected&watch=ok';
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => screen.getByTestId('oauth-success-banner'));
    expect(screen.getByTestId('oauth-success-banner')).toHaveTextContent(
      'Calendar connected. You are now bookable.',
    );
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('shows OAuth success banner with watch=pending ("being set up")', async () => {
    searchStr = '?calendar=connected&watch=pending';
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(CONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => screen.getByTestId('oauth-success-banner'));
    expect(screen.getByTestId('oauth-success-banner')).toHaveTextContent('Watch channel is being set up');
  });

  it('passes the exact status_url from init to fetchCalendarConnectionStatus', async () => {
    api.initCalendarConnection.mockResolvedValue(INIT_RESP);
    api.fetchCalendarConnectionStatus.mockResolvedValue(DISCONNECTED_STATUS);
    render(<CalendarConnection />);
    await waitFor(() => screen.getByText('Not connected'));
    expect(api.fetchCalendarConnectionStatus).toHaveBeenCalledWith(INIT_RESP.status_url);
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

describe('E13 CTA wiring — needsCalendar warning links to Calendar settings', () => {
  beforeEach(() => {
    api.fetchTagVocabulary.mockResolvedValue([]);
    mockFetchTeamMembers.mockResolvedValue({
      members: [MEMBER_ON_TEAM_NO_CAL],
      admin_count: 0,
      total: 1,
      can_edit: false,
    });
  });

  it('renders a "Go to Calendar settings" link in the needsCalendar warning (member self-view)', async () => {
    render(<StaffSchedulingSection />);
    // The member warning renders in the self-service "My scheduling" card.
    // We wait for the warning container (role="status") to appear.
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    const link = await screen.findByRole('link', { name: /go to calendar settings/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('settings_tab=calendar');
  });
});

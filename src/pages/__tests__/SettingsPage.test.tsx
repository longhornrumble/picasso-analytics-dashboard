/**
 * SettingsPage.test.tsx — Track 2 deep-link + feature-flag guard tests (item 10d).
 *
 * Covers:
 *   (i)  ?settings_tab=calendar + dashboard_scheduling:true → CalendarConnection renders
 *        + param stripped from URL
 *   (ii) ?settings_tab=calendar + dashboard_scheduling:false → Integrations is always
 *        available (marketplace surface); deep-link resolves, Calendar card self-gates
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

// ── Heavy child mocks ─────────────────────────────────────────────────────────
// Most children are non-trivial (fetch, auth, etc.) — stub them out so
// SettingsPage tests focus only on tab routing and CalendarConnection rendering.

vi.mock('../TeamManagement', () => ({
  TeamManagement: () => <div data-testid="team-management">TeamManagement</div>,
}));
vi.mock('../NotificationsDashboard', () => ({
  NotificationsDashboard: () => <div>NotificationsDashboard</div>,
}));
vi.mock('../scheduling/SchedulingSetup', () => ({
  SchedulingSetup: () => <div>SchedulingSetup</div>,
}));
vi.mock('../AdminPanel', () => ({
  default: () => <div>AdminPanel</div>,
}));

// CalendarConnection: mock to a simple sentinel so the test doesn't need a real
// OAuth backend, but real enough to assert it rendered.
vi.mock('../../components/scheduling/CalendarConnection', () => ({
  CalendarConnection: () => (
    <div data-testid="calendar-connection">CalendarConnection</div>
  ),
}));

// ── schedulingApi mock (needed by any transitive imports) ─────────────────────
const api = {
  initCalendarConnection: vi.fn(),
  fetchCalendarConnectionStatus: vi.fn(),
};
vi.mock('../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../services/schedulingApi')>(
    '../../services/schedulingApi',
  );
  return {
    ...actual,
    initCalendarConnection: () => api.initCalendarConnection(),
    fetchCalendarConnectionStatus: (url: string) => api.fetchCalendarConnectionStatus(url),
  };
});

vi.mock('../../services/analyticsApi', () => ({
  fetchTeamMembers: vi.fn().mockResolvedValue({ members: [], admin_count: 0, total: 0, can_edit: false }),
  getTenantOverride: () => null,
}));

// ── window.location stub ──────────────────────────────────────────────────────
let searchStr = '';

beforeEach(() => {
  searchStr = '';
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  const stub = {
    pathname: '/settings',
    hash: '',
    href: 'http://localhost/settings',
    search: searchStr,
    assign: vi.fn(),
    replace: vi.fn(),
  };
  Object.defineProperty(stub, 'href', {
    get: () => `http://localhost/settings${searchStr}`,
    configurable: true,
  });
  Object.defineProperty(stub, 'search', {
    get: () => searchStr,
    configurable: true,
  });
  vi.stubGlobal('location', stub);

  api.initCalendarConnection.mockResolvedValue({
    expires_in: 300,
    connect_url: 'https://staging.schedule.myrecruiter.ai/connect?init=tok',
    status_url: 'https://staging.schedule.myrecruiter.ai/status?init=tok',
  });
  api.fetchCalendarConnectionStatus.mockResolvedValue({
    status: 'disconnected',
    bookable: false,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.clearAllMocks();
});

// ── useAuth mock — set per-test via mockUser ──────────────────────────────────
const mockUserFn = vi.fn();
vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: mockUserFn() }),
}));

import { SettingsPage } from '../SettingsPage';

// ─────────────────────────────────────────────────────────────────────────────

describe('SettingsPage deep-link + feature-flag guard (item 10d)', () => {
  // (i) settings_tab=calendar + dashboard_scheduling:true → CalendarConnection + param stripped
  it('resolves ?settings_tab=calendar to the Calendar tab when dashboard_scheduling is true', async () => {
    searchStr = '?settings_tab=calendar';
    mockUserFn.mockReturnValue({
      email: 'staff@example.com',
      role: 'member',
      features: {
        dashboard_conversations: true,
        dashboard_forms: false,
        dashboard_attribution: false,
        dashboard_notifications: false,
        dashboard_settings: true,
        dashboard_scheduling: true,
      },
    });
    render(<SettingsPage />);

    // CalendarConnection should be rendered (Calendar tab active)
    await waitFor(() =>
      expect(screen.getByTestId('calendar-connection')).toBeInTheDocument(),
    );

    // Integrations tab button (id 'calendar') should be present and the tab navigation rendered
    expect(screen.getByRole('button', { name: /integrations/i })).toBeInTheDocument();

    // Param should be stripped via replaceState
    expect(window.history.replaceState).toHaveBeenCalled();
    const replaceArgs = (window.history.replaceState as ReturnType<typeof vi.fn>).mock.calls[0];
    const strippedUrl: string = replaceArgs[2];
    expect(strippedUrl).not.toContain('settings_tab=');
  });

  // (ii) settings_tab=calendar + dashboard_scheduling:false → Integrations is ALWAYS
  // available now (persistent marketplace surface); the deep-link resolves and the
  // Calendar card renders (the card self-gates on org activation internally).
  it('still resolves ?settings_tab=calendar when dashboard_scheduling is false — Integrations is always available', () => {
    searchStr = '?settings_tab=calendar';
    mockUserFn.mockReturnValue({
      email: 'staff@example.com',
      role: 'member',
      features: {
        dashboard_conversations: true,
        dashboard_forms: false,
        dashboard_attribution: false,
        dashboard_notifications: false,
        dashboard_settings: true,
        dashboard_scheduling: false,
      },
    });
    render(<SettingsPage />);

    // Integrations tab is present even with the scheduling entitlement off.
    expect(screen.getByRole('button', { name: /^integrations$/i })).toBeInTheDocument();
    // The Calendar card renders; it self-gates on org activation internally.
    expect(screen.getByTestId('calendar-connection')).toBeInTheDocument();
  });
});

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingApiError } from '../../../services/schedulingApi';

const mockUser = vi.fn();
vi.mock('../../../context/useAuth', () => ({ useAuth: () => ({ user: mockUser() }) }));

const api = {
  fetchTeamMembers: vi.fn(),
  fetchPrograms: vi.fn(),
  fetchAppointmentTypes: vi.fn(),
  fetchRoutingPolicies: vi.fn(),
  updateEmployeeScheduling: vi.fn(),
};
vi.mock('../../../services/analyticsApi', () => ({ fetchTeamMembers: () => api.fetchTeamMembers() }));
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>('../../../services/schedulingApi');
  return {
    ...actual, // keep SchedulingApiError real
    fetchPrograms: () => api.fetchPrograms(),
    fetchAppointmentTypes: () => api.fetchAppointmentTypes(),
    fetchRoutingPolicies: () => api.fetchRoutingPolicies(),
    updateEmployeeScheduling: (...a: unknown[]) => api.updateEmployeeScheduling(...a),
  };
});

import { StaffSchedulingSection } from '../StaffSchedulingSection';

const base = { membership_id: null, user_id: null, type: 'clerk_user' as const, status: 'active' as const, joined_at: '2026-01-01' };
const PROGRAMS = [
  { program_id: 'lovebox', program_name: 'Love Box' },
  { program_id: 'dare', program_name: 'Dare to Dream' },
];
const POLICIES = [
  { routing_policy_id: 'rp_lb', tag_conditions: [{ operator: 'in_any' as const, values: ['lovebox_team'] }] },
  { routing_policy_id: 'rp_dd', tag_conditions: [{ operator: 'in_any' as const, values: ['dare_team'] }] },
];
const APPTS = [
  { appointment_type_id: 'a_lb', name: 'Love Box', duration_minutes: 30, routing_policy_id: 'rp_lb', program_id: 'lovebox' },
  { appointment_type_id: 'a_dd', name: 'Dare', duration_minutes: 30, routing_policy_id: 'rp_dd', program_id: 'dare' },
];
// Maya → Love Box, bookable.  Alex → Dare, calendar not connected.
const MAYA = { ...base, employee_id: 'e1', email: 'maya@x', name: 'Maya', role: 'member' as const, scheduling_tags: ['lovebox_team'], bookable_override: null, calendar_email_override: 'maya.cal@x', calendar_connected: true };
const ALEX = { ...base, employee_id: 'e2', email: 'alex@x', name: 'Alex', role: 'member' as const, scheduling_tags: ['dare_team'], bookable_override: null, calendar_connected: false };

beforeEach(() => {
  api.fetchTeamMembers.mockResolvedValue({ members: [MAYA, ALEX], admin_count: 1, total: 2, can_edit: true });
  api.fetchPrograms.mockResolvedValue(PROGRAMS);
  api.fetchAppointmentTypes.mockResolvedValue(APPTS);
  api.fetchRoutingPolicies.mockResolvedValue(POLICIES);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StaffSchedulingSection — admin (Who handles bookings)', () => {
  beforeEach(() => mockUser.mockReturnValue({ role: 'admin', email: 'admin@x' }));

  it('renders the read-out grouped by program with both programs + members', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /who handles bookings/i })).toBeInTheDocument());
    expect(screen.getByText('Love Box')).toBeInTheDocument();
    expect(screen.getByText('Dare to Dream')).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('shows 3-state status, coverage pills, and thinnest-coverage-first order', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    expect(screen.getByText('Bookable')).toBeInTheDocument(); // Maya (connected, not paused)
    expect(screen.getByText(/Connect calendar to be bookable/)).toBeInTheDocument(); // Alex
    expect(screen.getByText('No bookable staff')).toBeInTheDocument(); // Dare — 0 bookable
    expect(screen.getByText('1 of 1 bookable')).toBeInTheDocument(); // Love Box
    // thinnest-first: Dare (0) renders before Love Box (1)
    const dare = screen.getByText('Dare to Dream');
    const lb = screen.getByText('Love Box');
    expect(dare.compareDocumentPosition(lb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('remind-to-connect flips the row to the sent state', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /remind to connect/i }));
    expect(screen.getByText(/Reminder sent/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remind to connect/i })).toBeNull();
  });

  it('edit modal: assigning a program writes the team tag + calendar email via PATCH', async () => {
    api.fetchTeamMembers.mockResolvedValue({ members: [MAYA], admin_count: 1, total: 1, can_edit: true });
    api.updateEmployeeScheduling.mockResolvedValue({
      employee_id: 'e1', scheduling_tags: ['lovebox_team', 'dare_team'], bookable_override: null, calendar_email_override: 'new@x',
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByText(/Edit Maya/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dare to Dream')); // add the Dare program (→ dare_team)
    const email = screen.getByLabelText('Calendar email');
    await userEvent.clear(email);
    await userEvent.type(email, 'new@x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e1', {
      scheduling_tags: ['lovebox_team', 'dare_team'],
      bookable_override: null,
      calendar_email_override: 'new@x',
    });
  });

  it('footer links to the Team tab and has NO invite button', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /manage team/i })).toBeInTheDocument();
    expect(screen.queryByText(/invite staff/i)).toBeNull();
  });

  it('surfaces a 422 unknown-tag error from a save', async () => {
    api.fetchTeamMembers.mockResolvedValue({ members: [MAYA], admin_count: 1, total: 1, can_edit: true });
    api.updateEmployeeScheduling.mockRejectedValue(new SchedulingApiError(422, 'bad', ['typo']));
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Unknown team name\(s\): typo/i));
  });

  it('shows a load error without crashing', async () => {
    api.fetchTeamMembers.mockRejectedValue(new Error('boom'));
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load staff: boom/i));
  });
});

describe('StaffSchedulingSection — member (self-service)', () => {
  beforeEach(() => mockUser.mockReturnValue({ role: 'member', email: 'maya@x' }));

  it('shows only the own calendar-email card and PATCHes just that field', async () => {
    api.updateEmployeeScheduling.mockResolvedValue({ employee_id: 'e1', calendar_email_override: 'mine@x' });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /my scheduling/i })).toBeInTheDocument());
    expect(screen.queryByText('Alex')).not.toBeInTheDocument(); // no admin roster
    expect(api.fetchPrograms).not.toHaveBeenCalled(); // member never loads the admin grouping data

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const email = screen.getByLabelText('Calendar email');
    await userEvent.clear(email);
    await userEvent.type(email, 'mine@x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e1', { calendar_email_override: 'mine@x' });
  });

  it('surfaces the D3 warning on the member self-view when half-configured', async () => {
    api.fetchTeamMembers.mockResolvedValue({ members: [{ ...MAYA, calendar_connected: false }], admin_count: 1, total: 1, can_edit: true });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /my scheduling/i })).toBeInTheDocument());
    expect(screen.getByText(/Connect calendar to be bookable/)).toBeInTheDocument();
  });
});

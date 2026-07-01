import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
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
  updateRoutingPolicy: vi.fn(),
  createRoutingPolicy: vi.fn(),
};
vi.mock('../../../services/analyticsApi', () => ({ fetchTeamMembers: () => api.fetchTeamMembers() }));
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>('../../../services/schedulingApi');
  return {
    ...actual, // keep SchedulingApiError + ifMatchToken real
    fetchPrograms: () => api.fetchPrograms(),
    fetchAppointmentTypes: () => api.fetchAppointmentTypes(),
    fetchRoutingPolicies: () => api.fetchRoutingPolicies(),
    updateEmployeeScheduling: (...a: unknown[]) => api.updateEmployeeScheduling(...a),
    updateRoutingPolicy: (...a: unknown[]) => api.updateRoutingPolicy(...a),
    createRoutingPolicy: (...a: unknown[]) => api.createRoutingPolicy(...a),
  };
});

import { StaffSchedulingSection } from '../StaffSchedulingSection';

const base = { membership_id: null, user_id: null, type: 'clerk_user' as const, status: 'active' as const, joined_at: '2026-01-01' };
const PROGRAMS = [
  { program_id: 'lovebox', program_name: 'Love Box' },
  { program_id: 'dare', program_name: 'Dare to Dream' },
  { program_id: 'donor', program_name: 'Donor Relations' }, // no team → not bookable (Add pick-list)
];
const POLICIES = [
  { routing_policy_id: 'rp_lb', program_id: 'lovebox', bookable: true, tie_breaker: 'round_robin' as const, tag_conditions: [{ operator: 'in_any' as const, values: ['Love Box Team'] }], modified_at: { at: '2026-07-01T00:00:00Z', by: 'x' } },
  { routing_policy_id: 'rp_dd', program_id: 'dare', tie_breaker: 'first_available' as const, tag_conditions: [{ operator: 'in_any' as const, values: ['Dare Team'] }], modified_at: { at: '2026-07-01T00:00:00Z', by: 'x' } },
];
const APPTS = [
  { appointment_type_id: 'a_lb', name: 'Love Box Discovery', duration_minutes: 30, routing_policy_id: 'rp_lb', program_id: 'lovebox' },
];
// Maya → Love Box, bookable. Alex → Dare, calendar not connected.
const MAYA = { ...base, employee_id: 'e1', email: 'maya@x', name: 'Maya', role: 'member' as const, scheduling_tags: ['Love Box Team'], bookable_override: null, calendar_email_override: 'maya.cal@x', calendar_connected: true };
const ALEX = { ...base, employee_id: 'e2', email: 'alex@x', name: 'Alex', role: 'member' as const, scheduling_tags: ['Dare Team'], bookable_override: null, calendar_connected: false };

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

  it('renders bookable programs grouped, with members, coverage, and thinnest-first order', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /who handles bookings/i })).toBeInTheDocument());
    expect(screen.getByText('Love Box')).toBeInTheDocument();
    expect(screen.getByText('Dare to Dream')).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    // Donor Relations has no team → not a group, but IS in the "Add a bookable program" pick-list.
    expect(screen.queryByText('Donor Relations')).toBeNull();
    // status + coverage
    expect(screen.getByText(/Connect calendar to be bookable/)).toBeInTheDocument(); // Alex
    expect(screen.getByText('No bookable staff')).toBeInTheDocument(); // Dare (0)
    expect(screen.getByText('1 of 1 bookable')).toBeInTheDocument(); // Love Box
    // thinnest-first: Dare (0) before Love Box (1)
    const dare = screen.getByText('Dare to Dream');
    const lb = screen.getByText('Love Box');
    expect(dare.compareDocumentPosition(lb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('remind-to-connect flips the row to the sent state', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Alex')).toBeInTheDocument());
    await userEvent.click(screen.getByText(/remind to connect/i));
    expect(screen.getByText(/Reminder sent/i)).toBeInTheDocument();
    expect(screen.queryByText(/remind to connect/i)).toBeNull();
  });

  it('person Edit (row click): toggling a program writes the team tag + calendar email', async () => {
    api.updateEmployeeScheduling.mockResolvedValue({ employee_id: 'e1' });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Maya')); // row click opens the person modal
    expect(screen.getByText(/Edit Maya/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dare to Dream')); // add Dare (→ Dare Team tag)
    const email = screen.getByLabelText('Calendar email');
    await userEvent.clear(email);
    await userEvent.type(email, 'new@x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e1', {
      scheduling_tags: ['Love Box Team', 'Dare Team'],
      bookable_override: null,
      calendar_email_override: 'new@x',
    });
  });

  it('Assign people (group header) opens a flat staff picker and writes the team tag', async () => {
    api.updateEmployeeScheduling.mockResolvedValue({ employee_id: 'e2' });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Love Box')).toBeInTheDocument());
    // Open Assign for the Love Box group (first "Assign people" in Love Box row).
    const lbGroup = screen.getByText('Love Box').closest('div')!.parentElement as HTMLElement;
    await userEvent.click(within(lbGroup).getByRole('button', { name: /assign people/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Assign people to Love Box/)).toBeInTheDocument();
    // Alex is not on Love Box yet → check him → save writes the Love Box Team tag onto Alex.
    const alexRow = within(dialog).getByText('Alex').closest('label') as HTMLElement;
    await userEvent.click(within(alexRow).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e2', {
      scheduling_tags: ['Dare Team', 'Love Box Team'],
    });
  });

  it('program Edit renames the team + sets assignment via updateRoutingPolicy', async () => {
    api.updateRoutingPolicy.mockResolvedValue({ routing_policy: {} });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Love Box')).toBeInTheDocument());
    const lbGroup = screen.getByText('Love Box').closest('div')!.parentElement as HTMLElement;
    await userEvent.click(within(lbGroup).getByRole('button', { name: /^edit$/i }));
    expect(screen.getByText(/Edit Love Box/)).toBeInTheDocument();
    const name = screen.getByLabelText('Team name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Coordinators');
    await userEvent.click(screen.getByRole('button', { name: /first available/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(api.updateRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.updateRoutingPolicy).toHaveBeenCalledWith(
      'rp_lb',
      { tie_breaker: 'first_available', tag_conditions: [{ operator: 'in_any', values: ['Coordinators'] }] },
      '2026-07-01T00:00:00Z',
    );
  });

  it('Stop making bookable warns about dependent appointment types, then flips bookable=false', async () => {
    api.updateRoutingPolicy.mockResolvedValue({ routing_policy: {} });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Love Box')).toBeInTheDocument());
    const lbGroup = screen.getByText('Love Box').closest('div')!.parentElement as HTMLElement;
    await userEvent.click(within(lbGroup).getByRole('button', { name: /^edit$/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop making bookable/i }));
    // Fix #2: confirmation lists the dependent appointment-type count (1 for Love Box).
    expect(screen.getByText(/1 appointment type currently routes/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^stop making bookable$/i }));
    await waitFor(() => expect(api.updateRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.updateRoutingPolicy.mock.calls[0][1]).toMatchObject({ bookable: false });
  });

  it('Add a bookable program lists unbound config programs and makes one bookable', async () => {
    api.createRoutingPolicy.mockResolvedValue({ routing_policy: {} });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Love Box')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /add a bookable program/i }));
    expect(screen.getByText(/Pick a program from your configuration/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /make bookable/i })); // Donor Relations
    await waitFor(() => expect(api.createRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.createRoutingPolicy).toHaveBeenCalledWith({
      program_id: 'donor',
      bookable: true,
      tie_breaker: 'round_robin',
      tag_conditions: [{ operator: 'in_any', values: ['Donor Relations'] }],
    });
  });

  it('footer links to the Team tab and has NO invite button', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /manage team/i })).toBeInTheDocument();
    expect(screen.queryByText(/invite staff/i)).toBeNull();
  });

  it('surfaces a 422 unknown-tag error from a person save', async () => {
    api.updateEmployeeScheduling.mockRejectedValue(new SchedulingApiError(422, 'bad', ['typo']));
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Maya'));
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
});

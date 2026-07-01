import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = {
  fetchAppointmentTypes: vi.fn(),
  fetchRoutingPolicies: vi.fn(),
  fetchPrograms: vi.fn(),
  createAppointmentType: vi.fn(),
  updateAppointmentType: vi.fn(),
  fetchNotificationTemplates: vi.fn(),
  fetchSchedulingActivation: vi.fn(),
  initCalendarConnection: vi.fn(),
  fetchCalendarConnectionStatus: vi.fn(),
};
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual, // keep ifMatchToken + SchedulingApiError real
    fetchAppointmentTypes: () => api.fetchAppointmentTypes(),
    fetchRoutingPolicies: () => api.fetchRoutingPolicies(),
    fetchPrograms: () => api.fetchPrograms(),
    createAppointmentType: (...a: unknown[]) => api.createAppointmentType(...a),
    updateAppointmentType: (...a: unknown[]) => api.updateAppointmentType(...a),
    fetchNotificationTemplates: () => api.fetchNotificationTemplates(),
    fetchSchedulingActivation: () => api.fetchSchedulingActivation(),
    initCalendarConnection: () => api.initCalendarConnection(),
    fetchCalendarConnectionStatus: (url: string) => api.fetchCalendarConnectionStatus(url),
  };
});

// Admin viewer. §1 "Who handles bookings" (StaffSchedulingSection) is its own unit with its own
// tests — stub it here so its program-group headers don't collide with §2's names.
vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'admin', email: 'admin@example.invalid' } }),
}));
vi.mock('../../../services/analyticsApi', () => ({
  fetchTeamMembers: () => Promise.resolve({ members: [], admin_count: 0, total: 0, can_edit: true }),
}));
vi.mock('../../../components/scheduling/StaffSchedulingSection', () => ({
  StaffSchedulingSection: () => null,
}));

import { SchedulingSetup } from '../SchedulingSetup';

// Two bookable programs, each with its bound team (program↔team 1:1). §2 only offers bookable ones.
const POLICY = {
  routing_policy_id: 'rp1',
  program_id: 'discovery_program',
  bookable: true,
  tie_breaker: 'round_robin' as const,
  tag_conditions: [{ operator: 'in_any' as const, values: ['volunteer_coordinators'] }],
  modified_at: { at: '2026-06-06T00:00:00.000001Z', by: 'admin@x' },
};
const POLICY2 = {
  routing_policy_id: 'rp2',
  program_id: 'interview_program',
  bookable: true,
  tie_breaker: 'round_robin' as const,
  tag_conditions: [{ operator: 'in_any' as const, values: ['interview_team'] }],
  modified_at: { at: '2026-06-06T00:00:00.000003Z', by: 'admin@x' },
};
const APPT = {
  appointment_type_id: 'a1',
  name: 'Discovery Call', // event title (distinct from the program name)
  duration_minutes: 30,
  routing_policy_id: 'rp1',
  program_id: 'discovery_program',
  modified_at: { at: '2026-06-06T00:00:00.000002Z', by: 'admin@x' },
};
const PROGRAMS = [
  { program_id: 'discovery_program', program_name: 'Discovery' },
  { program_id: 'interview_program', program_name: 'Interview' },
];

beforeEach(() => {
  api.fetchAppointmentTypes.mockResolvedValue([APPT]);
  api.fetchRoutingPolicies.mockResolvedValue([POLICY, POLICY2]);
  api.fetchPrograms.mockResolvedValue(PROGRAMS);
  api.fetchNotificationTemplates.mockResolvedValue({ moments: {}, stop_footer_note: '' });
  // Default: past the onboarding gate (org activated + viewer's calendar connected).
  api.fetchSchedulingActivation.mockResolvedValue({ enabled: true, can_manage: true });
  api.initCalendarConnection.mockResolvedValue({
    connect_url: 'https://x/connect?init=t', status_url: 'https://x/status?init=t', expires_in: 300,
  });
  api.fetchCalendarConnectionStatus.mockResolvedValue({ status: 'connected' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// The form selects are the custom <Select> (role=combobox + role=option) — open then pick.
async function chooseFromSelect(labelText: string, optionName: string | RegExp) {
  await userEvent.click(screen.getByLabelText(labelText));
  await userEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('SchedulingSetup — onboarding gate', () => {
  it('blocks with the Step 1 (approve) overlay when scheduling is not enabled for the org', async () => {
    api.fetchSchedulingActivation.mockResolvedValue({ enabled: false, can_manage: true });
    render(<SchedulingSetup />);
    expect(await screen.findByTestId('gate-needs-activation')).toBeInTheDocument();
    expect(api.fetchAppointmentTypes).not.toHaveBeenCalled();
  });

  it('blocks with the Step 2 (connect) overlay when activated but the calendar is not connected', async () => {
    api.fetchSchedulingActivation.mockResolvedValue({ enabled: true, can_manage: true });
    api.fetchCalendarConnectionStatus.mockResolvedValue({ status: 'disconnected' });
    render(<SchedulingSetup />);
    expect(await screen.findByTestId('gate-needs-connection')).toBeInTheDocument();
    expect(api.fetchAppointmentTypes).not.toHaveBeenCalled();
  });

  it('renders the setup once activated AND connected', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());
    expect(screen.queryByTestId('gate-needs-activation')).toBeNull();
    expect(screen.queryByTestId('gate-needs-connection')).toBeNull();
  });
});

describe('SchedulingSetup — §2 What can be booked', () => {
  it('lists appointment types with program · duration · location · team meta', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());
    expect(screen.getByText(/Discovery · 30 min · Google Meet · volunteer_coordinators/)).toBeInTheDocument();
    // No standalone Teams list here anymore — teams live in §1 "Who handles bookings".
    expect(screen.queryByText('Teams')).toBeNull();
    expect(screen.queryByRole('button', { name: /add team/i })).toBeNull();
  });

  it('renders a non-default conference modality label (zoom → Zoom)', async () => {
    api.fetchAppointmentTypes.mockResolvedValue([{ ...APPT, conference_type: 'zoom' }]);
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());
    expect(screen.getByText(/Discovery · 30 min · Zoom · volunteer_coordinators/)).toBeInTheDocument();
  });

  it('surfaces modified_at on the appointment-type row', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());
    expect(screen.getAllByText(/Edited by admin@x ·/).length).toBeGreaterThanOrEqual(1);
  });

  it('creates an appointment type bound to a bookable program + its team, then reloads', async () => {
    api.createAppointmentType.mockResolvedValue({ ...APPT, appointment_type_id: 'a2', name: 'Interview' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add appointment type/i }));
    await chooseFromSelect('Program', 'Interview'); // sets program_id + team (rp2) + default event title
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.createAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Interview', program_id: 'interview_program', routing_policy_id: 'rp2', duration_minutes: 30, conference_type: 'google_meet' }),
    );
    expect(api.fetchAppointmentTypes).toHaveBeenCalledTimes(2); // initial + reload
  });

  it('creates an appointment type with the chosen Location (Zoom)', async () => {
    api.createAppointmentType.mockResolvedValue({ ...APPT, appointment_type_id: 'a2', conference_type: 'zoom' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add appointment type/i }));
    await chooseFromSelect('Program', 'Interview');
    await chooseFromSelect('Location', 'Zoom');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.createAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Interview', program_id: 'interview_program', conference_type: 'zoom', routing_policy_id: 'rp2' }),
    );
  });

  it('opens the editor by clicking the row (click-anywhere) and edits with the If-Match token', async () => {
    api.updateAppointmentType.mockResolvedValue(APPT);
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Discovery Call/i })); // the row IS the button
    const title = screen.getByLabelText('Event title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Intro Chat');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.updateAppointmentType).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ name: 'Intro Chat', program_id: 'discovery_program', routing_policy_id: 'rp1', conference_type: 'google_meet' }),
      '2026-06-06T00:00:00.000002Z', // ifMatchToken(APPT)
    );
  });

  it('disables "Add appointment type" when no program is bookable', async () => {
    api.fetchRoutingPolicies.mockResolvedValue([]); // nothing bound → nothing bookable
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery Call')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add appointment type/i })).toBeDisabled();
  });

  it('shows a load error without crashing', async () => {
    api.fetchRoutingPolicies.mockRejectedValue(new Error('boom'));
    render(<SchedulingSetup />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load appointment types: boom/i),
    );
  });
});

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingApiError } from '../../../services/schedulingApi';

const api = {
  fetchAppointmentTypes: vi.fn(),
  fetchRoutingPolicies: vi.fn(),
  createAppointmentType: vi.fn(),
  updateAppointmentType: vi.fn(),
  createRoutingPolicy: vi.fn(),
  updateRoutingPolicy: vi.fn(),
  deleteRoutingPolicy: vi.fn(),
  fetchTagVocabulary: vi.fn(),
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
    createAppointmentType: (...a: unknown[]) => api.createAppointmentType(...a),
    updateAppointmentType: (...a: unknown[]) => api.updateAppointmentType(...a),
    createRoutingPolicy: (...a: unknown[]) => api.createRoutingPolicy(...a),
    updateRoutingPolicy: (...a: unknown[]) => api.updateRoutingPolicy(...a),
    deleteRoutingPolicy: (...a: unknown[]) => api.deleteRoutingPolicy(...a),
    fetchTagVocabulary: () => api.fetchTagVocabulary(),
    fetchNotificationTemplates: () => api.fetchNotificationTemplates(),
    fetchSchedulingActivation: () => api.fetchSchedulingActivation(),
    initCalendarConnection: () => api.initCalendarConnection(),
    fetchCalendarConnectionStatus: (url: string) => api.fetchCalendarConnectionStatus(url),
  };
});

// Admin viewer + an empty roster so the nested StaffSchedulingSection renders inertly.
vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'admin', email: 'admin@example.invalid' } }),
}));
vi.mock('../../../services/analyticsApi', () => ({
  fetchTeamMembers: () => Promise.resolve({ members: [], admin_count: 0, total: 0, can_edit: true }),
}));

import { SchedulingSetup } from '../SchedulingSetup';

const POLICY = {
  routing_policy_id: 'rp1',
  tie_breaker: 'round_robin' as const,
  tag_conditions: [{ operator: 'in_any' as const, values: ['volunteer_coordinators'] }],
  modified_at: { at: '2026-06-06T00:00:00.000001Z', by: 'admin@x' },
};
const APPT = {
  appointment_type_id: 'a1',
  name: 'Discovery',
  duration_minutes: 30,
  routing_policy_id: 'rp1',
  modified_at: { at: '2026-06-06T00:00:00.000002Z', by: 'admin@x' },
};

beforeEach(() => {
  api.fetchAppointmentTypes.mockResolvedValue([APPT]);
  api.fetchRoutingPolicies.mockResolvedValue([POLICY]);
  api.fetchTagVocabulary.mockResolvedValue(['volunteer_coordinators']);
  api.deleteRoutingPolicy.mockResolvedValue(undefined);
  api.fetchNotificationTemplates.mockResolvedValue({ moments: {}, stop_footer_note: '' });
  // Default: past the onboarding gate (org activated + viewer's calendar connected),
  // so the existing setup-render tests apply. Gate tests override these.
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

// The form selects are now the custom <Select> (role=combobox + role=option), not native
// <select> — open the combobox (found via its label) then click the option.
async function chooseFromSelect(labelText: string, optionName: string | RegExp) {
  await userEvent.click(screen.getByLabelText(labelText));
  await userEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('SchedulingSetup — onboarding gate', () => {
  it('blocks with the Step 1 (approve) overlay when scheduling is not enabled for the org', async () => {
    api.fetchSchedulingActivation.mockResolvedValue({ enabled: false, can_manage: true });
    render(<SchedulingSetup />);
    expect(await screen.findByTestId('gate-needs-activation')).toBeInTheDocument();
    // Config endpoints are NOT called while gated.
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
    // defaults: enabled + connected
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    expect(screen.queryByTestId('gate-needs-activation')).toBeNull();
    expect(screen.queryByTestId('gate-needs-connection')).toBeNull();
  });
});

describe('SchedulingSetup (E13b)', () => {
  it('lists teams + appointment types, resolving the team label by routing policy', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    // appointment-type row shows duration + conference modality (default Google Meet) +
    // resolved team label (not the raw policy id)
    expect(screen.getByText(/30 min · Google Meet · volunteer_coordinators/)).toBeInTheDocument();
    // Teams subsection + its team row (round-robin rule blurb)
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText(/Round-robin/)).toBeInTheDocument();
  });

  it('renders a non-default conference modality label (zoom → Zoom)', async () => {
    api.fetchAppointmentTypes.mockResolvedValue([{ ...APPT, conference_type: 'zoom' }]);
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    expect(screen.getByText(/30 min · Zoom · volunteer_coordinators/)).toBeInTheDocument();
  });

  it('surfaces modified_at on each row (AC#20)', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    // both the appt type (APPT.modified_at) and team (POLICY.modified_at) carry by=admin@x
    expect(screen.getAllByText(/Edited by admin@x ·/).length).toBeGreaterThanOrEqual(2);
  });

  it('creates an appointment type with the chosen team and reloads', async () => {
    api.createAppointmentType.mockResolvedValue({ ...APPT, appointment_type_id: 'a2', name: 'Interview' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add appointment type/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Interview');
    await chooseFromSelect('Handled by team', 'volunteer_coordinators'); // value rp1
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.createAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentType).toHaveBeenCalledWith(
      // Location defaults to Google Meet when the admin doesn't change it.
      expect.objectContaining({ name: 'Interview', routing_policy_id: 'rp1', duration_minutes: 30, conference_type: 'google_meet' }),
    );
    expect(api.fetchAppointmentTypes).toHaveBeenCalledTimes(2); // initial + reload
  });

  it('creates an appointment type with the chosen Location (Zoom)', async () => {
    api.createAppointmentType.mockResolvedValue({ ...APPT, appointment_type_id: 'a2', name: 'Consult', conference_type: 'zoom' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add appointment type/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Consult');
    await chooseFromSelect('Location', 'Zoom');
    await chooseFromSelect('Handled by team', 'volunteer_coordinators'); // value rp1
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.createAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Consult', conference_type: 'zoom', routing_policy_id: 'rp1' }),
    );
  });

  it('edits an appointment type with its If-Match optimistic-lock token', async () => {
    api.updateAppointmentType.mockResolvedValue(APPT);
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.updateAppointmentType).toHaveBeenCalledWith(
      'a1',
      // edit seeds conference_type from the row (absent → google_meet) and sends it back
      expect.objectContaining({ name: 'Discovery', routing_policy_id: 'rp1', conference_type: 'google_meet' }),
      '2026-06-06T00:00:00.000002Z', // ifMatchToken(APPT)
    );
  });

  it('edits a team with its If-Match optimistic-lock token', async () => {
    api.updateRoutingPolicy.mockResolvedValue({ ...POLICY, tie_breaker: 'first_available' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /edit team volunteer_coordinators/i }));
    await chooseFromSelect('Assignment', 'First available');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(api.updateRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.updateRoutingPolicy).toHaveBeenCalledWith(
      'rp1',
      expect.objectContaining({
        tie_breaker: 'first_available',
        tag_conditions: [{ operator: 'in_any', values: ['volunteer_coordinators'] }],
      }),
      '2026-06-06T00:00:00.000001Z', // ifMatchToken(POLICY)
    );
    expect(api.fetchRoutingPolicies).toHaveBeenCalledTimes(2); // initial + reload
  });

  it('renames a team by editing its Team name (sends the new tag; server cascades)', async () => {
    api.updateRoutingPolicy.mockResolvedValue({ ...POLICY });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /edit team volunteer_coordinators/i }));
    const nameInput = screen.getByLabelText('Team name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Coordinators');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(api.updateRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.updateRoutingPolicy).toHaveBeenCalledWith(
      'rp1',
      expect.objectContaining({ tag_conditions: [{ operator: 'in_any', values: ['Coordinators'] }] }),
      '2026-06-06T00:00:00.000001Z',
    );
  });

  it('creates a team by typing its name (a team IS its name — unification)', async () => {
    api.createRoutingPolicy.mockResolvedValue({ ...POLICY, routing_policy_id: 'rp2' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add team/i }));
    await userEvent.type(screen.getByLabelText('Team name'), 'ESL Tutors');
    await userEvent.click(screen.getByRole('button', { name: /save team/i }));

    await waitFor(() => expect(api.createRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.createRoutingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_conditions: [{ operator: 'in_any', values: ['ESL Tutors'] }],
      }),
    );
  });

  it('shows a load error without crashing', async () => {
    api.fetchRoutingPolicies.mockRejectedValue(new Error('boom'));
    render(<SchedulingSetup />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load scheduling setup: boom/i),
    );
  });
});

describe('SchedulingSetup — Teams unification (one section + delete)', () => {
  it('has no separate Team Names manager (folded into Teams)', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    expect(screen.queryByText('Team Names')).toBeNull();
    expect(screen.queryByLabelText('New team name')).toBeNull();
  });

  it('deletes a team after an inline confirm, with its If-Match token', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete team volunteer_coordinators/i }));
    expect(api.deleteRoutingPolicy).not.toHaveBeenCalled(); // confirm first
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(api.deleteRoutingPolicy).toHaveBeenCalledTimes(1));
    expect(api.deleteRoutingPolicy).toHaveBeenCalledWith('rp1', '2026-06-06T00:00:00.000001Z'); // ifMatchToken(POLICY)
    expect(api.fetchRoutingPolicies).toHaveBeenCalledTimes(2); // initial + reload
  });

  it('cancel in the confirm aborts the delete', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete team volunteer_coordinators/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(api.deleteRoutingPolicy).not.toHaveBeenCalled();
  });

  it('surfaces the 409 "in use by appointment type" block and keeps the team', async () => {
    api.deleteRoutingPolicy.mockRejectedValue(
      new SchedulingApiError(409, 'team is in use by appointment type(s); reassign them first'),
    );
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete team volunteer_coordinators/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/in use by appointment type\(s\); reassign them first/i),
    );
    expect(screen.getByRole('button', { name: /edit team volunteer_coordinators/i })).toBeInTheDocument();
  });
});

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
  fetchTagVocabulary: vi.fn(),
  fetchNotificationTemplates: vi.fn(),
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
    fetchTagVocabulary: () => api.fetchTagVocabulary(),
    fetchNotificationTemplates: () => api.fetchNotificationTemplates(),
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
  api.fetchNotificationTemplates.mockResolvedValue({ moments: {}, stop_footer_note: '' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SchedulingSetup (E13b)', () => {
  it('lists teams + appointment types, resolving the team label by routing policy', async () => {
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());
    // appointment-type row shows duration + resolved team label (not the raw policy id)
    expect(screen.getByText(/30 min · volunteer_coordinators/)).toBeInTheDocument();
    // team row
    expect(screen.getByLabelText('Teams')).toBeInTheDocument();
  });

  it('creates an appointment type with the chosen team and reloads', async () => {
    api.createAppointmentType.mockResolvedValue({ ...APPT, appointment_type_id: 'a2', name: 'Interview' });
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add appointment type/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Interview');
    await userEvent.selectOptions(screen.getByLabelText('Handled by team'), 'rp1');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.createAppointmentType).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Interview', routing_policy_id: 'rp1', duration_minutes: 30 }),
    );
    expect(api.fetchAppointmentTypes).toHaveBeenCalledTimes(2); // initial + reload
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
      expect.objectContaining({ name: 'Discovery', routing_policy_id: 'rp1' }),
      '2026-06-06T00:00:00.000002Z', // ifMatchToken(APPT)
    );
  });

  it('surfaces a 422 fail-closed unknown-tag error from a team save', async () => {
    api.createRoutingPolicy.mockRejectedValue(
      new SchedulingApiError(422, 'unknown tags', ['typo']),
    );
    render(<SchedulingSetup />);
    await waitFor(() => expect(screen.getByText('Discovery')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add team/i }));
    await userEvent.type(screen.getByLabelText('Team tag'), 'typo');
    await userEvent.click(screen.getByRole('button', { name: /save team/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Unknown team tag\(s\): typo/i),
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

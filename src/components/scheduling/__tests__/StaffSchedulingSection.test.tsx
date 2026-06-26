import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingApiError } from '../../../services/schedulingApi';

const mockUser = vi.fn();
vi.mock('../../../context/useAuth', () => ({ useAuth: () => ({ user: mockUser() }) }));

const api = {
  fetchTeamMembers: vi.fn(),
  fetchTagVocabulary: vi.fn(),
  updateEmployeeScheduling: vi.fn(),
};
vi.mock('../../../services/analyticsApi', () => ({
  fetchTeamMembers: () => api.fetchTeamMembers(),
}));
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual, // keep SchedulingApiError real
    fetchTagVocabulary: () => api.fetchTagVocabulary(),
    updateEmployeeScheduling: (...a: unknown[]) => api.updateEmployeeScheduling(...a),
  };
});

import { StaffSchedulingSection } from '../StaffSchedulingSection';

const base = { membership_id: null, user_id: null, type: 'clerk_user' as const, status: 'active' as const, joined_at: '2026-01-01' };
const MAYA = { ...base, employee_id: 'e1', email: 'maya@x', name: 'Maya', role: 'member' as const, scheduling_tags: ['volunteer_coordinators'], bookable_override: null, calendar_email_override: 'maya.cal@x' };
const ALEX = { ...base, employee_id: 'e2', email: 'alex@x', name: 'Alex', role: 'member' as const, scheduling_tags: [], bookable_override: 'off' as const, calendar_email_override: null };

beforeEach(() => {
  api.fetchTeamMembers.mockResolvedValue({ members: [MAYA, ALEX], admin_count: 1, total: 2, can_edit: true });
  api.fetchTagVocabulary.mockResolvedValue(['volunteer_coordinators', 'spanish']);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StaffSchedulingSection — admin', () => {
  beforeEach(() => mockUser.mockReturnValue({ role: 'admin', email: 'admin@x' }));

  it('renders the roster with each member + booking-paused state', async () => {
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText(/Booking paused/)).toBeInTheDocument(); // Alex
  });

  it('edits a member: toggles a tag + sets calendar email → PATCH with all admin fields', async () => {
    api.updateEmployeeScheduling.mockResolvedValue({
      employee_id: 'e1', scheduling_tags: ['volunteer_coordinators', 'spanish'],
      bookable_override: null, calendar_email_override: 'new@x',
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());

    // open Maya's editor (first Edit button)
    await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    await userEvent.click(screen.getByLabelText('spanish')); // add the spanish tag
    const email = screen.getByLabelText('Calendar email');
    await userEvent.clear(email);
    await userEvent.type(email, 'new@x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e1', {
      scheduling_tags: ['volunteer_coordinators', 'spanish'],
      bookable_override: null,
      calendar_email_override: 'new@x',
    });
  });

  it('surfaces a 422 unknown-tag error', async () => {
    api.updateEmployeeScheduling.mockRejectedValue(new SchedulingApiError(422, 'bad', ['typo']));
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Maya')).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Unknown tag\(s\): typo/i));
  });

  it('shows a load error without crashing', async () => {
    api.fetchTeamMembers.mockRejectedValue(new Error('boom'));
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load staff: boom/i));
  });

  it('flags the D3 v1-MUST warnings (connect-calendar + not-on-team) and none for a bookable member', async () => {
    api.fetchTeamMembers.mockResolvedValue({
      members: [
        { ...base, employee_id: 'c1', email: 'cal@x', name: 'Needs Cal', role: 'member' as const, scheduling_tags: ['volunteer_coordinators'], bookable_override: null, calendar_connected: false },
        { ...base, employee_id: 'c2', email: 'team@x', name: 'Needs Team', role: 'member' as const, scheduling_tags: [], bookable_override: null, calendar_connected: true },
        { ...base, employee_id: 'c3', email: 'ok@x', name: 'All Set', role: 'member' as const, scheduling_tags: ['volunteer_coordinators'], bookable_override: null, calendar_connected: true },
      ],
      admin_count: 1, total: 3, can_edit: true,
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('Needs Cal')).toBeInTheDocument());

    expect(within(screen.getByText('Needs Cal').closest('div')!).getByText(/Connect calendar to be bookable/)).toBeInTheDocument();
    expect(within(screen.getByText('Needs Team').closest('div')!).getByText(/Not on any team/)).toBeInTheDocument();
    const okRow = screen.getByText('All Set').closest('div')!;
    expect(within(okRow).queryByText(/Connect calendar|Not on any team/)).toBeNull();
  });

  it('filters the roster by booking status', async () => {
    api.fetchTeamMembers.mockResolvedValue({
      members: [
        { ...base, employee_id: 'c1', email: 'cal@x', name: 'Needs Cal', role: 'member' as const, scheduling_tags: ['volunteer_coordinators'], bookable_override: null, calendar_connected: false },
        { ...base, employee_id: 'c3', email: 'ok@x', name: 'All Set', role: 'member' as const, scheduling_tags: ['volunteer_coordinators'], bookable_override: null, calendar_connected: true },
      ],
      admin_count: 1, total: 2, can_edit: true,
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('All Set')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Filter staff'), 'bookable');
    expect(screen.getByText('All Set')).toBeInTheDocument();
    expect(screen.queryByText('Needs Cal')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter staff'), 'missing_connection');
    expect(screen.getByText('Needs Cal')).toBeInTheDocument();
    expect(screen.queryByText('All Set')).not.toBeInTheDocument();
  });
});

// item 7 (audit fix-list): admin roster shows the warning TEXT but NO link
// (linking the admin to their own calendar page from another staff member's row
//  would be misleading — the audit mandated removal).
describe('StaffSchedulingSection — admin roster CTA link removal (item 7)', () => {
  beforeEach(() => {
    mockUser.mockReturnValue({ role: 'admin', email: 'admin@x' });
    api.fetchTagVocabulary.mockResolvedValue([]);
  });

  it('admin roster: warning text present but no "Integrations" connect link', async () => {
    api.fetchTeamMembers.mockResolvedValue({
      members: [
        {
          ...base, employee_id: 'c1', email: 'staff@x', name: 'NoCalStaff',
          role: 'member' as const, scheduling_tags: ['volunteer_coordinators'],
          bookable_override: null, calendar_email_override: null,
          calendar_connected: false,
        },
      ],
      admin_count: 1, total: 1, can_edit: true,
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByText('NoCalStaff')).toBeInTheDocument());
    // Warning text appears
    expect(screen.getByText(/Connect calendar to be bookable/i)).toBeInTheDocument();
    // No Integrations connect link — admin roster deliberately omits it
    expect(screen.queryByRole('link', { name: /integrations/i })).toBeNull();
  });
});

describe('StaffSchedulingSection — member (self-service)', () => {
  beforeEach(() => mockUser.mockReturnValue({ role: 'member', email: 'maya@x' }));

  it('shows only the own calendar-email card and PATCHes just that field', async () => {
    api.updateEmployeeScheduling.mockResolvedValue({ employee_id: 'e1', calendar_email_override: 'mine@x' });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /my scheduling/i })).toBeInTheDocument());
    // does NOT render the admin roster heading
    expect(screen.queryByText('Alex')).not.toBeInTheDocument();
    expect(api.fetchTagVocabulary).not.toHaveBeenCalled(); // member never reads the admin vocab

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const email = screen.getByLabelText('Calendar email');
    await userEvent.clear(email);
    await userEvent.type(email, 'mine@x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(api.updateEmployeeScheduling).toHaveBeenCalledTimes(1));
    expect(api.updateEmployeeScheduling).toHaveBeenCalledWith('e1', { calendar_email_override: 'mine@x' });
  });

  it('surfaces the D3 warning on the member self-view when they are half-configured', async () => {
    // Maya is on a team (volunteer_coordinators) but has not connected a calendar →
    // the "connect calendar" v1-MUST warning must show on her OWN view, not only the admin roster.
    api.fetchTeamMembers.mockResolvedValue({
      members: [{ ...MAYA, calendar_connected: false }],
      admin_count: 1, total: 1, can_edit: true,
    });
    render(<StaffSchedulingSection />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /my scheduling/i })).toBeInTheDocument());
    expect(screen.getByText(/Connect calendar to be bookable/)).toBeInTheDocument();
  });
});

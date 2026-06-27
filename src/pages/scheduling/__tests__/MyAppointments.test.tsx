import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyAppointments } from '../MyAppointments';
import type { Booking, SchedulingViewer } from '../../../types/scheduling';

// The Lead Workspace overlay is reused from the Forms page; stub it so we can assert how
// MyAppointments opens it (leadId/isOpen) without its fetch/focus-trap machinery.
vi.mock('../../../components/lead-workspace', () => ({
  LeadWorkspaceDrawer: ({ leadId, isOpen }: { leadId: string | null; isOpen: boolean }) => (
    <div data-testid="lead-drawer" data-leadid={leadId ?? ''} data-open={String(isOpen)} />
  ),
}));

// BookingActions is separately tested and self-gates; stub it out of these render tests.
vi.mock('../../../components/scheduling/BookingActions', () => ({
  BookingActions: () => null,
}));

const NOW = Date.parse('2026-06-15T12:00:00Z');
const admin: SchedulingViewer = { role: 'admin', email: 'admin@example.invalid' };

const bookings: Booking[] = [
  {
    booking_id: 'a',
    status: 'booked',
    start_at: '2026-06-15T16:00:00Z', // today (after NOW) → upcoming
    end_at: '2026-06-15T16:30:00Z',
    coordinator_email: 'alice@example.invalid',
    appointment_type_id: 'intro',
    attendee: { name: 'Marcus Bell', email: 'marcus@example.invalid', phone: '(404) 555-0109' },
    html_link: 'https://calendar.google.com/event?id=a',
    submission_id: 'sub-1',
  },
  {
    booking_id: 'b',
    status: 'booked',
    start_at: '2026-06-16T15:00:00Z', // tomorrow → upcoming
    end_at: '2026-06-16T15:45:00Z',
    coordinator_email: 'alice@example.invalid',
    appointment_type_id: 'intro',
    attendee: { name: 'Lena Cho', email: 'lena@example.invalid' },
    // no submission_id → "Open Contact" must self-disable
  },
  {
    booking_id: 'c',
    status: 'completed',
    start_at: '2026-06-10T15:00:00Z', // past
    coordinator_email: 'alice@example.invalid',
    appointment_type_id: 'intro',
    attendee: { name: 'Tomas Vega', email: 'tomas@example.invalid' },
  },
];

const names = { intro: 'Intro Call' };

afterEach(cleanup);

describe('MyAppointments (employee scheduling view)', () => {
  it('default upcoming scope lists upcoming appointments, not past ones', () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    const list = screen.getByRole('list', { name: /appointments/i });
    expect(within(list).getByText('Marcus Bell')).toBeInTheDocument();
    expect(within(list).getByText('Lena Cho')).toBeInTheDocument();
    expect(within(list).queryByText('Tomas Vega')).toBeNull();
  });

  it('the Past scope chip switches the list to past appointments', async () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: /^past/i }));
    const list = screen.getByRole('list', { name: /appointments/i });
    expect(within(list).getByText('Tomas Vega')).toBeInTheDocument();
    expect(within(list).queryByText('Marcus Bell')).toBeNull();
  });

  it('auto-selects the first appointment and shows its contact in the preview', () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    // Email is rendered only in the preview pane (mailto link).
    expect(screen.getByRole('link', { name: 'marcus@example.invalid' })).toBeInTheDocument();
  });

  it('selecting a different row updates the preview', async () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    const list = screen.getByRole('list', { name: /appointments/i });
    await userEvent.click(within(list).getByText('Lena Cho'));
    expect(screen.getByRole('link', { name: 'lena@example.invalid' })).toBeInTheDocument();
  });

  it('search filters the list by attendee name', async () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    await userEvent.type(screen.getByRole('searchbox', { name: /search appointments/i }), 'lena');
    const list = screen.getByRole('list', { name: /appointments/i });
    expect(within(list).getByText('Lena Cho')).toBeInTheDocument();
    expect(within(list).queryByText('Marcus Bell')).toBeNull();
  });

  it('"Open Contact" is enabled only when the booking carries a lead link, and opens the reused drawer', async () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    // First selection = Marcus (has submission_id) → enabled.
    const openContact = screen.getByRole('button', { name: /open contact/i });
    expect(openContact).toBeEnabled();
    await userEvent.click(openContact);
    const drawer = screen.getByTestId('lead-drawer');
    expect(drawer).toHaveAttribute('data-open', 'true');
    expect(drawer).toHaveAttribute('data-leadid', 'sub-1');
  });

  it('"Open Contact" self-disables for a booking with no lead link', async () => {
    render(<MyAppointments bookings={bookings} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    const list = screen.getByRole('list', { name: /appointments/i });
    await userEvent.click(within(list).getByText('Lena Cho')); // no submission_id
    expect(screen.getByRole('button', { name: /open contact/i })).toBeDisabled();
  });

  it('permission filter: a staff member sees only their own bookings (empty for an unmatched email)', () => {
    render(
      <MyAppointments
        bookings={bookings}
        viewer={{ role: 'member', email: 'nobody@example.invalid' }}
        appointmentTypeNames={names}
        now={NOW}
      />,
    );
    expect(screen.getByText(/no appointments match these filters/i)).toBeInTheDocument();
  });

  it('marks an attendee "Returning" when their email recurs across bookings', () => {
    const recurring: Booking[] = [
      ...bookings,
      {
        booking_id: 'd',
        status: 'booked',
        start_at: '2026-06-17T15:00:00Z',
        coordinator_email: 'alice@example.invalid',
        appointment_type_id: 'intro',
        attendee: { name: 'Marcus Bell', email: 'marcus@example.invalid' }, // 2nd Marcus booking → Returning
      },
    ];
    render(<MyAppointments bookings={recurring} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    const list = screen.getByRole('list', { name: /appointments/i });
    expect(within(list).getAllByText('Returning').length).toBeGreaterThanOrEqual(1);
  });

  it('the program filter narrows the list to one appointment type', async () => {
    const mixed: Booking[] = [
      { booking_id: 'p1', status: 'booked', start_at: '2026-06-15T16:00:00Z', coordinator_email: 'alice@example.invalid', appointment_type_id: 'intro', attendee: { name: 'Intro Person', email: 'i@example.invalid' } },
      { booking_id: 'p2', status: 'booked', start_at: '2026-06-16T16:00:00Z', coordinator_email: 'alice@example.invalid', appointment_type_id: 'tour', attendee: { name: 'Tour Person', email: 't@example.invalid' } },
    ];
    render(<MyAppointments bookings={mixed} viewer={admin} appointmentTypeNames={{ intro: 'Intro Call', tour: 'Facility Tour' }} now={NOW} />);
    await userEvent.selectOptions(screen.getByLabelText(/filter by program/i), 'tour');
    const list = screen.getByRole('list', { name: /appointments/i });
    expect(within(list).getByText('Tour Person')).toBeInTheDocument();
    expect(within(list).queryByText('Intro Person')).toBeNull();
  });

  it('shows a derived "Booked ·" last-touch from created_at', () => {
    const withCreated: Booking[] = [
      { booking_id: 'lt', status: 'booked', start_at: '2026-06-16T16:00:00Z', created_at: '2026-06-13T12:00:00Z', coordinator_email: 'alice@example.invalid', appointment_type_id: 'intro', attendee: { name: 'Timed Person', email: 'tp@example.invalid' } },
    ];
    render(<MyAppointments bookings={withCreated} viewer={admin} appointmentTypeNames={names} now={NOW} />);
    // NOW = 2026-06-15, created 2026-06-13 → "2 days ago" (rendered in the row and the preview).
    expect(screen.getAllByText(/Booked · 2 days ago/i).length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// BookingActions (rendered inside each card) calls the real cancel API — stub it so the
// page-level onActionComplete→reload wiring can be exercised without a network call.
const api = { cancelBooking: vi.fn(), sendRescheduleLink: vi.fn() };
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual,
    cancelBooking: (...a: unknown[]) => api.cancelBooking(...a),
    sendRescheduleLink: (...a: unknown[]) => api.sendRescheduleLink(...a),
  };
});

import { MyBookings } from '../MyBookings';
import {
  allBookings,
  appointmentTypeNames,
} from '../../../test/fixtures/schedulingFixture';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A `now` before all WS-FIX June rows so they land in the "upcoming" default range.
const NOW_EARLY = Date.parse('2026-06-01T00:00:00Z');

describe('MyBookings (Surface 2)', () => {
  it('admin sees bookings across all staff; default range is upcoming', () => {
    render(
      <MyBookings
        bookings={allBookings}
        viewer={{ role: 'admin' }}
        appointmentTypeNames={appointmentTypeNames}
        now={NOW_EARLY}
      />,
    );
    const list = screen.getByRole('list');
    // The 3 WS-FIX booked rows are all upcoming relative to NOW_EARLY.
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    // maya coordinates 2 of the 3 WS-FIX rows, alex 1 → both staff visible to admin.
    expect(within(list).getAllByText('maya.fixture@example.invalid').length).toBeGreaterThanOrEqual(2);
    expect(within(list).getAllByText('alex.fixture@example.invalid').length).toBeGreaterThanOrEqual(1);
  });

  it('permission: a staff member sees only their own bookings', () => {
    render(
      <MyBookings
        bookings={allBookings}
        viewer={{ role: 'member', email: 'maya.fixture@example.invalid' }}
        appointmentTypeNames={appointmentTypeNames}
        now={NOW_EARLY}
      />,
    );
    const list = screen.getByRole('list');
    expect(within(list).queryByText('alex.fixture@example.invalid', { exact: false })).toBeNull();
    expect(within(list).getAllByText('maya.fixture@example.invalid', { exact: false }).length).toBeGreaterThan(0);
  });

  it('empty state shows when filters match nothing (staff with no identity)', () => {
    render(<MyBookings bookings={allBookings} viewer={{ role: 'member' }} now={NOW_EARLY} />);
    expect(screen.getByText(/no bookings match these filters/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('status filter narrows the list to the chosen status', async () => {
    const user = userEvent.setup();
    // Use a late `now` so completed/canceled rows are reachable across ranges.
    render(
      <MyBookings
        bookings={allBookings}
        viewer={{ role: 'admin' }}
        appointmentTypeNames={appointmentTypeNames}
        now={Date.parse('2026-08-01T00:00:00Z')}
      />,
    );
    // Switch to Past so the June rows are in-range, then filter to Canceled.
    await user.click(screen.getByRole('button', { name: 'Past' }));
    await user.click(screen.getByRole('button', { name: 'Canceled' }));
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(list).getByText('Canceled')).toBeInTheDocument();
  });

  it('threads onActionComplete from the page down to a card cancel (reload wiring)', async () => {
    api.cancelBooking.mockResolvedValue({ booking_id: 'x', status: 'canceled' });
    const onActionComplete = vi.fn();
    render(
      <MyBookings
        bookings={allBookings}
        viewer={{ role: 'member', email: 'maya.fixture@example.invalid' }}
        appointmentTypeNames={appointmentTypeNames}
        now={NOW_EARLY}
        onActionComplete={onActionComplete}
      />,
    );
    // Maya owns upcoming booked rows → each card exposes a Cancel button.
    await userEvent.click(screen.getAllByRole('button', { name: /cancel booking/i })[0]);
    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'rescheduling');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));
    // The page-supplied callback fires → SchedulingPage would call useBookings.reload().
    await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));
  });
});

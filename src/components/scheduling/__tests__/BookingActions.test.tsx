import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulingApiError } from '../../../services/schedulingApi';
import type { Booking, SchedulingViewer } from '../../../types/scheduling';

const api = {
  cancelBooking: vi.fn(),
  sendRescheduleLink: vi.fn(),
};
vi.mock('../../../services/schedulingApi', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schedulingApi')>(
    '../../../services/schedulingApi',
  );
  return {
    ...actual, // keep SchedulingApiError real
    cancelBooking: (...a: unknown[]) => api.cancelBooking(...a),
    sendRescheduleLink: (...a: unknown[]) => api.sendRescheduleLink(...a),
  };
});

import { BookingActions } from '../BookingActions';

const booking: Booking = {
  booking_id: 'booking#abc',
  status: 'booked',
  start_at: '2026-07-01T15:00:00Z',
  coordinator_email: 'maya@example.invalid',
};
const owner: SchedulingViewer = { role: 'member', email: 'maya@example.invalid' };
const admin: SchedulingViewer = { role: 'admin', email: 'boss@example.invalid' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BookingActions (§E12-actions / G6)', () => {
  it('renders nothing for a terminal-status booking', () => {
    const { container } = render(
      <BookingActions booking={{ ...booking, status: 'canceled' }} viewer={owner} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a non-owner non-admin (§8 gate)', () => {
    const { container } = render(
      <BookingActions booking={booking} viewer={{ role: 'member', email: 'other@example.invalid' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('an admin may act on any in-tenant booking (override)', () => {
    render(<BookingActions booking={booking} viewer={admin} />);
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reschedule link/i })).toBeInTheDocument();
  });

  it('cancels with a reason (passes the raw booking_id) and notifies the parent', async () => {
    api.cancelBooking.mockResolvedValue({ booking_id: booking.booking_id, status: 'canceled' });
    const onActionComplete = vi.fn();
    render(<BookingActions booking={booking} viewer={owner} onActionComplete={onActionComplete} />);

    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'Coordinator out sick');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));

    await waitFor(() =>
      expect(api.cancelBooking).toHaveBeenCalledWith('booking#abc', 'Coordinator out sick'),
    );
    expect(onActionComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks Confirm cancel until a reason is entered', async () => {
    render(<BookingActions booking={booking} viewer={owner} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    expect(screen.getByRole('button', { name: /confirm cancel/i })).toBeDisabled();
  });

  it('surfaces the 409 terminal error from a cancel', async () => {
    api.cancelBooking.mockRejectedValue(new SchedulingApiError(409, 'terminal'));
    render(<BookingActions booking={booking} viewer={owner} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'too late');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already closed/i));
  });

  it('sends a reschedule link and confirms it (raw booking_id)', async () => {
    api.sendRescheduleLink.mockResolvedValue({ booking_id: booking.booking_id, sent: true });
    render(<BookingActions booking={booking} viewer={owner} />);
    await userEvent.click(screen.getByRole('button', { name: /send reschedule link/i }));
    await waitFor(() => expect(api.sendRescheduleLink).toHaveBeenCalledWith('booking#abc'));
    expect(screen.getByRole('status')).toHaveTextContent(/sent to the guest/i);
  });

  it('surfaces the 429 cooldown on reschedule-link', async () => {
    api.sendRescheduleLink.mockRejectedValue(new SchedulingApiError(429, 'rate limited'));
    render(<BookingActions booking={booking} viewer={owner} />);
    await userEvent.click(screen.getByRole('button', { name: /send reschedule link/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/try again in about a minute/i),
    );
  });

  it('maps the backend 404 (non-owner, no-enumeration oracle) to a non-leaky message and does NOT refetch', async () => {
    // Backend returns 404 (not 403) for a booking the viewer can't touch — the UX gate let
    // this through (e.g. stale ownership). The message must not reveal the booking exists.
    api.cancelBooking.mockRejectedValue(new SchedulingApiError(404, 'not found'));
    const onActionComplete = vi.fn();
    render(<BookingActions booking={booking} viewer={owner} onActionComplete={onActionComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'no longer needed');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/can't change this booking/i));
    expect(onActionComplete).not.toHaveBeenCalled(); // failed cancel must not trigger a refetch
  });

  it('tolerates a 202 pending_calendar_sync cancel result (still closes the modal + refetches)', async () => {
    // The cancel was accepted but the calendar delete is async (the §14.2 listener flips status).
    // The component treats it as success: notify the parent so the row re-fetches.
    api.cancelBooking.mockResolvedValue({ booking_id: booking.booking_id, status: 'pending_calendar_sync' });
    const onActionComplete = vi.fn();
    render(<BookingActions booking={booking} viewer={owner} onActionComplete={onActionComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'rebooking');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));
    await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));
    // modal closed → the reason textarea is gone
    expect(screen.queryByLabelText(/reason for cancelling/i)).not.toBeInTheDocument();
  });

  it('reports a reschedule link that could not be delivered (sent:false)', async () => {
    api.sendRescheduleLink.mockResolvedValue({ booking_id: booking.booking_id, sent: false });
    render(<BookingActions booking={booking} viewer={owner} />);
    await userEvent.click(screen.getByRole('button', { name: /send reschedule link/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/could not be delivered/i));
  });
});

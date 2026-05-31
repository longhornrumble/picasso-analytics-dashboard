import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusChip } from '../StatusChip';
import { BOOKING_STATUSES } from '../../../types/scheduling';

afterEach(cleanup);

describe('StatusChip', () => {
  it('renders a text label for every Booking.status (never color-only)', () => {
    const labels: Record<string, string> = {
      booked: 'Booked',
      completed: 'Completed',
      no_show: 'No-show',
      canceled: 'Canceled',
      coordinator_no_show: "Didn't connect",
    };
    for (const status of BOOKING_STATUSES) {
      cleanup();
      render(<StatusChip status={status} />);
      expect(screen.getByText(labels[status])).toBeInTheDocument();
    }
  });

  it('forward-compat: an unknown status renders a neutral "Unknown" chip', () => {
    render(<StatusChip status="some_future_status" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

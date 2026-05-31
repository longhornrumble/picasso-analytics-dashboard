import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BookingCard } from '../BookingCard';
import type { Booking } from '../../../types/scheduling';
import { appointmentTypeNames } from '../../../test/fixtures/schedulingFixture';

afterEach(cleanup);

const base: Booking = {
  booking_id: 'bk_1',
  status: 'booked',
  start_at: '2026-06-03T14:00:00Z',
  end_at: '2026-06-03T14:30:00Z',
  coordinator_email: 'maya.fixture@example.invalid',
  appointment_type_id: 'appt_1to1_discovery_30',
  attendee: { name: 'Fixture Volunteer One', email: 'v1@example.invalid' },
};

describe('BookingCard', () => {
  it('renders the appointment type label, attendee, coordinator, and status', () => {
    render(<BookingCard booking={base} appointmentTypeNames={appointmentTypeNames} />);
    expect(screen.getByText('Discovery Session (30 min)')).toBeInTheDocument();
    expect(screen.getByText('Fixture Volunteer One')).toBeInTheDocument();
    expect(screen.getByText('maya.fixture@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('XSS pass: a malicious attendee name renders as inert text, not markup', () => {
    const evil = '<script>alert(1)</script>';
    const { container } = render(
      <BookingCard booking={{ ...base, attendee: { name: evil } }} />,
    );
    // React escapes it → the literal string is present as text…
    expect(screen.getByText(evil)).toBeInTheDocument();
    // …and no actual <script> element was injected into the DOM.
    expect(container.querySelector('script')).toBeNull();
  });

  it('XSS pass: only an https calendar link becomes an href; javascript: is dropped', () => {
    cleanup();
    render(<BookingCard booking={{ ...base, html_link: 'https://calendar.google.com/event/abc' }} />);
    const link = screen.getByRole('link', { name: /open in google calendar/i });
    expect(link).toHaveAttribute('href', 'https://calendar.google.com/event/abc');

    cleanup();
    render(
      <BookingCard
        booking={{ ...base, booking_id: 'bk_evil', html_link: 'javascript:alert(1)' }}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('forward-compat: a sparse row (no attendee/end_at/type/coordinator/link) renders without throwing', () => {
    const sparse: Booking = { booking_id: 'bk_sparse', status: 'booked', start_at: '2026-06-03T14:00:00Z' };
    render(<BookingCard booking={sparse} />);
    expect(screen.getByText('Guest')).toBeInTheDocument(); // attendee fallback
    expect(screen.getByText('Appointment')).toBeInTheDocument(); // type fallback
    expect(screen.queryByRole('link')).toBeNull(); // no calendar link
  });
});

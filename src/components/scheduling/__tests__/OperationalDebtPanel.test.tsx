import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationalDebtPanel } from '../OperationalDebtPanel';
import type { Booking } from '../../../types/scheduling';

const NOW = Date.parse('2026-02-01T00:00:00Z');

// Two staff, all past 'booked' (awaiting disposition): Maya x2, Alex x1.
const bookings: Booking[] = [
  { booking_id: 'm1', status: 'booked', start_at: '2026-01-10T15:00:00Z', end_at: '2026-01-10T16:00:00Z', coordinator_email: 'maya@x', appointment_type_id: 'at1' },
  { booking_id: 'm2', status: 'booked', start_at: '2026-01-20T15:00:00Z', end_at: '2026-01-20T16:00:00Z', coordinator_email: 'maya@x', appointment_type_id: 'at2' },
  { booking_id: 'a1', status: 'booked', start_at: '2026-01-15T15:00:00Z', end_at: '2026-01-15T16:00:00Z', coordinator_email: 'alex@x', appointment_type_id: 'at1' },
];
const typeNames = { at1: 'Intake call', at2: 'Home visit' };

afterEach(cleanup);

describe('OperationalDebtPanel — §8 staff drill-down', () => {
  it('lists staff rows desc by unresolved count, collapsed by default', () => {
    render(<OperationalDebtPanel bookings={bookings} now={NOW} appointmentTypeNames={typeNames} />);
    const mayaRow = screen.getByRole('button', { name: /maya@x/i });
    expect(mayaRow).toHaveAttribute('aria-expanded', 'false');
    expect(within(mayaRow).getByText('2')).toBeInTheDocument(); // Maya has 2 unresolved
    // the drill content is not rendered until expanded
    expect(screen.queryByText('Intake call')).not.toBeInTheDocument();
  });

  it('drills into a staff row to reveal that member\'s queue, then collapses', async () => {
    render(<OperationalDebtPanel bookings={bookings} now={NOW} appointmentTypeNames={typeNames} />);
    const mayaRow = screen.getByRole('button', { name: /maya@x/i });

    await userEvent.click(mayaRow);
    expect(mayaRow).toHaveAttribute('aria-expanded', 'true');
    // Maya's two appointment types appear; Alex's row is unaffected
    expect(screen.getByText('Intake call')).toBeInTheDocument();
    expect(screen.getByText('Home visit')).toBeInTheDocument();

    await userEvent.click(mayaRow);
    expect(mayaRow).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Home visit')).not.toBeInTheDocument();
  });

  it('opening a second row closes the first (single-open drill)', async () => {
    render(<OperationalDebtPanel bookings={bookings} now={NOW} appointmentTypeNames={typeNames} />);
    await userEvent.click(screen.getByRole('button', { name: /maya@x/i }));
    expect(screen.getByText('Home visit')).toBeInTheDocument(); // Maya open

    await userEvent.click(screen.getByRole('button', { name: /alex@x/i }));
    expect(screen.queryByText('Home visit')).not.toBeInTheDocument(); // Maya collapsed
    expect(screen.getByRole('button', { name: /alex@x/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders no staff section when there is no operational debt', () => {
    render(<OperationalDebtPanel bookings={[]} now={NOW} />);
    expect(screen.queryByText(/by staff member/i)).not.toBeInTheDocument();
  });
});

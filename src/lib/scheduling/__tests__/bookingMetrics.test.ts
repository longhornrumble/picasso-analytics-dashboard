import { describe, it, expect } from 'vitest';
import { computeBookingMetrics, formatRate } from '../bookingLogic';
import { allBookings, FIXTURE_NOW } from '../../../test/fixtures/schedulingFixture';
import type { Booking } from '../../../types/scheduling';

describe('computeBookingMetrics', () => {
  // allBookings = 3 wsFix (booked, June) + 4 extra (completed/canceled/no_show/coord_ns, Jun 2)
  //              + 4 debt (booked, past relative to FIXTURE_NOW 2026-07-15).
  const m = computeBookingMetrics(allBookings, FIXTURE_NOW);

  it('counts totals and per-status', () => {
    expect(m.total).toBe(11);
    expect(m.byStatus).toEqual({
      booked: 7,
      canceled: 1,
      completed: 1,
      no_show: 1,
      coordinator_no_show: 1,
    });
  });

  it('derives dispositioned + rates with explicit denominators', () => {
    expect(m.dispositioned).toBe(3); // completed + no_show + coordinator_no_show
    expect(m.noShowRate).toBeCloseTo(1 / 3, 5);
    expect(m.completionRate).toBeCloseTo(1 / 3, 5);
    expect(m.cancellationRate).toBeCloseTo(1 / 11, 5);
  });

  it('counts upcoming (booked + future) and last-30d volume', () => {
    expect(m.upcoming).toBe(0); // every fixture booking starts before 2026-07-15
    expect(m.last30d).toBe(3); // debt rows at 30h/80h/8d ago; the 40d row is outside the window
  });

  it('returns null rates (not 0) when the denominator is empty', () => {
    const empty = computeBookingMetrics([], FIXTURE_NOW);
    expect(empty.total).toBe(0);
    expect(empty.noShowRate).toBeNull();
    expect(empty.completionRate).toBeNull();
    expect(empty.cancellationRate).toBeNull();
  });

  it('cancellationRate is over all bookings; no-show is over dispositioned only', () => {
    const rows: Booking[] = [
      { booking_id: 'a', status: 'canceled', start_at: '2026-06-01T10:00:00Z' },
      { booking_id: 'b', status: 'completed', start_at: '2026-06-01T11:00:00Z' },
      { booking_id: 'c', status: 'no_show', start_at: '2026-06-01T12:00:00Z' },
    ];
    const r = computeBookingMetrics(rows, FIXTURE_NOW);
    expect(r.cancellationRate).toBeCloseTo(1 / 3, 5); // canceled / total(3)
    expect(r.noShowRate).toBeCloseTo(1 / 2, 5); // no_show / dispositioned(completed+no_show=2)
  });
});

describe('formatRate', () => {
  it('renders percent, rounds, and shows an em-dash for null', () => {
    expect(formatRate(0.25)).toBe('25%');
    expect(formatRate(1 / 3)).toBe('33%');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(null)).toBe('—');
  });
});

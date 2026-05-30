import { describe, it, expect } from 'vitest';
import {
  visibleBookings,
  filterByTimeRange,
  filterByStatus,
  isAwaitingDisposition,
  computeOperationalDebt,
  staffDebtBreakdown,
  statusMeta,
  appointmentTypeLabel,
  formatSlotLabel,
  safeExternalHref,
} from '../bookingLogic';
import type { Booking } from '../../../types/scheduling';
import {
  wsFixBookings,
  debtBookings,
  allBookings,
  FIXTURE_NOW,
} from '../../../test/fixtures/schedulingFixture';

const MAYA = 'maya.fixture@example.invalid';

describe('visibleBookings — §8 permission filter', () => {
  it('admin sees every booking', () => {
    expect(visibleBookings(allBookings, { role: 'admin' })).toHaveLength(allBookings.length);
  });

  it('super_admin sees every booking', () => {
    expect(visibleBookings(allBookings, { role: 'super_admin' })).toHaveLength(allBookings.length);
  });

  it('a staff member sees only their own bookings (joined on coordinator_email)', () => {
    const mine = visibleBookings(allBookings, { role: 'member', email: MAYA });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.coordinator_email === MAYA)).toBe(true);
  });

  it('email match is case-insensitive', () => {
    const mine = visibleBookings(allBookings, { role: 'member', email: MAYA.toUpperCase() });
    expect(mine.every((b) => b.coordinator_email === MAYA)).toBe(true);
    expect(mine.length).toBeGreaterThan(0);
  });

  it('a staff member with no identity sees nothing (safe default)', () => {
    expect(visibleBookings(allBookings, { role: 'member' })).toHaveLength(0);
    expect(visibleBookings(allBookings, {})).toHaveLength(0);
  });
});

describe('filterByTimeRange', () => {
  const now = Date.parse('2026-06-04T12:00:00Z');

  it('upcoming = start_at >= now', () => {
    const r = filterByTimeRange(wsFixBookings, 'upcoming', now);
    expect(r.map((b) => b.booking_id)).toEqual(['bk_fixture_002', 'bk_fixture_003']);
  });

  it('past = start_at < now', () => {
    const r = filterByTimeRange(wsFixBookings, 'past', now);
    expect(r.map((b) => b.booking_id)).toEqual(['bk_fixture_001']);
  });

  it('drops rows with an unparseable start_at', () => {
    const bad: Booking[] = [{ booking_id: 'x', status: 'booked', start_at: 'not-a-date' }];
    expect(filterByTimeRange(bad, 'upcoming', now)).toHaveLength(0);
    expect(filterByTimeRange(bad, 'past', now)).toHaveLength(0);
  });
});

describe('filterByStatus', () => {
  it("'all' passes everything through", () => {
    expect(filterByStatus(allBookings, 'all')).toHaveLength(allBookings.length);
  });
  it('filters to an exact status', () => {
    expect(filterByStatus(allBookings, 'canceled').every((b) => b.status === 'canceled')).toBe(true);
    expect(filterByStatus(allBookings, 'completed')).toHaveLength(1);
  });
});

describe('isAwaitingDisposition', () => {
  it('booked + past end → awaiting', () => {
    const b: Booking = { booking_id: 'a', status: 'booked', start_at: '2026-01-01T00:00:00Z', end_at: '2026-01-01T01:00:00Z' };
    expect(isAwaitingDisposition(b, FIXTURE_NOW)).toBe(true);
  });
  it('booked + future end → not awaiting', () => {
    const b: Booking = { booking_id: 'a', status: 'booked', start_at: '2099-01-01T00:00:00Z' };
    expect(isAwaitingDisposition(b, FIXTURE_NOW)).toBe(false);
  });
  it('non-booked statuses are never awaiting (already dispositioned/canceled)', () => {
    for (const status of ['completed', 'canceled', 'no_show', 'coordinator_no_show'] as const) {
      const b: Booking = { booking_id: 'a', status, start_at: '2026-01-01T00:00:00Z', end_at: '2026-01-01T01:00:00Z' };
      expect(isAwaitingDisposition(b, FIXTURE_NOW)).toBe(false);
    }
  });
  it('forward-compat: end_at absent → falls back to start_at', () => {
    const b: Booking = { booking_id: 'a', status: 'booked', start_at: '2026-01-01T00:00:00Z' };
    expect(isAwaitingDisposition(b, FIXTURE_NOW)).toBe(true);
  });
});

describe('computeOperationalDebt + staffDebtBreakdown — §8 buckets', () => {
  it('buckets the debt fixture deterministically (30h/80h/8d/40d)', () => {
    expect(computeOperationalDebt(debtBookings, FIXTURE_NOW)).toEqual({
      over24h: 4,
      over72h: 3,
      over7d: 2,
      over30d: 1,
      total: 4,
    });
  });

  it('breaks debt down by staff, sorted desc', () => {
    const rows = staffDebtBreakdown(debtBookings, FIXTURE_NOW);
    expect(rows).toEqual([
      { coordinatorEmail: 'maya.fixture@example.invalid', unresolved: 3 },
      { coordinatorEmail: 'alex.fixture@example.invalid', unresolved: 1 },
    ]);
  });
});

describe('display helpers', () => {
  it('statusMeta falls back to a neutral chip for an unknown status', () => {
    expect(statusMeta('some_future_status').label).toBe('Unknown');
    expect(statusMeta('booked').label).toBe('Booked');
  });
  it('appointmentTypeLabel falls back to the id then a generic label', () => {
    expect(appointmentTypeLabel('appt_x', { appt_x: 'Discovery' })).toBe('Discovery');
    expect(appointmentTypeLabel('appt_x', {})).toBe('appt_x');
    expect(appointmentTypeLabel(undefined, undefined)).toBe('Appointment');
  });
  it('formatSlotLabel returns the raw string on an unparseable date', () => {
    expect(formatSlotLabel('not-a-date')).toBe('not-a-date');
  });
  it('safeExternalHref allows only https and blocks scheme injection', () => {
    expect(safeExternalHref('https://calendar.google.com/x')).toBe('https://calendar.google.com/x');
    expect(safeExternalHref('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalHref('http://insecure')).toBeUndefined();
    expect(safeExternalHref(undefined)).toBeUndefined();
  });
});

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
  noShowByAppointmentType,
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

describe('noShowByAppointmentType — §8 per-type no-show slice', () => {
  const b = (
    booking_id: string,
    appointment_type_id: string | undefined,
    status: Booking['status'],
  ): Booking => ({
    booking_id,
    status,
    start_at: '2026-01-01T00:00:00Z',
    ...(appointment_type_id ? { appointment_type_id } : {}),
  });

  it('groups by type, computes no-show/dispositioned rate, sorts by total desc', () => {
    const rows = noShowByAppointmentType([
      b('1', 'A', 'no_show'),
      b('2', 'A', 'completed'),
      b('3', 'A', 'booked'), // not dispositioned → excluded from the rate denominator
      b('4', 'B', 'completed'),
    ]);
    expect(rows.map((r) => r.appointmentTypeId)).toEqual(['A', 'B']); // A:3 total before B:1
    expect(rows[0]).toMatchObject({ total: 3, dispositioned: 2, noShow: 1, noShowRate: 0.5 });
    expect(rows[1]).toMatchObject({ total: 1, dispositioned: 1, noShow: 0, noShowRate: 0 });
  });

  it('reports null rate when a type has no dispositioned bookings', () => {
    const [row] = noShowByAppointmentType([b('1', 'A', 'booked'), b('2', 'A', 'canceled')]);
    expect(row).toMatchObject({ total: 2, dispositioned: 0, noShow: 0, noShowRate: null });
  });

  it("groups bookings missing appointment_type_id under '' (rendered Unspecified)", () => {
    const rows = noShowByAppointmentType([b('1', undefined, 'no_show')]);
    expect(rows[0].appointmentTypeId).toBe('');
  });

  it('matches the fixture distribution (discovery 1/2=50%, interview 0/1=0%)', () => {
    const rows = noShowByAppointmentType(allBookings);
    const disc = rows.find((r) => r.appointmentTypeId === 'appt_1to1_discovery_30')!;
    const intv = rows.find((r) => r.appointmentTypeId === 'appt_1to1_interview_60')!;
    expect(disc).toMatchObject({ total: 7, dispositioned: 2, noShow: 1, noShowRate: 0.5 });
    expect(intv).toMatchObject({ total: 4, dispositioned: 1, noShow: 0, noShowRate: 0 });
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

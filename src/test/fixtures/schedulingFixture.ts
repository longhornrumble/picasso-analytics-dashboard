/**
 * Frontend scheduling fixture for the Customer Portal render surfaces (WS-EUI).
 *
 * MIRRORS the operator-run WS-FIX synthetic seed
 * (scheduling/fixtures/seed-scheduling-fixture.json) — same booking_ids, statuses,
 * dates, coordinator emails and attendee shapes — so component tests render the exact
 * shape the C/E integration tests read from DynamoDB. The seed is a DDB seed (not
 * importable here); this is its frontend twin.
 *
 * Plus: a few extra rows the seed doesn't carry (other Booking.status values for chip
 * coverage, and deterministic past-dated rows for the operational-debt age buckets).
 * All PII-shaped fields are fabricated (RFC-2606 example.invalid + +1555 numbers).
 */
import type { Booking } from '../../types/scheduling';

/** Fixed reference instant for deterministic operational-debt bucketing in tests. */
export const FIXTURE_NOW = Date.parse('2026-07-15T12:00:00Z');

const iso = (offsetMs: number): string => new Date(FIXTURE_NOW - offsetMs).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Exact mirror of the 3 WS-FIX seed Booking rows (all status=booked). */
export const wsFixBookings: Booking[] = [
  {
    booking_id: 'bk_fixture_001',
    tenantId: 'TEN-SCHED-FIXTURE',
    status: 'booked',
    start_at: '2026-06-03T14:00:00Z',
    end_at: '2026-06-03T14:30:00Z',
    coordinator_email: 'maya.fixture@example.invalid',
    resource_id: 'res_maya',
    appointment_type_id: 'appt_1to1_discovery_30',
    routing_policy_id: 'rp_round_robin',
    attendee: {
      name: 'Fixture Volunteer One',
      email: 'vol1.fixture@example.invalid',
      phone: '+15555550001',
    },
    created_at: '2026-06-01T09:00:00Z',
    last_calendar_mutation_at: '2026-06-01T09:00:00Z',
  },
  {
    booking_id: 'bk_fixture_002',
    tenantId: 'TEN-SCHED-FIXTURE',
    status: 'booked',
    start_at: '2026-06-04T16:00:00Z',
    end_at: '2026-06-04T17:00:00Z',
    coordinator_email: 'alex.fixture@example.invalid',
    resource_id: 'res_alex',
    appointment_type_id: 'appt_1to1_interview_60',
    routing_policy_id: 'rp_first_available',
    attendee: {
      name: 'Fixture Volunteer Two',
      email: 'vol2.fixture@example.invalid',
      phone: '+15555550002',
    },
    created_at: '2026-06-01T09:05:00Z',
    last_calendar_mutation_at: '2026-06-01T09:05:00Z',
  },
  {
    booking_id: 'bk_fixture_003',
    tenantId: 'TEN-SCHED-FIXTURE',
    status: 'booked',
    start_at: '2026-06-05T18:00:00Z',
    end_at: '2026-06-05T18:30:00Z',
    coordinator_email: 'maya.fixture@example.invalid',
    resource_id: 'res_maya',
    appointment_type_id: 'appt_1to1_discovery_30',
    routing_policy_id: 'rp_round_robin',
    attendee: {
      name: 'Fixture Volunteer Three',
      email: 'vol3.fixture@example.invalid',
      phone: '+15555550003',
    },
    created_at: '2026-06-01T09:10:00Z',
    last_calendar_mutation_at: '2026-06-01T09:10:00Z',
  },
];

/** One booking per remaining Booking.status, for status-chip + status-filter coverage. */
export const extraStatusBookings: Booking[] = [
  {
    booking_id: 'bk_done_001',
    status: 'completed',
    start_at: '2026-06-02T15:00:00Z',
    end_at: '2026-06-02T15:30:00Z',
    coordinator_email: 'maya.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_discovery_30',
    attendee: { name: 'Disposed Volunteer', email: 'done@example.invalid' },
  },
  {
    booking_id: 'bk_cancel_001',
    status: 'canceled',
    start_at: '2026-06-02T16:00:00Z',
    end_at: '2026-06-02T16:30:00Z',
    coordinator_email: 'alex.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_interview_60',
    attendee: { name: 'Canceled Volunteer', email: 'cancel@example.invalid' },
  },
  {
    booking_id: 'bk_noshow_001',
    status: 'no_show',
    start_at: '2026-06-02T17:00:00Z',
    end_at: '2026-06-02T17:30:00Z',
    coordinator_email: 'maya.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_discovery_30',
    attendee: { name: 'No-show Volunteer', email: 'noshow@example.invalid' },
  },
  {
    booking_id: 'bk_coordns_001',
    status: 'coordinator_no_show',
    start_at: '2026-06-02T18:00:00Z',
    end_at: '2026-06-02T18:30:00Z',
    coordinator_email: 'alex.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_interview_60',
    attendee: { name: 'Didnt-connect Volunteer', email: 'dc@example.invalid' },
  },
];

/**
 * Deterministic past-dated booked rows whose event ENDED before FIXTURE_NOW, for the
 * operational-debt age buckets. Ages: 30h / 80h / 8d / 40d.
 * Expected computeOperationalDebt(debtBookings, FIXTURE_NOW):
 *   over24h:4, over72h:3, over7d:2, over30d:1, total:4. By staff: maya 3, alex 1.
 */
export const debtBookings: Booking[] = [
  {
    booking_id: 'bk_debt_30h',
    status: 'booked',
    start_at: iso(30 * HOUR + 30 * 60 * 1000),
    end_at: iso(30 * HOUR),
    coordinator_email: 'maya.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_discovery_30',
    attendee: { name: 'Debt 30h', email: 'd30@example.invalid' },
  },
  {
    booking_id: 'bk_debt_80h',
    status: 'booked',
    start_at: iso(80 * HOUR + 30 * 60 * 1000),
    end_at: iso(80 * HOUR),
    coordinator_email: 'maya.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_discovery_30',
    attendee: { name: 'Debt 80h', email: 'd80@example.invalid' },
  },
  {
    booking_id: 'bk_debt_8d',
    status: 'booked',
    start_at: iso(8 * DAY + 30 * 60 * 1000),
    end_at: iso(8 * DAY),
    coordinator_email: 'alex.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_interview_60',
    attendee: { name: 'Debt 8d', email: 'd8@example.invalid' },
  },
  {
    booking_id: 'bk_debt_40d',
    status: 'booked',
    start_at: iso(40 * DAY + 30 * 60 * 1000),
    end_at: iso(40 * DAY),
    coordinator_email: 'maya.fixture@example.invalid',
    appointment_type_id: 'appt_1to1_discovery_30',
    attendee: { name: 'Debt 40d', email: 'd40@example.invalid' },
  },
];

export const allBookings: Booking[] = [
  ...wsFixBookings,
  ...extraStatusBookings,
  ...debtBookings,
];

/** appointment_type_id → display name (mirrors the WS-FIX appointmentType table). */
export const appointmentTypeNames: Record<string, string> = {
  appt_1to1_discovery_30: 'Discovery Session (30 min)',
  appt_1to1_interview_60: 'Volunteer Interview (60 min)',
};

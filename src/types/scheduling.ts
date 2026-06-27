/**
 * Scheduling types — Customer Portal (WS-EUI, sub-phase E render slice).
 *
 * Source of truth: scheduling/docs/FROZEN_CONTRACTS.md §A (LOCKED) — the Booking
 * table shape + the 5-value Booking.status vocabulary. These mirror the WS-FIX
 * synthetic fixture (scheduling/fixtures/seed-scheduling-fixture.json).
 *
 * Schema discipline (CLAUDE.md): every optional field may be ABSENT on older rows.
 * Readers must tolerate missing fields — never bracket-access an optional field.
 */

/**
 * The ONLY 5 Booking.status values (FROZEN_CONTRACTS §A; CI-3c locks this list).
 * Note the US single-l spelling `canceled` — canonical wins.
 *
 * `pending_attendance` is intentionally NOT here: it is a *session* state, not a
 * Booking.status (FROZEN_CONTRACTS §A + ui_plan §4). "Awaiting disposition" is
 * DERIVED from a Booking row (status === 'booked' AND the event end is in the past),
 * see bookingLogic.isAwaitingDisposition.
 */
export const BOOKING_STATUSES = [
  'booked',
  'canceled',
  'completed',
  'no_show',
  'coordinator_no_show',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface BookingAttendee {
  /** Volunteer/guest display name — USER-GENERATED (rendered as text only; never as HTML/href). */
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * A Booking row per FROZEN_CONTRACTS §A (PK `tenantId` · SK `booking_id`),
 * shaped to the WS-FIX fixture. All non-key fields optional for forward-compat.
 */
export interface Booking {
  booking_id: string;
  tenantId?: string;
  status: BookingStatus;
  /** ISO8601 start. The one field §A guarantees present alongside the keys + status. */
  start_at: string;
  /** ISO8601 end. May be absent on older rows; callers fall back to start_at. */
  end_at?: string;
  coordinator_email?: string;
  resource_id?: string;
  appointment_type_id?: string;
  routing_policy_id?: string;
  attendee?: BookingAttendee;
  created_at?: string;
  last_calendar_mutation_at?: string;
  /** Native Google Calendar event link, when present ("Open in Google Calendar"). */
  html_link?: string;
  /**
   * Lead summary, joined server-side from the booking's form submission (via session_id)
   * when the request opts in with `include_lead=1`. Best-effort + forward-compat: ABSENT
   * when no submission is linked or the join is unavailable — every reader must tolerate
   * its absence (the Lead Workspace then shows empty states for these fields).
   */
  lead?: BookingLead;
}

/** Compact lead summary attached to a Booking by the §E7 read-join (all fields optional). */
export interface BookingLead {
  /** Form-submission id of the linked lead. */
  submission_id?: string;
  /** The form's title (e.g. "Mentor Application") — shown as the workspace subtitle. */
  app_name?: string;
  /** Heuristic free-text "what they want to talk about". */
  note?: string;
  /** Capitalized pipeline status (New / Reviewing / Contacted / Disqualified / Advancing). */
  phase?: string;
  /** Most recent touch (contacted_at, else submitted_at) — ISO8601. */
  last_touch?: string;
  /** When the lead's form was submitted — ISO8601. */
  submitted_at?: string;
  /** The lead's form responses, label/value. */
  fields?: { label: string; value: string }[];
}

/** Minimal AppointmentType projection used to label a booking's type by id. */
export interface AppointmentTypeLite {
  appointment_type_id: string;
  name: string;
}

/** The viewer identity the permission filter needs (UI plan §8 permissions matrix). */
export interface SchedulingViewer {
  /** Clerk/JWT role; admin + super_admin see all, member sees own. */
  role?: 'super_admin' | 'admin' | 'member';
  /** Used to join a staff viewer to their bookings via coordinator_email (render-slice). */
  email?: string;
}

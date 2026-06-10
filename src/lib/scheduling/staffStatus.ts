/**
 * Per-staff scheduling status derivation (E13 / ui_plan Surface 3, D3).
 *
 * Pure function over a TeamMember's §E13c fields — no React/API — so the D3 warnings
 * and the roster filter are unit-testable and rendered identically.
 *
 * `bookable` is DERIVED (never stored): a connected calendar AND >=1 team AND not paused
 * (§E13c: bookable_override only force-OFFs). The two v1-MUST warnings flag a member who is
 * a scheduling PARTICIPANT (on a team OR has connected a calendar) but is half-configured:
 *   - needsCalendar: on a team but no connected calendar → can't be booked until they connect.
 *   - needsTeam:     connected a calendar but on no team → won't be routed to.
 *
 * Note on the §E13c-addendum shorthand ("connect-calendar = !calendar_connected"): we gate
 * BOTH warnings on participation so a general staff member who was never meant to be bookable
 * (no team, no calendar) shows NO warning — firing "connect your calendar" at everyone would
 * be noise, not a signal. A paused member (bookable_override 'off') is intentionally not
 * bookable, so its warnings are suppressed too.
 */
import type { TeamMember } from '../../types/analytics';

export interface StaffSchedulingStatus {
  /** On a team OR has a connected calendar — i.e. meant to take bookings. */
  isParticipant: boolean;
  /** Connected calendar AND on >=1 team AND not paused. */
  bookable: boolean;
  /** v1-MUST D3 warning: on a team but no connected calendar. */
  needsCalendar: boolean;
  /** v1-MUST D3 warning: connected a calendar but on no team. */
  needsTeam: boolean;
  paused: boolean;
}

export function staffSchedulingStatus(m: TeamMember): StaffSchedulingStatus {
  const tagged = (m.scheduling_tags?.length ?? 0) > 0;
  const connected = m.calendar_connected === true;
  const paused = m.bookable_override === 'off';
  return {
    isParticipant: tagged || connected,
    bookable: connected && tagged && !paused,
    needsCalendar: !paused && tagged && !connected,
    needsTeam: !paused && connected && !tagged,
    paused,
  };
}

/** The single D3 warning to surface for a member (the two cases are mutually exclusive), or null. */
export function staffWarning(s: StaffSchedulingStatus): string | null {
  if (s.needsCalendar) return 'Connect calendar to be bookable';
  if (s.needsTeam) return 'Not on any team';
  return null;
}

export type StaffFilter = 'all' | 'bookable' | 'not_bookable' | 'missing_connection';

/** Roster filter predicate (ui_plan Surface 3 "should": bookable / not-bookable / missing-connection). */
export function matchesStaffFilter(s: StaffSchedulingStatus, filter: StaffFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'bookable':
      return s.bookable;
    case 'not_bookable':
      return !s.bookable;
    case 'missing_connection':
      return s.needsCalendar;
  }
}

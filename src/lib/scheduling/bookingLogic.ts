/**
 * Pure booking logic for the Customer Portal scheduling surfaces (WS-EUI).
 *
 * NO React, NO API, NO DB — pure functions over Booking rows (FROZEN_CONTRACTS §A),
 * so they can be unit-tested with a fixed `now` and rendered the same in tests and app.
 *
 * Covers: status display metadata (ui_plan §4), the §8 permission filter, the
 * Surface-2 time-range / status filters, and the Surface-8 operational-debt derivation
 * (ui_plan §8 / §249 — "awaiting disposition" derived from booked-but-past rows).
 */

import type {
  Booking,
  BookingStatus,
  SchedulingViewer,
} from '../../types/scheduling';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Display metadata per Booking.status. ui_plan §4 maps to picasso semantic colors. */
export interface StatusMeta {
  label: string;
  /** Tailwind chip classes (bg + text). Mirrors shared BadgeCell idiom. */
  chipClass: string;
}

/**
 * ui_plan §4 status-chip mapping → existing picasso palette (CLAUDE.md semantic colors):
 *   success=emerald, warning=amber, neutral-muted=gray, info=blue.
 * Always text-LABELED in addition to color (WCAG: never color alone).
 */
export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  booked: { label: 'Booked', chipClass: 'bg-primary-50 text-primary-700' },
  completed: { label: 'Completed', chipClass: 'bg-primary-50 text-primary-700' },
  no_show: { label: 'No-show', chipClass: 'bg-amber-50 text-amber-700' },
  canceled: { label: 'Canceled', chipClass: 'bg-gray-100 text-gray-600' },
  coordinator_no_show: { label: "Didn't connect", chipClass: 'bg-blue-50 text-blue-700' },
};

/** Neutral fallback for an unknown status value (forward-compat: a future 6th status). */
export const UNKNOWN_STATUS_META: StatusMeta = {
  label: 'Unknown',
  chipClass: 'bg-gray-100 text-gray-600',
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as BookingStatus] ?? UNKNOWN_STATUS_META;
}

/**
 * §8 permission filter. Admin / super_admin see every booking; a staff member
 * (member, or any non-admin) sees only their own, joined on coordinator_email.
 *
 * Safe default: if a staff viewer has no email we cannot establish identity, so we
 * return NOTHING (mirrors ui_plan §8 API contract: staff_self rejects when sub is null).
 *
 * NOTE (render slice): the live build joins on the JWT `sub` / assigned_staff_id claim;
 * the Booking row carries coordinator_email / resource_id (no assigned_staff_id), so this
 * slice joins on coordinator_email. The exact claim mapping is finalized in sub-phase E's
 * Analytics_Dashboard_API wiring.
 */
export function visibleBookings(
  bookings: Booking[],
  viewer: SchedulingViewer,
): Booking[] {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return bookings;
  const email = viewer.email?.toLowerCase();
  if (!email) return [];
  return bookings.filter((b) => b.coordinator_email?.toLowerCase() === email);
}

// ---------------------------------------------------------------------------
// Surface 2 — time-range + status filters
// ---------------------------------------------------------------------------

export type TimeRange = 'today' | 'this_week' | 'upcoming' | 'past';

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Sunday-start week containing `ms` (local time), [start, end) bounds. */
function weekBounds(ms: number): { start: number; end: number } {
  const start = startOfDay(ms);
  const dow = new Date(start).getDay(); // 0=Sun
  const weekStart = start - dow * DAY_MS;
  return { start: weekStart, end: weekStart + 7 * DAY_MS };
}

/** Filter bookings by `start_at` against a chip range, relative to `now`. */
export function filterByTimeRange(
  bookings: Booking[],
  range: TimeRange,
  now: number,
): Booking[] {
  return bookings.filter((b) => {
    const t = Date.parse(b.start_at);
    if (Number.isNaN(t)) return false; // unparseable date → never matches a time filter
    switch (range) {
      case 'today': {
        const s = startOfDay(now);
        return t >= s && t < s + DAY_MS;
      }
      case 'this_week': {
        const { start, end } = weekBounds(now);
        return t >= start && t < end;
      }
      case 'upcoming':
        return t >= now;
      case 'past':
        return t < now;
    }
  });
}

/** Filter by an exact Booking.status; `'all'` is a pass-through. */
export function filterByStatus(
  bookings: Booking[],
  status: BookingStatus | 'all',
): Booking[] {
  if (status === 'all') return bookings;
  return bookings.filter((b) => b.status === status);
}

// ---------------------------------------------------------------------------
// Surface 8 — operational-debt derivation (ui_plan §8 / §249)
// ---------------------------------------------------------------------------

/**
 * A booking is "awaiting disposition" when its meeting has ended but nobody has
 * dispositioned it — i.e. status is still `booked` while the event end is in the past.
 * (ui_plan §249: status stays `booked`/session-state `pending_attendance` until a human
 * dispositions; no auto-completion. The operational-debt metric surfaces that backlog.)
 *
 * Forward-compat: end_at may be absent → fall back to start_at.
 */
export function isAwaitingDisposition(b: Booking, now: number): boolean {
  if (b.status !== 'booked') return false;
  const endMs = Date.parse(b.end_at ?? b.start_at);
  if (Number.isNaN(endMs)) return false;
  return endMs < now;
}

export interface OperationalDebtBuckets {
  /** Awaiting-disposition bookings whose event ended more than N ago. */
  over24h: number;
  over72h: number;
  over7d: number;
  over30d: number;
  /** All awaiting-disposition bookings (any age in the past). */
  total: number;
}

/**
 * Count awaiting-disposition bookings by age bucket (ui_plan §8: 24h / 72h / 7d / 30d).
 * Buckets are cumulative ("older than X"), matching the §8 wording.
 */
export function computeOperationalDebt(
  bookings: Booking[],
  now: number,
): OperationalDebtBuckets {
  const buckets: OperationalDebtBuckets = {
    over24h: 0,
    over72h: 0,
    over7d: 0,
    over30d: 0,
    total: 0,
  };
  for (const b of bookings) {
    if (!isAwaitingDisposition(b, now)) continue;
    const ageMs = now - Date.parse(b.end_at ?? b.start_at);
    buckets.total += 1;
    if (ageMs > 24 * HOUR_MS) buckets.over24h += 1;
    if (ageMs > 72 * HOUR_MS) buckets.over72h += 1;
    if (ageMs > 7 * DAY_MS) buckets.over7d += 1;
    if (ageMs > 30 * DAY_MS) buckets.over30d += 1;
  }
  return buckets;
}

export interface StaffDebtRow {
  coordinatorEmail: string;
  unresolved: number;
}

/**
 * Per-staff unresolved counts, sorted desc (ui_plan §8: "staff with the most unresolved
 * dispositions", drill-down source). Bookings without a coordinator_email group under '(unassigned)'.
 */
export function staffDebtBreakdown(bookings: Booking[], now: number): StaffDebtRow[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (!isAwaitingDisposition(b, now)) continue;
    const key = b.coordinator_email ?? '(unassigned)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([coordinatorEmail, unresolved]) => ({ coordinatorEmail, unresolved }))
    .sort((a, b) => b.unresolved - a.unresolved);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Display-ready slot label, e.g. "Tue, Jun 3 · 2:00 PM". Falls back to raw on bad input. */
export function formatSlotLabel(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endIso) return `${day} · ${startTime}`;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return `${day} · ${startTime}`;
  const endTime = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} · ${startTime}–${endTime}`;
}

/** Resolve an appointment_type_id to a human label, falling back to the id. */
export function appointmentTypeLabel(
  appointmentTypeId: string | undefined,
  lookup: Record<string, string> | undefined,
): string {
  if (!appointmentTypeId) return 'Appointment';
  return lookup?.[appointmentTypeId] ?? appointmentTypeId;
}

/**
 * Only allow an https:// calendar link to become an href (XSS pass: blocks
 * `javascript:` / `data:` and other scheme injection through a stored field).
 */
export function safeExternalHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return /^https:\/\//i.test(url) ? url : undefined;
}

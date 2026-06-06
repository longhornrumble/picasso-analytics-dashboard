/**
 * Scheduling API service — Customer Portal (sub-phase E, WS-E-PORTAL).
 *
 * Fronts the §E7 `GET /scheduling/bookings` Analytics_Dashboard_API endpoint
 * (FROZEN_CONTRACTS §E7 — integrator glue, not yet live). The endpoint shape
 * mirrors ui_plan §8: a `scope=staff_self|tenant_aggregate` query param, a
 * `Booking[]` projection (FROZEN_CONTRACTS §A), and cursor pagination — the same
 * envelope the other Analytics_Dashboard_API readers use.
 *
 * STUB MODE: while `SCHEDULING_STUB` is true the surfaces render from the WS-FIX
 * fixture so the (feature-flag-gated, default-off) Scheduling tab is demoable
 * before the backend lands. ONE-LINE SWAP: set `SCHEDULING_STUB = false` once the
 * endpoint ships — the real fetch path below activates with zero call-site change.
 */
import type { Booking } from '../types/scheduling';
import { getTenantOverride } from './analyticsApi';
import { allBookings } from '../test/fixtures/schedulingFixture';

const API_BASE_URL = import.meta.env.VITE_ANALYTICS_API_URL || '/api';

/**
 * The §E7 endpoint is LIVE (lambda#255, merged to main 2026-06-06). The real fetch
 * path is active. ⚠ MERGE-LAST: this dashboard PR must only be merged to prod AFTER
 * the prod Analytics_Dashboard_API is redeployed with the §E7 route + the dynamodb:Query
 * IAM grant + BOOKING_TABLE env are in place — otherwise the tab errors. See the deploy
 * runbook.
 */
export const SCHEDULING_STUB = false;

/** ui_plan §8 audience split: a staff member sees own; an admin sees the tenant. */
export type BookingScope = 'staff_self' | 'tenant_aggregate';

/** §E7 response envelope — matches the shipped endpoint exactly: { bookings, nextCursor? }. */
export interface SchedulingBookingsResponse {
  bookings: Booking[];
  /** Opaque base64 cursor for the next page; absent when there are no more. */
  nextCursor?: string;
}

/**
 * Fetch the viewer's bookings. Server-side scoping is enforced by the §E7 endpoint
 * (staff_self filters to the caller; tenant_aggregate requires admin). The render
 * surfaces additionally apply the client-side §8 permission filter (visibleBookings)
 * as defense-in-depth — both agree (admin = pass-through; staff = own).
 */
export async function fetchBookings(
  scope: BookingScope = 'staff_self',
): Promise<Booking[]> {
  if (SCHEDULING_STUB) return allBookings;

  const token = localStorage.getItem('analytics_token');
  if (!token) throw new Error('Not authenticated');

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const override = getTenantOverride();
  if (override) headers['X-Tenant-Override'] = override;

  const url = `${API_BASE_URL}/scheduling/bookings?scope=${encodeURIComponent(scope)}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data: SchedulingBookingsResponse = await response.json();
  return data.bookings ?? [];
}

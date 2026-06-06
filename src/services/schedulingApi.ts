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

/** Flip to false when the §E7 endpoint is live (the one-line swap). */
export const SCHEDULING_STUB = true;

/** ui_plan §8 audience split: a staff member sees own; an admin sees the tenant. */
export type BookingScope = 'staff_self' | 'tenant_aggregate';

/** §E7 response envelope (mirrors the existing Analytics_Dashboard_API readers). */
export interface SchedulingBookingsResponse {
  tenant_id: string;
  bookings: Booking[];
  pagination?: {
    total_count: number;
    next_cursor: string | null;
    has_more: boolean;
  };
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

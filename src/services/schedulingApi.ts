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

// ===========================================================================
// §E13b — AppointmentType / RoutingPolicy write API (LOCKED 2026-06-06; lambda#258).
// The integrator owns these Analytics_Dashboard_API endpoints (ADMIN-only); this client
// is consumed by the E13 Settings sub-tab. Shapes ground-truthed against the deployed code.
// ===========================================================================

/** Last-edit stamp + optimistic-lock token (microsecond ISO8601Z). */
export interface ModifiedAt {
  at: string;
  by: string;
}

export type TagOperator = 'in_any' | 'equals';

/** Runtime tag-condition shape routing.js reads — `{operator, values[]}`, NOT `{tag}`. */
export interface TagCondition {
  operator: TagOperator;
  values: string[];
}

/** Stored AppointmentType row (picasso-appointment-type-{env}). */
export interface AppointmentType {
  tenantId?: string;
  appointment_type_id: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  lead_time_minutes?: number;
  /** FK → RoutingPolicy; the router THROWS without it. */
  routing_policy_id: string;
  modified_at?: ModifiedAt; // absent on legacy/fixture rows
}

/** Stored RoutingPolicy row (picasso-routing-policy-{env}); presented as a "Team". */
export interface RoutingPolicy {
  tenantId?: string;
  routing_policy_id: string;
  tie_breaker?: 'round_robin' | 'first_available';
  /** AND across conditions; [] = solo (everyone eligible). */
  tag_conditions?: TagCondition[];
  modified_at?: ModifiedAt;
}

/** POST/PATCH body for an AppointmentType (server mints id on create if absent). */
export interface AppointmentTypeWrite {
  appointment_type_id?: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  lead_time_minutes?: number;
  routing_policy_id: string;
}

/** POST/PATCH body for a RoutingPolicy. */
export interface RoutingPolicyWrite {
  routing_policy_id?: string;
  tie_breaker?: 'round_robin' | 'first_available';
  tag_conditions?: TagCondition[];
}

/**
 * Typed scheduling-write error so the UI can branch on the §E13b status codes:
 *   422 vocab fail-closed → `unknownTags`; 422 FK → message; 409 stale/dup; 428 missing If-Match.
 */
export class SchedulingApiError extends Error {
  status: number;
  unknownTags?: string[];
  constructor(status: number, message: string, unknownTags?: string[]) {
    super(message);
    this.name = 'SchedulingApiError';
    this.status = status;
    this.unknownTags = unknownTags;
  }
}

type WriteMethod = 'POST' | 'PATCH';

/**
 * Authed write against an Analytics_Dashboard_API scheduling endpoint. On a non-2xx,
 * throws SchedulingApiError carrying the deployed body shape ({error, unknownTags?}).
 * `ifMatch` (the row's modified_at.at, or '*' to first-stamp a legacy row) is sent as the
 * `If-Match` header on PATCH (the endpoint also accepts a body `expected_modified_at`).
 */
async function schedulingWrite<T>(
  method: WriteMethod,
  path: string,
  body: unknown,
  ifMatch?: string,
): Promise<T> {
  const token = localStorage.getItem('analytics_token');
  if (!token) throw new SchedulingApiError(401, 'Not authenticated');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const override = getTenantOverride();
  if (override) headers['X-Tenant-Override'] = override;
  if (ifMatch) headers['If-Match'] = ifMatch;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SchedulingApiError(
      response.status,
      data.error || `API error: ${response.status}`,
      Array.isArray(data.unknownTags) ? data.unknownTags : undefined,
    );
  }
  return data as T;
}

async function schedulingGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('analytics_token');
  if (!token) throw new SchedulingApiError(401, 'Not authenticated');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const override = getTenantOverride();
  if (override) headers['X-Tenant-Override'] = override;

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SchedulingApiError(response.status, data.error || `API error: ${response.status}`);
  }
  return data as T;
}

// --- Appointment Types -----------------------------------------------------

export async function fetchAppointmentTypes(): Promise<AppointmentType[]> {
  const data = await schedulingGet<{ appointment_types?: AppointmentType[] }>(
    '/scheduling/appointment-types',
  );
  return data.appointment_types ?? [];
}

export async function createAppointmentType(
  body: AppointmentTypeWrite,
): Promise<AppointmentType> {
  const data = await schedulingWrite<{ appointment_type: AppointmentType }>(
    'POST',
    '/scheduling/appointment-types',
    body,
  );
  return data.appointment_type;
}

export async function updateAppointmentType(
  appointmentTypeId: string,
  body: AppointmentTypeWrite,
  ifMatch: string,
): Promise<AppointmentType> {
  const data = await schedulingWrite<{ appointment_type: AppointmentType }>(
    'PATCH',
    `/scheduling/appointment-types/${encodeURIComponent(appointmentTypeId)}`,
    body,
    ifMatch,
  );
  return data.appointment_type;
}

// --- Routing Policies (presented as "Teams") -------------------------------

export async function fetchRoutingPolicies(): Promise<RoutingPolicy[]> {
  const data = await schedulingGet<{ routing_policies?: RoutingPolicy[] }>(
    '/scheduling/routing-policies',
  );
  return data.routing_policies ?? [];
}

export async function createRoutingPolicy(
  body: RoutingPolicyWrite,
): Promise<RoutingPolicy> {
  const data = await schedulingWrite<{ routing_policy: RoutingPolicy }>(
    'POST',
    '/scheduling/routing-policies',
    body,
  );
  return data.routing_policy;
}

export async function updateRoutingPolicy(
  routingPolicyId: string,
  body: RoutingPolicyWrite,
  ifMatch: string,
): Promise<RoutingPolicy> {
  const data = await schedulingWrite<{ routing_policy: RoutingPolicy }>(
    'PATCH',
    `/scheduling/routing-policies/${encodeURIComponent(routingPolicyId)}`,
    body,
    ifMatch,
  );
  return data.routing_policy;
}

/** The optimistic-lock token for a row: its modified_at.at, or '*' to first-stamp a legacy row. */
export function ifMatchToken(row: { modified_at?: ModifiedAt }): string {
  return row.modified_at?.at ?? '*';
}

// ===========================================================================
// §E13c — per-staff scheduling settings write + tag-vocabulary read (lambda#259, G1/G4).
// NOTE: deliberately NO optimistic lock (the registry has no commit-owned state — §E13c).
// ===========================================================================

/** Closed scheduling-tag vocabulary (config S3); ADMIN-only read. Dropdown source. */
export async function fetchTagVocabulary(): Promise<string[]> {
  const data = await schedulingGet<{ scheduling_tag_vocabulary?: string[] }>(
    '/scheduling/tag-vocabulary',
  );
  return data.scheduling_tag_vocabulary ?? [];
}

/**
 * Per-staff scheduling-settings PATCH. Tenant comes from the auth session (NOT the path).
 * Send any subset (>=1): `scheduling_tags`/`bookable_override` are ADMIN-only;
 * `calendar_email_override` is self-or-admin. Per-field auth is server-enforced BEFORE write
 * (a member smuggling an admin field → 403, no write). 422 carries `unknownTags`.
 */
export interface EmployeeSchedulingWrite {
  scheduling_tags?: string[];
  bookable_override?: 'off' | null;
  calendar_email_override?: string | null;
}

export async function updateEmployeeScheduling(
  employeeId: string,
  fields: EmployeeSchedulingWrite,
): Promise<{ employee_id: string } & EmployeeSchedulingWrite> {
  return schedulingWrite(
    'PATCH',
    `/scheduling/employees/${encodeURIComponent(employeeId)}`,
    fields,
  );
}

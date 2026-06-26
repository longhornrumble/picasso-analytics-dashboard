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
  /**
   * §B18b conferencing modality the booking joins at start — the Booking_Commit_Handler
   * mints a Google Meet / Zoom link (or none) accordingly. Absent → defaults to
   * 'google_meet' server-side. Read-only here (no editor yet); schema-discipline optional.
   */
  conference_type?: 'google_meet' | 'zoom';
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
  /** Meeting location (§B18b). Phase 1 = the two live providers; absent → 'google_meet'. */
  conference_type?: 'google_meet' | 'zoom';
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

// --- Scheduling activation (org-level) -------------------------------------

export interface SchedulingActivation {
  /** Raw feature_flags.scheduling_enabled for the org. */
  enabled: boolean;
  /** Whether the caller (admin/super_admin) may change it. */
  can_manage: boolean;
}

/** GET the org's scheduling activation state (raw flag + whether caller can manage). */
export async function fetchSchedulingActivation(): Promise<SchedulingActivation> {
  return schedulingGet<SchedulingActivation>('/settings/scheduling/activation');
}

/** Admin-only: turn scheduling on/off for the org. Returns the new state. */
export async function setSchedulingActivation(enabled: boolean): Promise<{ enabled: boolean }> {
  return schedulingWrite<{ enabled: boolean }>('PATCH', '/settings/scheduling/activation', { enabled });
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

// --- Booking actions (§E12-actions / G6; lambda#269) -----------------------
// ADA is the Clerk-authed entry; it proxies the side effect to BCH. §8 own-or-admin
// is enforced server-side (404 — not 403 — for a non-owner, so existence isn't leaked).
// booking_id contains '#' (booking#<hex>) → encodeURIComponent %-encodes it; ADA urldecodes.

export interface CancelBookingResult {
  booking_id: string;
  /** 'canceled' on a synchronous delete; 'pending_calendar_sync' (202) when the listener will flip it. */
  status: 'canceled' | 'pending_calendar_sync';
}

/** Cancel a booking with an audit reason (required, ≤1000 chars). 409 if already terminal. */
export async function cancelBooking(
  bookingId: string,
  reason: string,
): Promise<CancelBookingResult> {
  return schedulingWrite<CancelBookingResult>(
    'POST',
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { reason },
  );
}

export interface RescheduleLinkResult {
  booking_id: string;
  /** false when the notify dispatch missed (still a 200 — best-effort). */
  sent: boolean;
}

/** Mint + send a fresh reschedule link to the guest (no body). 429 if within the 60s cooldown. */
export async function sendRescheduleLink(bookingId: string): Promise<RescheduleLinkResult> {
  return schedulingWrite<RescheduleLinkResult>(
    'POST',
    `/scheduling/bookings/${encodeURIComponent(bookingId)}/reschedule-link`,
    {},
  );
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

// ===========================================================================
// §E14 — scheduling notification-template overrides (lambda#261, G2). ADMIN-only.
// NOTE: built to the DEPLOYED shape — `available_variables` is PER-MOMENT (the §E14
// doc prose says top-level; the endpoint returns it inside each moment). Flagged to integrator.
// ===========================================================================

/** The 3 v1 lifecycle moments that dispatch a full subject+body (§E14). */
export type NotificationMoment =
  | 'reschedule_link'
  | 'reoffer'
  | 'cancel_notice'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'confirmation';

/** The editable copy fields. */
export interface TemplateCopy {
  subject: string;
  body_text: string;
  body_html: string;
}

export interface MomentTemplate extends TemplateCopy {
  /** True when this tenant has overridden any EMAIL field (else the platform default shows). */
  is_override: boolean;
  /** The reset target — platform default email copy. */
  default: TemplateCopy;
  modified_at?: ModifiedAt;
  /** Variables usable in THIS moment, e.g. {{firstName}}, {{actionUrl}} (per-moment). */
  available_variables: string[];
  // §E14 SMS surface (G7a / lambda#271) — editor surface only; the actual SMS SEND stays
  // HELD until the SMS_Sender twin + WS-E-TCPA. Additive; readers tolerate absence.
  /** Effective SMS copy (override-or-default). */
  sms_text?: string;
  sms_is_override?: boolean;
  sms_default?: string;
  /** Plain-text variables valid for the SMS body (no html-only vars). */
  sms_available_variables?: string[];
}

export interface NotificationTemplatesResponse {
  moments: Record<string, MomentTemplate>;
  /** Read-only compliance note — STOP/unsubscribe is appended automatically, not editable (email). */
  stop_footer_note: string;
  /** Read-only compliance note for SMS — the TCPA STOP/HELP footer is appended automatically. */
  sms_footer_note?: string;
}

/** PATCH body: any subset of the email copy + the SMS override; empty string clears that field. */
export type NotificationTemplateWrite = Partial<TemplateCopy> & { sms_text?: string };

export async function fetchNotificationTemplates(): Promise<NotificationTemplatesResponse> {
  const data = await schedulingGet<NotificationTemplatesResponse>(
    '/scheduling/notification-templates',
  );
  return {
    moments: data.moments ?? {},
    stop_footer_note: data.stop_footer_note ?? '',
    sms_footer_note: data.sms_footer_note ?? '',
  };
}

/**
 * Upsert-merge one moment's copy. Send any subset of {subject, body_text, body_html, sms_text};
 * an empty-string field CLEARS that override back to the platform default. Unknown moment → 404.
 */
export async function updateNotificationTemplate(
  moment: NotificationMoment,
  body: NotificationTemplateWrite,
): Promise<{ moment: string; template: MomentTemplate }> {
  return schedulingWrite(
    'PATCH',
    `/scheduling/notification-templates/${encodeURIComponent(moment)}`,
    body,
  );
}

// ===========================================================================
// §E11 / Track 2 Surface 1 — Calendar connection init + status.
// init endpoint: Clerk-authed (via the standard schedulingGet helper).
// status endpoint: NO Clerk header — the init token in the URL is the auth.
// Shapes ground-truthed against Calendar_OAuth_Connect/index.js handleStatus.
// ===========================================================================

/**
 * Hard-default OAuth origin. Override with VITE_OAUTH_ORIGIN in .env files —
 * same pattern as VITE_ANALYTICS_API_URL elsewhere in this file.
 */
const OAUTH_ORIGIN =
  (import.meta.env.VITE_OAUTH_ORIGIN as string | undefined) ||
  'https://staging.schedule.myrecruiter.ai';

/**
 * Validate that a server-supplied URL is safe to navigate to / fetch.
 * Rules:
 *   1. Must parse as a valid URL.
 *   2. Protocol must be `https:`.
 *   3. When VITE_OAUTH_ORIGIN is set (or the code-level default applies), the
 *      URL's origin must match it exactly.
 * Throws a plain Error with `label` in the message if any rule fails.
 */
export function assertOAuthUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label}: invalid URL returned from server`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label}: server returned a non-https URL`);
  }
  if (parsed.origin !== OAUTH_ORIGIN) {
    throw new Error(
      `${label}: server URL origin (${parsed.origin}) does not match expected origin (${OAUTH_ORIGIN})`,
    );
  }
}

/**
 * Response from GET /scheduling/connection/init (Analytics_Dashboard_API proxy).
 * The ADA mints an HMAC init-token, returns it alongside the OAuth entry-point URL
 * and a matching status-poll URL.
 */
export interface CalendarConnectionInitResponse {
  /** HMAC-signed init token (TTL ~300 s); opaque to the dashboard. */
  expires_in: number;
  /** Full OAuth entry-point URL — navigate the browser here (full-page, NOT fetch). */
  connect_url: string;
  /** Poll this URL (plain fetch, no Clerk header) to check connection status. */
  status_url: string;
}

/**
 * Calendar connection status — ground-truthed from Calendar_OAuth_Connect handleStatus.
 *   connected      — token probed OK; scopes + calendar_id populated.
 *   disconnected   — no refresh token, or confirmed revocation (bookable: false).
 *   stale_connected — transient probe error; token may still be valid.
 */
export type CalendarConnectionStatus = 'connected' | 'disconnected' | 'stale_connected';

/** Response from GET <status_url> (plain fetch, init token in URL). */
export interface CalendarConnectionStatusResponse {
  status: CalendarConnectionStatus;
  /** Populated when status === 'connected'. */
  scopes?: string[] | null;
  /** The connected Google calendar id (may differ from login email). */
  calendar_id?: string | null;
  /** 'revoked' when status === 'disconnected' due to confirmed token revocation. */
  reason?: string;
  /** false when disconnected (explicit bookable:false from the backend). */
  bookable?: boolean;
}

/**
 * Mint an OAuth init token + return the connect_url and status_url.
 * Uses the Clerk-authed schedulingGet helper (same as every other scheduling endpoint).
 * Origin-validates both URLs before returning (item 4 — security hardening).
 */
export async function initCalendarConnection(): Promise<CalendarConnectionInitResponse> {
  const resp = await schedulingGet<CalendarConnectionInitResponse>(
    '/scheduling/connection/init',
  );
  assertOAuthUrl(resp.connect_url, 'connect_url');
  assertOAuthUrl(resp.status_url, 'status_url');
  return resp;
}

/**
 * Fetch current connection status from the status_url returned by initCalendarConnection.
 * Does NOT send a Clerk authorization header — the init token embedded in the URL is the auth.
 * Tolerates missing optional fields (forward-compatible schema discipline).
 * Hardened fetch options: no-referrer, omit credentials (item 5).
 */
export async function fetchCalendarConnectionStatus(
  statusUrl: string,
): Promise<CalendarConnectionStatusResponse> {
  const response = await fetch(statusUrl, {
    method: 'GET',
    referrerPolicy: 'no-referrer',
    credentials: 'omit',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SchedulingApiError(response.status, data.error || `Status fetch error: ${response.status}`);
  }
  return data as CalendarConnectionStatusResponse;
}

/**
 * §E11b — user-initiated calendar disconnect.
 * POST /scheduling/connection/disconnect → 200 { status, watch }. An empty JSON body ({}) is sent and ignored server-side.
 * Clerk-authed via the standard schedulingWrite helper.
 * Idempotent: already-disconnected/missing-secret → 200 { status:'disconnected', watch:'none' }.
 * On 4xx/5xx throws SchedulingApiError (generic message; no secret-path leakage from server).
 */
export interface DisconnectCalendarConnectionResponse {
  /** Always 'disconnected' on success. */
  status: 'disconnected';
  /** Outcome of the best-effort async watch offboarder call. */
  watch: 'stopped' | 'pending' | 'none';
}

export async function disconnectCalendarConnection(): Promise<DisconnectCalendarConnectionResponse> {
  return schedulingWrite<DisconnectCalendarConnectionResponse>(
    'POST',
    '/scheduling/connection/disconnect',
    {},
  );
}

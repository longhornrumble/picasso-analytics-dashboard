import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  createRoutingPolicy,
  cancelBooking,
  sendRescheduleLink,
  SchedulingApiError,
  ifMatchToken,
  type AppointmentType,
} from '../../../services/schedulingApi';

const okJson = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.setItem('analytics_token', 'tkn');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('schedulingApi §E13b client', () => {
  it('GET appointment-types unwraps the { appointment_types } envelope', async () => {
    const rows: AppointmentType[] = [
      { appointment_type_id: 'a1', name: 'Discovery', duration_minutes: 30, routing_policy_id: 'rp1' },
    ];
    fetchMock.mockResolvedValue(okJson(200, { appointment_types: rows }));
    await expect(fetchAppointmentTypes()).resolves.toEqual(rows);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/scheduling\/appointment-types$/);
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer tkn');
  });

  it('POST create sends no If-Match and returns the created row', async () => {
    const created: AppointmentType = {
      appointment_type_id: 'a2', name: 'Interview', duration_minutes: 60, routing_policy_id: 'rp1',
      modified_at: { at: '2026-06-06T00:00:00.000001Z', by: 'admin@x' },
    };
    fetchMock.mockResolvedValue(okJson(201, { appointment_type: created }));
    const res = await createAppointmentType({ name: 'Interview', duration_minutes: 60, routing_policy_id: 'rp1' });
    expect(res).toEqual(created);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.headers['If-Match']).toBeUndefined();
    expect(JSON.parse(opts.body)).toMatchObject({ name: 'Interview', routing_policy_id: 'rp1' });
  });

  it('PATCH update sends the If-Match optimistic-lock token', async () => {
    const updated: AppointmentType = {
      appointment_type_id: 'a2', name: 'Interview v2', duration_minutes: 45, routing_policy_id: 'rp1',
      modified_at: { at: '2026-06-06T00:00:01.000002Z', by: 'admin@x' },
    };
    fetchMock.mockResolvedValue(okJson(200, { appointment_type: updated }));
    await updateAppointmentType('a2', { name: 'Interview v2', duration_minutes: 45, routing_policy_id: 'rp1' }, '2026-06-06T00:00:00.000001Z');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/scheduling\/appointment-types\/a2$/);
    expect(opts.method).toBe('PATCH');
    expect(opts.headers['If-Match']).toBe('2026-06-06T00:00:00.000001Z');
  });

  it('422 vocab fail-closed surfaces unknownTags', async () => {
    fetchMock.mockResolvedValue(okJson(422, { error: 'unknown tags', unknownTags: ['typo'] }));
    const err = await createRoutingPolicy({ tie_breaker: 'round_robin', tag_conditions: [{ operator: 'in_any', values: ['typo'] }] }).catch((e) => e);
    expect(err).toBeInstanceOf(SchedulingApiError);
    expect(err.status).toBe(422);
    expect(err.unknownTags).toEqual(['typo']);
  });

  it('409 (stale If-Match) and 428 (missing If-Match) carry their status', async () => {
    fetchMock.mockResolvedValue(okJson(409, { error: 'stale' }));
    const stale = await updateAppointmentType('a2', { name: 'x', duration_minutes: 30, routing_policy_id: 'rp1' }, 'old').catch((e) => e);
    expect(stale).toBeInstanceOf(SchedulingApiError);
    expect(stale.status).toBe(409);

    fetchMock.mockResolvedValue(okJson(428, { error: 'If-Match required' }));
    const missing = await updateAppointmentType('a2', { name: 'x', duration_minutes: 30, routing_policy_id: 'rp1' }, '').catch((e) => e);
    expect(missing.status).toBe(428);
  });

  it('throws 401 SchedulingApiError when unauthenticated', async () => {
    localStorage.clear();
    const err = await fetchAppointmentTypes().catch((e) => e);
    expect(err).toBeInstanceOf(SchedulingApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('schedulingApi §E12-actions client', () => {
  it('POST cancel %-encodes the booking_id (#) and sends the reason', async () => {
    fetchMock.mockResolvedValue(okJson(200, { booking_id: 'booking#abc', status: 'canceled' }));
    const res = await cancelBooking('booking#abc', 'out sick');
    expect(res).toEqual({ booking_id: 'booking#abc', status: 'canceled' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/scheduling\/bookings\/booking%23abc\/cancel$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ reason: 'out sick' });
  });

  it('POST reschedule-link %-encodes the id and returns { sent }', async () => {
    fetchMock.mockResolvedValue(okJson(200, { booking_id: 'booking#abc', sent: true }));
    const res = await sendRescheduleLink('booking#abc');
    expect(res).toEqual({ booking_id: 'booking#abc', sent: true });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/scheduling\/bookings\/booking%23abc\/reschedule-link$/);
    expect(opts.method).toBe('POST');
  });

  it('surfaces a 429 reschedule cooldown as a SchedulingApiError', async () => {
    fetchMock.mockResolvedValue(okJson(429, { error: 'rate_limited' }));
    const err = await sendRescheduleLink('booking#abc').catch((e) => e);
    expect(err).toBeInstanceOf(SchedulingApiError);
    expect(err.status).toBe(429);
  });
});

describe('ifMatchToken', () => {
  it('returns modified_at.at, or "*" to first-stamp a legacy row', () => {
    expect(ifMatchToken({ modified_at: { at: 'T', by: 'e' } })).toBe('T');
    expect(ifMatchToken({})).toBe('*');
  });
});

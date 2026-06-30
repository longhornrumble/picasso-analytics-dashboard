import { describe, it, expect } from 'vitest';
import { calendarStatusAlert } from '../calendarStatusAlert';
import type { CalendarConnectionStatusResponse } from '../../services/schedulingApi';

const status = (s: Partial<CalendarConnectionStatusResponse>): CalendarConnectionStatusResponse =>
  ({ status: 'disconnected', ...s }) as CalendarConnectionStatusResponse;

describe('calendarStatusAlert — status enum → actionable alert', () => {
  it('connected → no alert', () => {
    expect(calendarStatusAlert(status({ status: 'connected' }))).toBeNull();
  });

  it('stale_connected → warning, "unverified"', () => {
    const a = calendarStatusAlert(status({ status: 'stale_connected' }));
    expect(a?.severity).toBe('warning');
    expect(a?.title).toMatch(/unverified/i);
  });

  it('disconnected + revoked → error, "revoked", bookings-paused copy', () => {
    const a = calendarStatusAlert(status({ status: 'disconnected', reason: 'revoked' }));
    expect(a?.severity).toBe('error');
    expect(a?.title).toMatch(/revoked/i);
    expect(a?.description).toMatch(/bookings are paused/i);
  });

  it('disconnected, clean/first-time → no alert (onboarding, not an error)', () => {
    expect(calendarStatusAlert(status({ status: 'disconnected' }))).toBeNull();
  });

  it('disconnected with a non-revoked reason → no alert (only revoked is flagged)', () => {
    expect(calendarStatusAlert(status({ status: 'disconnected', reason: 'other' }))).toBeNull();
  });
});

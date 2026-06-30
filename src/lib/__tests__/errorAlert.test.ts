import { describe, it, expect } from 'vitest';
import { errorToAlert } from '../errorAlert';

// Stand-in matching SchedulingApiError's duck-typed shape (numeric .status).
class ApiErr extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

describe('errorToAlert — grounded in the real API error shapes', () => {
  it('network TypeError → "can\'t reach the server"', () => {
    const a = errorToAlert(new TypeError('Failed to fetch'));
    expect(a.severity).toBe('error');
    expect(a.title).toMatch(/reach the server/i);
  });

  it('401 (typed) → session expired', () => {
    expect(errorToAlert(new ApiErr(401, 'Not authenticated')).title).toMatch(/session expired/i);
  });

  it('plain "Not authenticated" Error (analyticsApi) → session expired', () => {
    expect(errorToAlert(new Error('Not authenticated')).title).toMatch(/session expired/i);
  });

  it('403 → no-access (server detail kept as description)', () => {
    const a = errorToAlert(new ApiErr(403, 'admin only'));
    expect(a.title).toMatch(/access/i);
    expect(a.description).toBe('admin only');
  });

  it('409 stale-lock → recoverable "changed somewhere else" warning', () => {
    const a = errorToAlert(new ApiErr(409, 'stale If-Match; row was modified'));
    expect(a.severity).toBe('warning');
    expect(a.title).toMatch(/changed/i);
  });

  it('428 missing If-Match → same concurrent-edit warning', () => {
    expect(errorToAlert(new ApiErr(428, 'If-Match required')).severity).toBe('warning');
  });

  it('409 business-rule message passes through verbatim as the title', () => {
    const a = errorToAlert(new ApiErr(409, 'team is in use by appointment type(s); reassign them first'));
    expect(a.severity).toBe('error');
    expect(a.title).toMatch(/in use by appointment type/i);
  });

  it('422 validation message surfaces', () => {
    expect(errorToAlert(new ApiErr(422, 'unknown tags: typo')).title).toMatch(/unknown tags/i);
  });

  it('429 cooldown → soft warning', () => {
    expect(errorToAlert(new ApiErr(429, 'rate_limited')).severity).toBe('warning');
  });

  it('500 (typed) → friendly "on our end", never the raw string', () => {
    const a = errorToAlert(new ApiErr(500, 'API error: 500'));
    expect(a.title).toMatch(/our end/i);
  });

  it('analyticsApi "API error: 404" (status only in message) classifies as 404', () => {
    expect(errorToAlert(new Error('API error: 404')).title).toMatch(/not found/i);
  });

  it('generic ":500"-tail message is replaced with friendly copy, not shown raw', () => {
    const a = errorToAlert(new Error('Failed to update tenant: 500'));
    expect(a.title).toMatch(/our end/i);
    expect(a.title).not.toMatch(/Failed to update tenant/);
  });

  it('unknown non-Error throw → generic fallback', () => {
    const a = errorToAlert('weird');
    expect(a.severity).toBe('error');
    expect(a.title).toMatch(/something went wrong/i);
  });
});

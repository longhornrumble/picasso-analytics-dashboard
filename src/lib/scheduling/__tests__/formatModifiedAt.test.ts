import { describe, it, expect } from 'vitest';
import { lastEditedLabel } from '../formatModifiedAt';

describe('lastEditedLabel (AC#20 modified_at surfacing)', () => {
  it('formats a populated modified_at as "Edited by … · date"', () => {
    const out = lastEditedLabel({ at: '2026-06-06T00:00:00.000002Z', by: 'admin@x' });
    expect(out).toMatch(/^Edited by admin@x · /);
    expect(out).toContain('2026');
  });
  it('omits "by" when only a timestamp is present', () => {
    expect(lastEditedLabel({ at: '2026-06-06T00:00:00Z', by: '' })).toMatch(/^Edited /);
    expect(lastEditedLabel({ at: '2026-06-06T00:00:00Z', by: '' })).not.toMatch(/Edited by/);
  });
  it('returns null for a legacy/fixture row with no modified_at', () => {
    expect(lastEditedLabel(undefined)).toBeNull();
  });
  it('falls back to the raw value on an unparseable date', () => {
    expect(lastEditedLabel({ at: 'not-a-date', by: 'x' })).toContain('not-a-date');
  });
});

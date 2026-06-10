import { describe, it, expect } from 'vitest';
import {
  staffSchedulingStatus,
  staffWarning,
  matchesStaffFilter,
} from '../staffStatus';
import type { TeamMember } from '../../../types/analytics';

const mk = (over: Partial<TeamMember>): TeamMember => ({
  employee_id: 'e',
  membership_id: null,
  user_id: null,
  name: 'N',
  email: 'n@x',
  role: 'member',
  type: 'clerk_user',
  status: 'active',
  joined_at: '2026-01-01',
  ...over,
});

describe('staffSchedulingStatus (E13 / D3)', () => {
  it('bookable: connected + on a team + not paused', () => {
    const s = staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: true }));
    expect(s).toMatchObject({ bookable: true, needsCalendar: false, needsTeam: false, isParticipant: true });
  });

  it('needsCalendar: on a team but no connected calendar (v1-MUST warning)', () => {
    const s = staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: false }));
    expect(s).toMatchObject({ bookable: false, needsCalendar: true, needsTeam: false });
  });

  it('needsTeam: connected a calendar but on no team (v1-MUST warning)', () => {
    const s = staffSchedulingStatus(mk({ scheduling_tags: [], calendar_connected: true }));
    expect(s).toMatchObject({ bookable: false, needsCalendar: false, needsTeam: true });
  });

  it('a non-participant (no team, no calendar) gets NO warning', () => {
    const s = staffSchedulingStatus(mk({ scheduling_tags: [], calendar_connected: false }));
    expect(s).toMatchObject({ isParticipant: false, needsCalendar: false, needsTeam: false, bookable: false });
  });

  it('paused suppresses warnings (intentionally not bookable)', () => {
    const s = staffSchedulingStatus(
      mk({ scheduling_tags: ['t'], calendar_connected: false, bookable_override: 'off' }),
    );
    expect(s).toMatchObject({ paused: true, needsCalendar: false, needsTeam: false, bookable: false });
  });

  it('schema discipline: absent calendar_connected reads as not-connected', () => {
    const s = staffSchedulingStatus(mk({ scheduling_tags: ['t'] })); // no calendar_connected
    expect(s.needsCalendar).toBe(true);
  });
});

describe('staffWarning', () => {
  it('maps the mutually-exclusive cases to copy, else null', () => {
    expect(staffWarning(staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: false }))))
      .toBe('Connect calendar to be bookable');
    expect(staffWarning(staffSchedulingStatus(mk({ scheduling_tags: [], calendar_connected: true }))))
      .toBe('Not on any team');
    expect(staffWarning(staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: true }))))
      .toBeNull();
  });
});

describe('matchesStaffFilter', () => {
  const bookable = staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: true }));
  const missing = staffSchedulingStatus(mk({ scheduling_tags: ['t'], calendar_connected: false }));

  it('all → everyone', () => {
    expect(matchesStaffFilter(bookable, 'all')).toBe(true);
    expect(matchesStaffFilter(missing, 'all')).toBe(true);
  });
  it('bookable / not_bookable partition', () => {
    expect(matchesStaffFilter(bookable, 'bookable')).toBe(true);
    expect(matchesStaffFilter(missing, 'bookable')).toBe(false);
    expect(matchesStaffFilter(missing, 'not_bookable')).toBe(true);
    expect(matchesStaffFilter(bookable, 'not_bookable')).toBe(false);
  });
  it('missing_connection → only the needs-calendar set', () => {
    expect(matchesStaffFilter(missing, 'missing_connection')).toBe(true);
    expect(matchesStaffFilter(bookable, 'missing_connection')).toBe(false);
  });
});

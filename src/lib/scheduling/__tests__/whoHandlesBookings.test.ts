import { describe, it, expect } from 'vitest';
import {
  bookablePrograms,
  unbookablePrograms,
  buildBookingGroups,
  coverage,
  applyProgramSelection,
  applyAssignment,
  memberProgramIds,
  programColor,
  effectiveBookable,
} from '../whoHandlesBookings';
import type { TeamMember } from '../../../types/analytics';
import type { Program, RoutingPolicy } from '../../../services/schedulingApi';

const programs: Program[] = [
  { program_id: 'p1', program_name: 'Love Box' },
  { program_id: 'p2', program_name: 'Dare to Dream' },
  { program_id: 'p3', program_name: 'Donor Relations' }, // bound but unpublished → not bookable
  { program_id: 'p4', program_name: 'Tracking Only' }, // never made bookable
];

const policies: RoutingPolicy[] = [
  { routing_policy_id: 'rp1', program_id: 'p1', bookable: true, tie_breaker: 'round_robin', tag_conditions: [{ operator: 'in_any', values: ['Love Box'] }] },
  { routing_policy_id: 'rp2', program_id: 'p2', tie_breaker: 'first_available', tag_conditions: [{ operator: 'in_any', values: ['Dare Team'] }] },
  { routing_policy_id: 'rp3', program_id: 'p3', bookable: false, tie_breaker: 'round_robin', tag_conditions: [{ operator: 'in_any', values: ['Donor Team'] }] },
  { routing_policy_id: 'rp4', tag_conditions: [{ operator: 'in_any', values: ['spanish'] }] }, // unbound plain team
];

function mkStaff(over: Partial<TeamMember> & { employee_id: string }): TeamMember {
  return {
    employee_id: over.employee_id,
    membership_id: null,
    user_id: null,
    name: over.name ?? over.employee_id,
    email: over.email ?? `${over.employee_id}@x.org`,
    role: over.role ?? 'member',
    type: 'clerk_user',
    status: 'active',
    joined_at: '2026-01-01',
    ...over,
  } as TeamMember;
}

const staff: TeamMember[] = [
  mkStaff({ employee_id: 'chris', name: 'Chris', role: 'admin', scheduling_tags: ['Love Box', 'Dare Team'], calendar_connected: true }),
  mkStaff({ employee_id: 'kate', name: 'Kate', scheduling_tags: ['Love Box'], calendar_connected: true, calendar_email_override: 'kate@cal.org' }),
  mkStaff({ employee_id: 'sam', name: 'Sam', scheduling_tags: ['Dare Team'], calendar_connected: false }),
  mkStaff({ employee_id: 'pat', name: 'Pat', scheduling_tags: ['Dare Team'], calendar_connected: true, bookable_override: 'off' }),
  mkStaff({ employee_id: 'skill', name: 'Skill Only', scheduling_tags: ['spanish'], calendar_connected: true }),
];

describe('effectiveBookable', () => {
  it('needs connected AND not paused', () => {
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: true }))).toBe(true);
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: false }))).toBe(false);
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: true, bookable_override: 'off' }))).toBe(false);
  });
});

describe('bookablePrograms', () => {
  const bps = bookablePrograms(programs, policies);
  it('includes only bound + published programs, in config order', () => {
    expect(bps.map((b) => b.program_id)).toEqual(['p1', 'p2']); // p3 unpublished, p4 unbound
  });
  it('carries the team name + assignment from the bound policy', () => {
    expect(bps[0]).toMatchObject({ program_id: 'p1', teamName: 'Love Box', teamTag: 'Love Box', assignment: 'round_robin', routing_policy_id: 'rp1' });
    expect(bps[1]).toMatchObject({ program_id: 'p2', assignment: 'first_available' });
  });
});

describe('unbookablePrograms', () => {
  it('lists config programs not currently bookable (the Add pick-list)', () => {
    expect(unbookablePrograms(programs, policies).map((p) => p.program_id).sort()).toEqual(['p3', 'p4']);
  });
});

describe('memberProgramIds', () => {
  const bps = bookablePrograms(programs, policies);
  it('maps a person to the bookable programs whose team tag they carry', () => {
    expect([...memberProgramIds(staff[0], bps)].sort()).toEqual(['p1', 'p2']); // chris
    expect([...memberProgramIds(staff[4], bps)]).toEqual([]); // skill-only tag → none
  });
});

describe('buildBookingGroups', () => {
  const groups = buildBookingGroups({ bookablePrograms: bookablePrograms(programs, policies), staff });

  it('groups by program, thinnest-coverage-first', () => {
    expect(groups.map((g) => g.program_id)).toEqual(['p2', 'p1']); // p2=1 bookable, p1=2
  });

  it('coverage counts use effective bookable (connected && !paused)', () => {
    const p2 = groups.find((g) => g.program_id === 'p2')!;
    expect(p2.memberCount).toBe(3); // chris, sam, pat
    expect(p2.bookableCount).toBe(1); // only chris (sam=needs_calendar, pat=paused)
    const p1 = groups.find((g) => g.program_id === 'p1')!;
    expect(p1.bookableCount).toBe(2); // chris + kate
  });

  it('a person on multiple programs appears under each', () => {
    const inP1 = groups.find((g) => g.program_id === 'p1')!.members.some((m) => m.employee_id === 'chris');
    const inP2 = groups.find((g) => g.program_id === 'p2')!.members.some((m) => m.employee_id === 'chris');
    expect(inP1 && inP2).toBe(true);
  });

  it('derives the four secondary-line cases + 3-state status + admin flag', () => {
    const p2 = groups.find((g) => g.program_id === 'p2')!;
    const p1 = groups.find((g) => g.program_id === 'p1')!;
    const row = (g: typeof p2, id: string) => g.members.find((m) => m.employee_id === id)!;
    expect(row(p2, 'chris').secondary).toBe('Also covers Love Box');
    expect(row(p1, 'kate').secondary).toBe('Books to kate@cal.org');
    expect(row(p2, 'sam').secondary).toBe('No calendar connected');
    expect(row(p2, 'pat').secondary).toBe('Paused — calendar still connected');
    expect(row(p2, 'chris').status).toBe('bookable');
    expect(row(p2, 'chris').isAdmin).toBe(true);
    expect(row(p2, 'sam').status).toBe('needs_calendar');
    expect(row(p2, 'pat').status).toBe('paused');
  });
});

describe('coverage', () => {
  it('0 → none, 1 → gap, ≥2 → ok', () => {
    expect(coverage(0, 3)).toEqual({ label: 'No bookable staff', tone: 'none' });
    expect(coverage(1, 3)).toEqual({ label: '1 of 3 bookable', tone: 'gap' });
    expect(coverage(2, 3)).toEqual({ label: '2 of 3 bookable', tone: 'ok' });
  });
});

describe('applyProgramSelection', () => {
  const bps = bookablePrograms(programs, policies);
  it('adds checked programs\' tags, removes unchecked, preserves unmanaged tags', () => {
    // Chris on both; uncheck Love Box → drop its tag, keep Dare + the unmanaged 'spanish'.
    const next = applyProgramSelection(['Love Box', 'Dare Team', 'spanish'], bps, new Set(['p2']));
    expect(next.sort()).toEqual(['Dare Team', 'spanish']);
  });
});

describe('applyAssignment', () => {
  it('adds a team tag when checked, removes it when unchecked, leaves others', () => {
    expect(applyAssignment(['a'], 'Love Box', true).sort()).toEqual(['Love Box', 'a']);
    expect(applyAssignment(['a', 'Love Box'], 'Love Box', false)).toEqual(['a']);
  });
});

describe('programColor', () => {
  it('is deterministic per program_id', () => {
    expect(programColor('p1')).toEqual(programColor('p1'));
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildBookingGroups,
  programTagMap,
  coveragePill,
  applyProgramSelection,
  colorForIndex,
  effectiveBookable,
  PROGRAM_PALETTE,
} from '../whoHandlesBookings';
import type { TeamMember } from '../../../types/analytics';
import type { Program, AppointmentType, RoutingPolicy } from '../../../services/schedulingApi';

const programs: Program[] = [
  { program_id: 'p1', program_name: 'Love Box' },
  { program_id: 'p2', program_name: 'Dare to Dream' },
  { program_id: 'p3', program_name: 'Donor' }, // no appointment type → empty group
];

const routingPolicies: RoutingPolicy[] = [
  { routing_policy_id: 'rp1', tag_conditions: [{ operator: 'in_any', values: ['lovebox_team'] }] },
  { routing_policy_id: 'rp2', tag_conditions: [{ operator: 'in_any', values: ['d2d_team'] }] },
];

const appointmentTypes: AppointmentType[] = [
  { appointment_type_id: 'a1', name: 'Love Box', duration_minutes: 30, routing_policy_id: 'rp1', program_id: 'p1' },
  { appointment_type_id: 'a2', name: 'Dare to Dream', duration_minutes: 30, routing_policy_id: 'rp2', program_id: 'p2' },
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
  mkStaff({ employee_id: 'chris', name: 'Chris', role: 'admin', scheduling_tags: ['lovebox_team', 'd2d_team'], calendar_connected: true }),
  mkStaff({ employee_id: 'kate', name: 'Kate', scheduling_tags: ['lovebox_team'], calendar_connected: true, calendar_email_override: 'kate@cal.org' }),
  mkStaff({ employee_id: 'sam', name: 'Sam', scheduling_tags: ['d2d_team'], calendar_connected: false }),
  mkStaff({ employee_id: 'pat', name: 'Pat', scheduling_tags: ['d2d_team'], calendar_connected: true, bookable_override: 'off' }),
  mkStaff({ employee_id: 'skill', name: 'Skill Only', scheduling_tags: ['spanish'], calendar_connected: true }), // non-program tag → no group
];

describe('effectiveBookable', () => {
  it('needs connected AND not paused', () => {
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: true }))).toBe(true);
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: false }))).toBe(false);
    expect(effectiveBookable(mkStaff({ employee_id: 'x', calendar_connected: true, bookable_override: 'off' }))).toBe(false);
  });
});

describe('programTagMap', () => {
  it('maps each program to its team tag(s) via appointment-type → routing policy', () => {
    const m = programTagMap(appointmentTypes, routingPolicies);
    expect(m.get('p1')).toEqual(['lovebox_team']);
    expect(m.get('p2')).toEqual(['d2d_team']);
    expect(m.has('p3')).toBe(false); // no appointment type
  });
});

describe('buildBookingGroups', () => {
  const groups = buildBookingGroups({ programs, appointmentTypes, routingPolicies, staff });

  it('includes every program and sorts thinnest-coverage-first', () => {
    expect(groups.map((g) => g.program_id)).toEqual(['p3', 'p2', 'p1']); // 0, 1, 2 bookable
  });

  it('empty program surfaces as a coverage gap', () => {
    const donor = groups.find((g) => g.program_id === 'p3')!;
    expect(donor.memberCount).toBe(0);
    expect(donor.bookableCount).toBe(0);
    expect(coveragePill(donor.bookableCount, donor.memberCount).label).toBe('No bookable staff');
  });

  it('coverage counts use effective bookable (connected && !paused)', () => {
    const d2d = groups.find((g) => g.program_id === 'p2')!;
    expect(d2d.memberCount).toBe(3); // chris, sam, pat
    expect(d2d.bookableCount).toBe(1); // only chris (sam=needs_calendar, pat=paused)
    const lb = groups.find((g) => g.program_id === 'p1')!;
    expect(lb.bookableCount).toBe(2); // chris + kate
  });

  it('a person on multiple programs appears under each', () => {
    const inLoveBox = groups.find((g) => g.program_id === 'p1')!.members.some((m) => m.employee_id === 'chris');
    const inD2D = groups.find((g) => g.program_id === 'p2')!.members.some((m) => m.employee_id === 'chris');
    expect(inLoveBox && inD2D).toBe(true);
  });

  it('a non-program (skill) tag forms no group and no membership', () => {
    const anywhere = groups.some((g) => g.members.some((m) => m.employee_id === 'skill'));
    expect(anywhere).toBe(false);
  });

  it('derives the four secondary-line cases', () => {
    const d2d = groups.find((g) => g.program_id === 'p2')!;
    const lb = groups.find((g) => g.program_id === 'p1')!;
    const row = (g: typeof d2d, id: string) => g.members.find((m) => m.employee_id === id)!;
    expect(row(d2d, 'chris').secondary).toBe('Also covers Love Box'); // bookable + multi-program
    expect(row(lb, 'kate').secondary).toBe('Books to kate@cal.org'); // bookable + single program
    expect(row(d2d, 'sam').secondary).toBe('No calendar connected'); // not connected
    expect(row(d2d, 'pat').secondary).toBe('Paused — calendar still connected'); // paused
  });

  it('sets the 3-state status + admin flag', () => {
    const d2d = groups.find((g) => g.program_id === 'p2')!;
    const chris = d2d.members.find((m) => m.employee_id === 'chris')!;
    expect(chris.status).toBe('bookable');
    expect(chris.isAdmin).toBe(true);
    expect(d2d.members.find((m) => m.employee_id === 'sam')!.status).toBe('needs_calendar');
    expect(d2d.members.find((m) => m.employee_id === 'pat')!.status).toBe('paused');
  });
});

describe('coveragePill', () => {
  it('0 → danger, 1 → warning, ≥2 → success', () => {
    expect(coveragePill(0, 3).fg).toBe('#B42318');
    expect(coveragePill(1, 3).fg).toBe('#B54708');
    expect(coveragePill(2, 3).fg).toBe('#1C7A45');
  });
});

describe('applyProgramSelection', () => {
  const ptags = programTagMap(appointmentTypes, routingPolicies);
  it('adds a program\'s team tag when checked, removes it when unchecked', () => {
    // Chris currently on both; uncheck Love Box → drops lovebox_team, keeps d2d_team.
    const next = applyProgramSelection(['lovebox_team', 'd2d_team'], ['p1', 'p2'], new Set(['p2']), ptags);
    expect(next.sort()).toEqual(['d2d_team']);
  });
  it('preserves unrelated (non-offered) tags', () => {
    const next = applyProgramSelection(['spanish'], ['p1'], new Set(['p1']), ptags);
    expect(next.sort()).toEqual(['lovebox_team', 'spanish']);
  });
});

describe('colorForIndex', () => {
  it('cycles the palette on overflow', () => {
    expect(colorForIndex(0)).toEqual(PROGRAM_PALETTE[0]);
    expect(colorForIndex(PROGRAM_PALETTE.length)).toEqual(PROGRAM_PALETTE[0]);
  });
});

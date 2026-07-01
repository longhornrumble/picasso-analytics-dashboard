/**
 * "Who handles bookings" — group staff by PROGRAM for the coverage read-out.
 *
 * Program membership is DERIVED (never stored on staff) by walking the real routing chain, so
 * the read-out reflects who actually gets routed a program's bookings:
 *
 *   Program (config.programs)
 *     └─ Appointment Type (program_id)         ← Part 1 binding
 *          └─ Handled-By-Team (routing_policy_id)
 *               └─ team tag  (routing policy's single `tag_conditions[0].values[0]`)
 *                    └─ members (staff whose scheduling_tags include that tag)
 *
 * Pure over its inputs — no React/API — so grouping/sort/coverage are unit-testable and the
 * Edit modal reuses `programTagMap` for the inverse write (assign a person to a program = add
 * that program's team tag to their scheduling_tags).
 *
 * Schema-discipline: tolerate missing fields everywhere (an appointment type without a
 * program_id, a routing policy without a tag, a staffer without scheduling_tags all degrade to
 * "not part of any program group" rather than throwing).
 */
import type { TeamMember } from '../../types/analytics';
import type { Program, AppointmentType, RoutingPolicy } from '../../services/schedulingApi';

export interface ProgramColor {
  fg: string;
  bg: string;
}

/**
 * Curated categorical program palette (handoff seed values + brand-safe extensions). Each hue
 * is AA-safe as TEXT on white, mutually distinct, and avoids the semantic disposition hues
 * (booked-green is the brand anchor at slot 0 by design; no red/amber/completed-blue). Assigned
 * by program order; CYCLES on overflow — safe because color is always paired with the program
 * name + square marker, so two programs sharing a hue stay unambiguous.
 */
export const PROGRAM_PALETTE: ProgramColor[] = [
  { fg: '#1C7A45', bg: '#ECFDF5' }, // emerald (brand anchor)
  { fg: '#6D4ED6', bg: '#F1EDFC' }, // violet
  { fg: '#A13670', bg: '#FBEAF2' }, // plum-rose
  { fg: '#0E7490', bg: '#E0F2F7' }, // cyan
  { fg: '#B45309', bg: '#FFF7ED' }, // amber-brown
  { fg: '#4F46E5', bg: '#EEF2FF' }, // indigo
  { fg: '#0F766E', bg: '#F0FDFA' }, // teal
  { fg: '#A21CAF', bg: '#FDF4FF' }, // magenta
];

export function colorForIndex(i: number): ProgramColor {
  return PROGRAM_PALETTE[((i % PROGRAM_PALETTE.length) + PROGRAM_PALETTE.length) % PROGRAM_PALETTE.length];
}

/** Effective bookable = the person's calendar is connected AND they aren't force-paused. */
export function effectiveBookable(m: TeamMember): boolean {
  return m.calendar_connected === true && m.bookable_override !== 'off';
}

/** A team (routing policy) is exactly one tag (post-unification); null when unconditioned. */
function teamTagOf(policy: RoutingPolicy): string | null {
  return policy.tag_conditions?.[0]?.values?.[0] ?? null;
}

function initialsOf(m: TeamMember): string {
  return (m.name || m.email || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * program_id → the team tag(s) that handle it (the teams its appointment types route to).
 * The Edit modal uses this to translate "assign to program" into "add this tag".
 */
export function programTagMap(
  appointmentTypes: AppointmentType[],
  routingPolicies: RoutingPolicy[],
): Map<string, string[]> {
  const policyTag = new Map<string, string>();
  for (const p of routingPolicies) {
    const t = teamTagOf(p);
    if (t) policyTag.set(p.routing_policy_id, t);
  }
  const out = new Map<string, Set<string>>();
  for (const at of appointmentTypes) {
    if (!at.program_id) continue;
    const tag = policyTag.get(at.routing_policy_id);
    if (!tag) continue;
    if (!out.has(at.program_id)) out.set(at.program_id, new Set());
    out.get(at.program_id)!.add(tag);
  }
  return new Map([...out].map(([pid, tags]) => [pid, [...tags]]));
}

export type MemberStatus = 'bookable' | 'paused' | 'needs_calendar';

export interface BookingMemberRow {
  employee_id: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  image_url?: string;
  bookable: boolean; // effective (connected && !paused)
  status: MemberStatus;
  statusLabel: string;
  secondary: string;
}

export interface BookingGroup {
  program_id: string;
  program_name: string;
  color: ProgramColor;
  members: BookingMemberRow[];
  bookableCount: number;
  memberCount: number;
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  bookable: 'Bookable',
  paused: 'Booking paused',
  needs_calendar: 'Connect calendar to be bookable',
};

/**
 * Group staff by program, thinnest-coverage-first (ascending effective-bookable count) so a
 * gap is the first thing the eye lands on. Every program appears — one with no appointment
 * type / no members surfaces as an empty group ("No bookable staff"), which is the point.
 */
export function buildBookingGroups(input: {
  programs: Program[];
  appointmentTypes: AppointmentType[];
  routingPolicies: RoutingPolicy[];
  staff: TeamMember[];
}): BookingGroup[] {
  const { programs, appointmentTypes, routingPolicies, staff } = input;

  const programTags = programTagMap(appointmentTypes, routingPolicies);
  const programName = new Map(programs.map((p) => [p.program_id, p.program_name]));

  // tag → programs (inverse), then member → the programs they cover (via their tags).
  const tagPrograms = new Map<string, Set<string>>();
  for (const [pid, tags] of programTags) {
    for (const tag of tags) {
      if (!tagPrograms.has(tag)) tagPrograms.set(tag, new Set());
      tagPrograms.get(tag)!.add(pid);
    }
  }
  const memberPrograms = new Map<string, Set<string>>();
  for (const m of staff) {
    const pids = new Set<string>();
    for (const tag of m.scheduling_tags ?? []) {
      const ps = tagPrograms.get(tag);
      if (ps) for (const pid of ps) pids.add(pid);
    }
    memberPrograms.set(m.employee_id, pids);
  }

  const mkRow = (m: TeamMember, currentProgramId: string): BookingMemberRow => {
    const connected = m.calendar_connected === true;
    const paused = m.bookable_override === 'off';
    const status: MemberStatus = !connected ? 'needs_calendar' : paused ? 'paused' : 'bookable';
    let secondary: string;
    if (status === 'needs_calendar') secondary = 'No calendar connected';
    else if (status === 'paused') secondary = 'Paused — calendar still connected';
    else {
      const others = [...(memberPrograms.get(m.employee_id) ?? [])]
        .filter((pid) => pid !== currentProgramId)
        .map((pid) => programName.get(pid) ?? pid);
      const calEmail = m.calendar_email_override || m.email;
      secondary = others.length ? `Also covers ${others.join(', ')}` : calEmail ? `Books to ${calEmail}` : '';
    }
    return {
      employee_id: m.employee_id,
      name: m.name || m.email,
      initials: initialsOf(m),
      isAdmin: m.role === 'admin',
      image_url: m.image_url,
      bookable: connected && !paused,
      status,
      statusLabel: STATUS_LABEL[status],
      secondary,
    };
  };

  const groups: BookingGroup[] = programs.map((prog, i) => {
    const members = staff.filter((m) => memberPrograms.get(m.employee_id)?.has(prog.program_id));
    const rows = members.map((m) => mkRow(m, prog.program_id));
    return {
      program_id: prog.program_id,
      program_name: prog.program_name,
      color: colorForIndex(i),
      members: rows,
      bookableCount: rows.filter((r) => r.bookable).length,
      memberCount: rows.length,
    };
  });

  // Stable thinnest-first: ascending bookable count; ties keep config order (map above is stable).
  return groups.sort((a, b) => a.bookableCount - b.bookableCount);
}

export interface CoveragePill {
  label: string;
  fg: string;
  bg: string;
}

/** Coverage pill styling by effective-bookable count: 0 danger, 1 warning (the gap), ≥2 success. */
export function coveragePill(bookableCount: number, memberCount: number): CoveragePill {
  if (bookableCount === 0) return { label: 'No bookable staff', fg: '#B42318', bg: '#FEE4E2' };
  const label = `${bookableCount} of ${memberCount} bookable`;
  if (bookableCount === 1) return { label, fg: '#B54708', bg: '#FEF3C7' };
  return { label, fg: '#1C7A45', bg: '#ECFDF5' };
}

/**
 * Compute the new scheduling_tags for a person after the Edit modal toggles program checkboxes.
 * Start from their current tags; for each program the modal offered, add its team tag(s) when
 * checked, remove them when unchecked. Programs with no team tag (no appointment type yet) are
 * simply not offerable and never appear here. Returns a de-duped, order-stable list.
 */
export function applyProgramSelection(
  currentTags: string[],
  offeredPrograms: string[],
  checkedPrograms: Set<string>,
  programTags: Map<string, string[]>,
): string[] {
  const tags = new Set(currentTags);
  for (const pid of offeredPrograms) {
    const pt = programTags.get(pid) ?? [];
    if (checkedPrograms.has(pid)) for (const t of pt) tags.add(t);
    else for (const t of pt) tags.delete(t);
  }
  return [...tags];
}

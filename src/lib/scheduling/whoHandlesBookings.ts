/**
 * "Who handles bookings" (§1) — pure logic over the bookable-program ↔ team model.
 *
 * A config program is *bookable* when a routing policy (its Team) is bound to it (`program_id`)
 * and not unpublished (`bookable !== false`). That team is 1:1 with the program:
 *
 *   Program (config.programs)  ─1:1─  Team (RoutingPolicy: program_id + tag name + tie_breaker)
 *        └─ members = staff whose scheduling_tags include the team's tag name
 *
 * Assigning a person to a program = adding that program's team tag to their scheduling_tags
 * (inverse for removal). Everything here is pure over its inputs (no React/API) so grouping,
 * coverage, sort, and the assignment math are unit-testable.
 *
 * Schema-discipline: tolerate missing fields — a policy without a tag, a staffer without
 * scheduling_tags, a program without a name all degrade gracefully rather than throwing.
 */
import type { TeamMember } from '../../types/analytics';
import type { Program, RoutingPolicy } from '../../services/schedulingApi';

export interface ProgramColor {
  fg: string;
  bg: string;
}

/**
 * Categorical program palette — a program's marker/dot color. Assigned deterministically by a
 * stable hash of program_id (same program → same color across renders/sessions, no persistence).
 * Always paired with the program name + square marker, so a repeated hue on overflow stays
 * unambiguous. NOT a semantic token family (those are the coverage pills); decorative only.
 */
export const PROGRAM_PALETTE: ProgramColor[] = [
  { fg: '#1C7A45', bg: '#ECFDF5' }, // emerald
  { fg: '#6D4ED6', bg: '#F1EDFC' }, // violet
  { fg: '#A13670', bg: '#FBEAF2' }, // plum-rose
  { fg: '#0E7490', bg: '#E0F2F7' }, // cyan
  { fg: '#B45309', bg: '#FFF7ED' }, // amber-brown
  { fg: '#4F46E5', bg: '#EEF2FF' }, // indigo
  { fg: '#0F766E', bg: '#F0FDFA' }, // teal
  { fg: '#A21CAF', bg: '#FDF4FF' }, // magenta
];

/** Deterministic program → color: a stable hash of program_id into the palette. */
export function programColor(programId: string): ProgramColor {
  let h = 0;
  for (let i = 0; i < programId.length; i++) h = (h * 31 + programId.charCodeAt(i)) >>> 0;
  return PROGRAM_PALETTE[h % PROGRAM_PALETTE.length];
}

/** The team's display name (= its single tag), or '' for an unconditioned "Everyone" team. */
function teamTagOf(policy: RoutingPolicy): string {
  return policy.tag_conditions?.[0]?.values?.[0] ?? '';
}

/** Effective bookable = the person's calendar is connected AND they aren't force-paused. */
export function effectiveBookable(m: TeamMember): boolean {
  return m.calendar_connected === true && m.bookable_override !== 'off';
}

function initialsOf(m: TeamMember): string {
  return (m.name || m.email || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** A config program made bookable by a bound team (routing policy). */
export interface BookableProgram {
  program_id: string;
  program_name: string;
  routing_policy_id: string;
  /** The team's display name (= its tag); '' when it's an "Everyone" team. */
  teamName: string;
  /** The scheduling_tag staff carry to join this team ('' = Everyone → all staff). */
  teamTag: string;
  assignment: 'round_robin' | 'first_available';
  /** The backing policy row (for If-Match on edit / unpublish). */
  policy: RoutingPolicy;
  color: ProgramColor;
}

/**
 * The bookable programs, in config order: a config program is bookable iff a routing policy is
 * bound to it (`program_id`) and not unpublished (`bookable !== false`). Joined to config so the
 * program_name always resolves live. A program bound by two policies (shouldn't happen — the
 * server enforces 1:1) keeps the first.
 */
export function bookablePrograms(programs: Program[], policies: RoutingPolicy[]): BookableProgram[] {
  const boundByProgram = new Map<string, RoutingPolicy>();
  for (const p of policies) {
    if (!p.program_id || p.bookable === false) continue;
    if (!boundByProgram.has(p.program_id)) boundByProgram.set(p.program_id, p);
  }
  const out: BookableProgram[] = [];
  for (const prog of programs) {
    const policy = boundByProgram.get(prog.program_id);
    if (!policy) continue;
    out.push({
      program_id: prog.program_id,
      program_name: prog.program_name,
      routing_policy_id: policy.routing_policy_id,
      teamName: teamTagOf(policy) || 'Everyone',
      teamTag: teamTagOf(policy),
      assignment: policy.tie_breaker ?? 'round_robin',
      policy,
      color: programColor(prog.program_id),
    });
  }
  return out;
}

/** Config programs NOT yet bookable — the "Add a bookable program" pick-list. */
export function unbookablePrograms(programs: Program[], policies: RoutingPolicy[]): Program[] {
  const bookableIds = new Set(bookablePrograms(programs, policies).map((b) => b.program_id));
  return programs.filter((p) => !bookableIds.has(p.program_id));
}

/** Does a staffer belong to this team? (Everyone team → everyone; else tag membership.) */
function isMemberOf(m: TeamMember, teamTag: string): boolean {
  if (!teamTag) return true; // Everyone
  return (m.scheduling_tags ?? []).includes(teamTag);
}

/** The bookable programs a person belongs to (via team-tag membership). */
export function memberProgramIds(m: TeamMember, bps: BookableProgram[]): Set<string> {
  const s = new Set<string>();
  for (const b of bps) if (isMemberOf(m, b.teamTag)) s.add(b.program_id);
  return s;
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

const STATUS_LABEL: Record<MemberStatus, string> = {
  bookable: 'Bookable',
  paused: 'Booking paused',
  needs_calendar: 'Connect calendar to be bookable',
};

export interface BookingGroup extends BookableProgram {
  members: BookingMemberRow[];
  bookableCount: number;
  memberCount: number;
}

/**
 * Group staff by bookable program, thinnest-coverage-first (ascending effective-bookable count)
 * so a gap is the first thing the eye lands on. A person who covers multiple programs appears
 * under each. Ties keep config order (the sort is stable).
 */
export function buildBookingGroups(input: {
  bookablePrograms: BookableProgram[];
  staff: TeamMember[];
}): BookingGroup[] {
  const { bookablePrograms: bps, staff } = input;
  const programName = new Map(bps.map((b) => [b.program_id, b.program_name]));

  const mkRow = (m: TeamMember, currentProgramId: string): BookingMemberRow => {
    const connected = m.calendar_connected === true;
    const paused = m.bookable_override === 'off';
    const status: MemberStatus = !connected ? 'needs_calendar' : paused ? 'paused' : 'bookable';
    let secondary: string;
    if (status === 'needs_calendar') secondary = 'No calendar connected';
    else if (status === 'paused') secondary = 'Paused — calendar still connected';
    else {
      const others = [...memberProgramIds(m, bps)]
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

  const groups: BookingGroup[] = bps.map((b) => {
    const members = staff.filter((m) => isMemberOf(m, b.teamTag));
    const rows = members.map((m) => mkRow(m, b.program_id));
    return {
      ...b,
      members: rows,
      bookableCount: rows.filter((r) => r.bookable).length,
      memberCount: rows.length,
    };
  });

  return groups.sort((a, b) => a.bookableCount - b.bookableCount);
}

export type CoverageTone = 'none' | 'gap' | 'ok';
export interface Coverage {
  label: string;
  tone: CoverageTone;
}

/**
 * Coverage pill by effective-bookable count: 0 → danger ("No bookable staff"), 1 → warning (the
 * gap signal), ≥2 → success. Returns a semantic `tone` the component maps to token classes (never
 * a raw hex — the caller owns the primary/warning/danger token mapping).
 */
export function coverage(bookableCount: number, memberCount: number): Coverage {
  if (bookableCount === 0) return { label: 'No bookable staff', tone: 'none' };
  const label = `${bookableCount} of ${memberCount} bookable`;
  return { label, tone: bookableCount === 1 ? 'gap' : 'ok' };
}

/**
 * Recompute a person's scheduling_tags after the person-Edit modal toggles program checkboxes.
 * Non-bookable-program tags (skills, unbound teams) are preserved untouched; for each bookable
 * program, its team tag is present iff the program is checked. De-duped, order-stable.
 */
export function applyProgramSelection(
  currentTags: string[],
  bps: BookableProgram[],
  checkedProgramIds: Set<string>,
): string[] {
  const managed = new Set(bps.map((b) => b.teamTag).filter(Boolean));
  const tags = new Set(currentTags.filter((t) => !managed.has(t)));
  for (const b of bps) {
    if (b.teamTag && checkedProgramIds.has(b.program_id)) tags.add(b.teamTag);
  }
  return [...tags];
}

/**
 * Recompute a person's scheduling_tags after the Assign-people modal toggles ONE program's
 * roster: add the team tag when checked, remove it when unchecked. Other tags untouched.
 */
export function applyAssignment(currentTags: string[], teamTag: string, checked: boolean): string[] {
  const tags = new Set(currentTags);
  if (!teamTag) return [...tags]; // Everyone team — membership isn't tag-driven
  if (checked) tags.add(teamTag);
  else tags.delete(teamTag);
  return [...tags];
}

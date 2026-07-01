/**
 * StaffSchedulingSection — "Who handles bookings" (§1 of the Scheduling Settings screen).
 *
 * Admin: every bookable program and who can take its bookings, grouped by program and sorted
 * thinnest-coverage-first so gaps jump out. A program is bookable when a Team (routing policy) is
 * bound to it (§ whoHandlesBookings). Four actions, all matching the design:
 *   • Assign people (per group)  → add/remove that program's team tag on staff (flat picker).
 *   • Edit (per group)           → rename the team + set its assignment; "Stop making bookable".
 *   • Add a bookable program     → make a config program schedulable (creates/restores its team).
 *   • Edit (per person, row-click)→ program assignment + pause + calendar email for that staffer.
 * "Remind to connect" is a local v1 nudge (server-side lastRemindedAt + cooldown is a follow-up).
 *
 * Member (non-admin): only their own self-card — set the calendar email their bookings write to.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { fetchTeamMembers } from '../../services/analyticsApi';
import {
  fetchPrograms,
  fetchAppointmentTypes,
  fetchRoutingPolicies,
  updateEmployeeScheduling,
  updateRoutingPolicy,
  createRoutingPolicy,
  ifMatchToken,
  SchedulingApiError,
  type Program,
  type AppointmentType,
  type RoutingPolicy,
  type EmployeeSchedulingWrite,
} from '../../services/schedulingApi';
import type { TeamMember } from '../../types/analytics';
import { staffSchedulingStatus, staffWarning } from '../../lib/scheduling/staffStatus';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import {
  bookablePrograms,
  unbookablePrograms,
  buildBookingGroups,
  coverage,
  memberProgramIds,
  applyProgramSelection,
  applyAssignment,
  programColor,
  type BookableProgram,
  type CoverageTone,
} from '../../lib/scheduling/whoHandlesBookings';

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 422 && e.unknownTags?.length) return `Unknown team name(s): ${e.unknownTags.join(', ')}.`;
    if (e.status === 403) return "You don't have permission to change that.";
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const ASSIGNMENT_LABEL: Record<'round_robin' | 'first_available', string> = {
  round_robin: 'Round-robin',
  first_available: 'First available',
};

/** Coverage pill token classes by tone (never raw hex — semantic families). */
const COVERAGE_CLASS: Record<CoverageTone, string> = {
  none: 'text-danger-700 bg-danger-100',
  gap: 'text-warning-700 bg-warning-100',
  ok: 'text-primary-700 bg-primary-50',
};

function initials(m: TeamMember): string {
  return (m.name || m.email || '?').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}
function personSub(m: TeamMember): string {
  if (m.calendar_connected !== true) return 'Calendar not connected';
  return m.bookable_override === 'off' ? 'Booking paused' : 'Bookable';
}

export function StaffSchedulingSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const myEmail = user?.email?.toLowerCase();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [appts, setAppts] = useState<AppointmentType[]>([]);
  const [policies, setPolicies] = useState<RoutingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Remind-to-connect: local v1 (keyed by employee_id). Server-side lastRemindedAt + 24h cooldown
  // is a follow-up so the sent/cooldown state survives reload and is shared across admins.
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  // Person-scoped Edit modal (admin).
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ programs: Set<string>; pause: boolean; calendarEmail: string }>({
    programs: new Set(),
    pause: false,
    calendarEmail: '',
  });

  // Assign-people modal (per program) → the set of checked employee_ids.
  const [assignProgramId, setAssignProgramId] = useState<string | null>(null);
  const [assignChecked, setAssignChecked] = useState<Set<string>>(new Set());

  // Program Edit modal (team name + assignment + unpublish).
  const [progEditId, setProgEditId] = useState<string | null>(null);
  const [progDraft, setProgDraft] = useState<{ teamName: string; assignment: 'round_robin' | 'first_available' }>({
    teamName: '',
    assignment: 'round_robin',
  });
  const [confirmUnpublish, setConfirmUnpublish] = useState<BookableProgram | null>(null);

  // Add-a-bookable-program modal.
  const [addProgOpen, setAddProgOpen] = useState(false);

  // Member self-card edit.
  const [selfEditing, setSelfEditing] = useState(false);
  const [selfCalEmail, setSelfCalEmail] = useState('');

  const load = useCallback(
    async (isActive: () => boolean, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setLoadError(null);
      try {
        const m = await fetchTeamMembers();
        let pr: Program[] = [];
        let at: AppointmentType[] = [];
        let po: RoutingPolicy[] = [];
        if (isAdmin) {
          [pr, at, po] = await Promise.all([fetchPrograms(), fetchAppointmentTypes(), fetchRoutingPolicies()]);
        }
        if (!isActive()) return;
        setMembers(m.members);
        setPrograms(pr);
        setAppts(at);
        setPolicies(po);
      } catch (e) {
        if (isActive()) setLoadError(errMessage(e));
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [isAdmin],
  );

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = () => load(() => true, { silent: true });

  const bps = useMemo(() => bookablePrograms(programs, policies), [programs, policies]);
  const groups = useMemo(() => buildBookingGroups({ bookablePrograms: bps, staff: members }), [bps, members]);
  const unbookable = useMemo(() => unbookablePrograms(programs, policies), [programs, policies]);

  // ---- Person Edit ----
  function openEdit(employeeId: string) {
    const m = members.find((x) => x.employee_id === employeeId);
    if (!m) return;
    setEditId(employeeId);
    setSaveError(null);
    setDraft({
      programs: memberProgramIds(m, bps),
      pause: m.bookable_override === 'off',
      calendarEmail: m.calendar_email_override ?? '',
    });
  }
  function toggleDraftProgram(pid: string) {
    setDraft((d) => {
      const s = new Set(d.programs);
      if (s.has(pid)) s.delete(pid);
      else s.add(pid);
      return { ...d, programs: s };
    });
  }
  async function saveEdit() {
    const m = members.find((x) => x.employee_id === editId);
    if (!m) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateEmployeeScheduling(m.employee_id, {
        scheduling_tags: applyProgramSelection(m.scheduling_tags ?? [], bps, draft.programs),
        bookable_override: draft.pause ? 'off' : null,
        calendar_email_override: draft.calendarEmail.trim() || null,
      } satisfies EmployeeSchedulingWrite);
      setEditId(null);
      await refresh();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // ---- Assign people (per program) ----
  function openAssign(bp: BookableProgram) {
    setAssignProgramId(bp.program_id);
    setSaveError(null);
    setAssignChecked(new Set(members.filter((m) => memberProgramIds(m, bps).has(bp.program_id)).map((m) => m.employee_id)));
  }
  function toggleAssign(employeeId: string) {
    setAssignChecked((prev) => {
      const s = new Set(prev);
      if (s.has(employeeId)) s.delete(employeeId);
      else s.add(employeeId);
      return s;
    });
  }
  async function saveAssign() {
    const bp = bps.find((b) => b.program_id === assignProgramId);
    if (!bp) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Write only the staff whose membership actually changed.
      const changed = members.filter((m) => {
        const was = memberProgramIds(m, bps).has(bp.program_id);
        return was !== assignChecked.has(m.employee_id);
      });
      await Promise.all(
        changed.map((m) =>
          updateEmployeeScheduling(m.employee_id, {
            scheduling_tags: applyAssignment(m.scheduling_tags ?? [], bp.teamTag, assignChecked.has(m.employee_id)),
          }),
        ),
      );
      setAssignProgramId(null);
      await refresh();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // ---- Program Edit (team name + assignment) ----
  function openProgEdit(bp: BookableProgram) {
    setProgEditId(bp.program_id);
    setSaveError(null);
    setProgDraft({ teamName: bp.teamName === 'Everyone' ? '' : bp.teamName, assignment: bp.assignment });
  }
  async function saveProgEdit() {
    const bp = bps.find((b) => b.program_id === progEditId);
    if (!bp) return;
    setSaving(true);
    setSaveError(null);
    const name = progDraft.teamName.trim();
    try {
      await updateRoutingPolicy(
        bp.routing_policy_id,
        {
          tie_breaker: progDraft.assignment,
          tag_conditions: name ? [{ operator: 'in_any', values: [name] }] : [],
        },
        ifMatchToken(bp.policy),
      );
      setProgEditId(null);
      await refresh();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function doUnpublish(bp: BookableProgram) {
    setSaving(true);
    setSaveError(null);
    const name = (bp.teamName === 'Everyone' ? '' : bp.teamName).trim();
    try {
      // Non-destructive: keep the team, its staff tags and appointment-type FKs; just flip bookable.
      await updateRoutingPolicy(
        bp.routing_policy_id,
        {
          bookable: false,
          tie_breaker: bp.assignment,
          tag_conditions: name ? [{ operator: 'in_any', values: [name] }] : [],
        },
        ifMatchToken(bp.policy),
      );
      setConfirmUnpublish(null);
      setProgEditId(null);
      await refresh();
    } catch (e) {
      setConfirmUnpublish(null);
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // ---- Add a bookable program (make schedulable) ----
  async function makeBookable(program: Program) {
    setSaving(true);
    setSaveError(null);
    // Restore a previously-unpublished team if one exists for this program; else create fresh
    // (default team name = the program name). Program↔team is 1:1 (server-enforced).
    const existing = policies.find((p) => p.program_id === program.program_id);
    try {
      if (existing) {
        const tag = existing.tag_conditions?.[0]?.values?.[0];
        await updateRoutingPolicy(
          existing.routing_policy_id,
          {
            bookable: true,
            tie_breaker: existing.tie_breaker ?? 'round_robin',
            tag_conditions: tag ? [{ operator: 'in_any', values: [tag] }] : [],
          },
          ifMatchToken(existing),
        );
      } else {
        await createRoutingPolicy({
          program_id: program.program_id,
          bookable: true,
          tie_breaker: 'round_robin',
          tag_conditions: [{ operator: 'in_any', values: [program.program_name] }],
        });
      }
      setAddProgOpen(false);
      await refresh();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function remind(employeeId: string) {
    setReminded((prev) => new Set(prev).add(employeeId));
  }

  async function saveSelf(me: TeamMember) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await updateEmployeeScheduling(me.employee_id, { calendar_email_override: selfCalEmail.trim() || null });
      const { employee_id: _id, ...written } = res;
      setMembers((prev) => prev.map((m) => (m.employee_id === me.employee_id ? { ...m, ...written } : m)));
      setSelfEditing(false);
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        <div className="w-6 h-6 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Loading staff…</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-danger-600 py-8 text-center" role="alert">
        Couldn't load staff: {loadError}
      </p>
    );
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  // ---- Member self-service: only their own calendar email ----
  if (!isAdmin) {
    const me = members.find((m) => m.email.toLowerCase() === myEmail);
    if (!me) return <p className="text-sm text-slate-400">Your staff record isn't available.</p>;
    const meWarning = staffWarning(staffSchedulingStatus(me));
    return (
      <section aria-label="My scheduling" className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">My scheduling</h3>
          <p className="text-xs text-slate-500">Set the calendar email used for your bookings if it differs from your login.</p>
        </div>
        {saveError && <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2" role="alert">{saveError}</p>}
        <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
          {me.scheduling_tags && me.scheduling_tags.length > 0 && (
            <p className="text-xs text-slate-500">Your teams: {me.scheduling_tags.join(', ')}</p>
          )}
          {meWarning && (
            <p className="text-xs text-warning-700" role="status">
              ⚠{' '}
              {meWarning === 'Connect calendar to be bookable' ? (
                <>
                  {meWarning}.{' '}
                  <a href="?settings_tab=calendar" className="underline hover:text-warning-800 focus:outline-none focus:ring-1 focus:ring-warning-500 rounded" aria-label="Open Integrations to connect your calendar">
                    Integrations
                  </a>
                </>
              ) : (
                meWarning
              )}
            </p>
          )}
          <div>
            <label htmlFor="my-cal-email" className="block text-xs font-medium text-slate-600 mb-1">Calendar email</label>
            {selfEditing ? (
              <input id="my-cal-email" type="email" className={inputCls} value={selfCalEmail} placeholder="leave blank to use your login email" onChange={(e) => setSelfCalEmail(e.target.value)} />
            ) : (
              <p className="text-sm text-slate-700">{me.calendar_email_override || <span className="text-slate-400">— (login email)</span>}</p>
            )}
          </div>
          {selfEditing ? (
            <div className="flex gap-2">
              <button onClick={() => saveSelf(me)} disabled={saving} className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setSelfEditing(false); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setSelfEditing(true); setSelfCalEmail(me.calendar_email_override ?? ''); setSaveError(null); }} className="self-start text-sm text-primary-600 hover:text-primary-700">Edit</button>
          )}
        </div>
      </section>
    );
  }

  // ---- Admin: "Who handles bookings" read-out, grouped by bookable program ----
  const editMember = editId ? members.find((m) => m.employee_id === editId) : null;
  const assignBp = assignProgramId ? bps.find((b) => b.program_id === assignProgramId) : null;
  const progEditBp = progEditId ? bps.find((b) => b.program_id === progEditId) : null;
  const anyModalOpen = !!(editMember || assignBp || progEditBp || addProgOpen || confirmUnpublish);
  const cardCls = 'bg-white rounded-2xl p-6 w-[min(440px,100%)] box-border shadow-[0_24px_60px_rgba(15,23,42,0.25)]';
  const savePill = 'text-white font-bold text-sm px-6 py-2.5 rounded-full bg-primary-500 shadow-[0_8px_24px_rgba(80,200,120,0.28)] disabled:opacity-50';
  const sectionLabel = 'text-[11.5px] font-bold text-slate-600 tracking-[0.05em]';

  return (
    <section aria-label="Who handles bookings" className="flex flex-col">
      <div>
        <h3 className="text-[17px] font-bold text-slate-900">Who handles bookings</h3>
        <p className="text-[13px] text-slate-500 mt-0.5">Every program and who can take its bookings.</p>
      </div>

      {saveError && !anyModalOpen && (
        <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-4" role="alert">
          {saveError}
        </p>
      )}

      {programs.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No programs defined for this tenant yet.</p>
      ) : (
        groups.map((g) => {
          const cov = coverage(g.bookableCount, g.memberCount);
          return (
            <div key={g.program_id} className="mt-[18px]">
              <div className="flex items-center gap-2.5 mb-0.5">
                <span aria-hidden="true" className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: g.color.fg }} />
                <span className="text-[13.5px] font-bold text-slate-900">{g.program_name}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${COVERAGE_CLASS[cov.tone]}`}>
                  {cov.label}
                </span>
                <span className="ml-auto flex items-center gap-3.5 shrink-0">
                  <button onClick={() => openAssign(g)} className="text-[12.5px] font-bold text-primary-700 hover:text-primary-800">Assign people</button>
                  <button onClick={() => openProgEdit(g)} className="text-[12.5px] font-bold text-slate-500 hover:text-slate-700">Edit</button>
                </span>
              </div>
              <div className="text-[12px] text-slate-400 mb-1 ml-5">{g.teamName} · {ASSIGNMENT_LABEL[g.assignment]}</div>
              {g.members.map((m) => {
                  const isReminded = reminded.has(m.employee_id);
                  return (
                    <button
                      key={m.employee_id}
                      onClick={() => openEdit(m.employee_id)}
                      className="w-full flex items-center gap-[11px] py-[7px] px-0.5 border-b border-slate-100 rounded-lg text-left hover:bg-slate-50 transition-colors"
                    >
                      <StaffAvatar name={m.name} initials={m.initials} isAdmin={m.isAdmin} imageUrl={m.image_url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-slate-900 truncate">{m.name}</span>
                          {m.status === 'needs_calendar' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-warning-700 bg-warning-100">{m.statusLabel}</span>
                          )}
                          {m.status === 'paused' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-500 bg-slate-100">{m.statusLabel}</span>
                          )}
                        </div>
                      </div>
                      {m.status === 'needs_calendar' &&
                        (isReminded ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
                            <CheckIcon /> Reminder sent · just now
                          </span>
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); remind(m.employee_id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); remind(m.employee_id); } }}
                            className="text-[13px] font-semibold text-primary-700 whitespace-nowrap shrink-0 hover:text-primary-800"
                          >
                            Remind to connect
                          </span>
                        ))}
                      <ChevronRightIcon />
                    </button>
                  );
                })}
            </div>
          );
        })
      )}

      {unbookable.length > 0 && (
        <button
          onClick={() => { setAddProgOpen(true); setSaveError(null); }}
          className="flex items-center gap-2.5 border border-dashed border-slate-300 rounded-xl px-[15px] py-3 mt-3.5 text-[13.5px] font-semibold text-primary-700 hover:border-primary-400 hover:bg-primary-50/40 w-full text-left"
        >
          <PlusIcon /> Add a bookable program
        </button>
      )}

      {/* Footer: staff come from the Team tab; this section is a read-out. NO invite button. */}
      <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-slate-100">
        <span className="text-[12.5px] text-slate-400">People are added in the Team tab and appear here automatically.</span>
        <a href="?settings_tab=team" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-700 whitespace-nowrap hover:text-primary-800">
          Manage team <ArrowRightIcon />
        </a>
      </div>

      {/* ---- Person Edit modal ---- */}
      {editMember && (
        <ModalOverlay onClose={() => { setEditId(null); setSaveError(null); }}>
          <div className={cardCls}>
            <div className="text-[17px] font-bold text-slate-900">Edit {editMember.name || editMember.email}</div>
            <div className="text-[12.5px] text-slate-400 mt-0.5">Program assignment applies to this person across the whole section.</div>

            <div className={`${sectionLabel} mt-5`}>PROGRAMS</div>
            <div className="flex flex-col mt-1.5">
              {bps.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">No bookable programs yet.</p>
              ) : (
                bps.map((p) => (
                  <label key={p.program_id} className="flex items-center gap-3 py-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="w-5 h-5 accent-primary-500" checked={draft.programs.has(p.program_id)} onChange={() => toggleDraftProgram(p.program_id)} />
                    {p.program_name}
                  </label>
                ))
              )}
            </div>

            <label className="flex items-center gap-3 pt-3 mt-2 border-t border-slate-100 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" className="w-5 h-5 accent-primary-500" checked={draft.pause} onChange={(e) => setDraft({ ...draft, pause: e.target.checked })} />
              Pause booking (force off)
            </label>

            <div className={`${sectionLabel} mt-[18px]`}>CALENDAR EMAIL</div>
            <input className={`${inputCls} mt-2`} type="email" aria-label="Calendar email" value={draft.calendarEmail} placeholder="optional — defaults to login email" onChange={(e) => setDraft({ ...draft, calendarEmail: e.target.value })} />

            {saveError && <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-3" role="alert">{saveError}</p>}

            <div className="flex items-center gap-4 mt-5">
              <button onClick={saveEdit} disabled={saving} className={savePill}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setEditId(null); setSaveError(null); }} className="text-sm font-semibold text-slate-500">Cancel</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ---- Assign people modal (flat list, no search — Fix #5) ---- */}
      {assignBp && (
        <ModalOverlay onClose={() => { setAssignProgramId(null); setSaveError(null); }}>
          <div className="bg-white rounded-2xl p-6 w-[min(460px,100%)] max-h-[82vh] overflow-y-auto box-border shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
            <div className="text-[17px] font-bold text-slate-900">Assign people to {assignBp.program_name}</div>
            <div className="text-[12.5px] text-slate-400 mt-0.5">Everyone you check joins this program's team and can take its bookings.</div>
            <div className="flex flex-col mt-3.5">
              {members.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">No staff yet — add people in the Team tab.</p>
              ) : (
                members.map((m) => (
                  <label key={m.employee_id} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 accent-primary-500" checked={assignChecked.has(m.employee_id)} onChange={() => toggleAssign(m.employee_id)} />
                    <StaffAvatar name={m.name || m.email} initials={initials(m)} isAdmin={m.role === 'admin'} imageUrl={m.image_url} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-slate-900 truncate">{m.name || m.email}</div>
                      <div className="text-[12px] text-slate-400">{personSub(m)}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            {saveError && <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-3" role="alert">{saveError}</p>}
            <div className="flex items-center gap-4 mt-5">
              <button onClick={saveAssign} disabled={saving} className={savePill}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setAssignProgramId(null); setSaveError(null); }} className="text-sm font-semibold text-slate-500">Cancel</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ---- Program Edit modal (team name + assignment + unpublish) ---- */}
      {progEditBp && (
        <ModalOverlay onClose={() => { setProgEditId(null); setSaveError(null); }}>
          <div className={cardCls}>
            <div className="text-[17px] font-bold text-slate-900">Edit {progEditBp.program_name}</div>
            <div className="text-[12.5px] text-slate-400 mt-0.5">How bookings for this program route to its team.</div>

            <div className={`${sectionLabel} mt-5`}>TEAM NAME</div>
            <input
              className={`${inputCls} mt-2`}
              aria-label="Team name"
              value={progDraft.teamName}
              maxLength={50}
              placeholder="e.g. Volunteer Coordinators"
              onChange={(e) => setProgDraft({ ...progDraft, teamName: e.target.value })}
            />

            <div className={`${sectionLabel} mt-[18px]`}>ASSIGNMENT</div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {(['round_robin', 'first_available'] as const).map((a) => {
                const on = progDraft.assignment === a;
                return (
                  <button
                    key={a}
                    onClick={() => setProgDraft({ ...progDraft, assignment: a })}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] border ${on ? 'bg-primary-50 text-primary-700 border-primary-200 font-bold' : 'bg-white text-slate-500 border-slate-200 font-semibold'}`}
                  >
                    {ASSIGNMENT_LABEL[a]}
                  </button>
                );
              })}
            </div>

            {saveError && <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-3" role="alert">{saveError}</p>}

            <div className="flex items-center justify-between gap-3.5 mt-6">
              <div className="flex items-center gap-4">
                <button onClick={saveProgEdit} disabled={saving} className={savePill}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setProgEditId(null); setSaveError(null); }} className="text-sm font-semibold text-slate-500">Cancel</button>
              </div>
              <button onClick={() => { setConfirmUnpublish(progEditBp); setProgEditId(null); }} className="text-[12.5px] font-semibold text-warning-700 hover:text-warning-800">Stop making bookable</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ---- Add a bookable program modal ---- */}
      {addProgOpen && (
        <ModalOverlay onClose={() => setAddProgOpen(false)}>
          <div className={cardCls}>
            <div className="text-[17px] font-bold text-slate-900">Add a bookable program</div>
            <div className="text-[12.5px] text-slate-400 mt-0.5">Pick a program from your configuration to make schedulable.</div>
            <div className="flex flex-col gap-2 mt-3.5">
              {unbookable.map((p) => (
                <button
                  key={p.program_id}
                  onClick={() => makeBookable(p)}
                  disabled={saving}
                  className="flex items-center gap-3 border border-slate-100 rounded-xl px-[15px] py-3 text-left hover:border-slate-200 disabled:opacity-50"
                >
                  <span aria-hidden="true" className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: programColor(p.program_id).fg }} />
                  <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{p.program_name}</span>
                  <span className="text-[12.5px] font-bold text-primary-700 shrink-0">Make bookable</span>
                </button>
              ))}
            </div>
            {saveError && <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-3" role="alert">{saveError}</p>}
            <div className="mt-5">
              <button onClick={() => setAddProgOpen(false)} className="text-sm font-semibold text-slate-500">Cancel</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ---- Unpublish confirmation (Fix #2: warn about dependent appointment types) ---- */}
      {confirmUnpublish && (
        <ConfirmDialog
          title={`Stop making ${confirmUnpublish.program_name} bookable?`}
          message={unpublishMessage(appts.filter((a) => a.program_id === confirmUnpublish.program_id).length)}
          confirmLabel="Stop making bookable"
          destructive
          onConfirm={() => doUnpublish(confirmUnpublish)}
          onCancel={() => setConfirmUnpublish(null)}
        />
      )}
    </section>
  );
}

function unpublishMessage(dependentCount: number): string {
  const base = 'It will no longer appear here or be selectable for new appointment types. Staff assignments are kept, so you can make it bookable again later.';
  if (dependentCount === 0) return base;
  const noun = dependentCount === 1 ? 'appointment type currently routes' : 'appointment types currently route';
  return `${dependentCount} ${noun} to this program and will stop being bookable. ${base}`;
}

/** Centered modal overlay: backdrop click = cancel; clicking the card does not close. */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-slate-900/35" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

/** Avatar — the member photo when present, else a gradient circle with initials. */
function StaffAvatar({ name, initials: ini, isAdmin, imageUrl }: { name: string; initials: string; isAdmin: boolean; imageUrl?: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <span
      aria-hidden="true"
      className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold ${isAdmin ? 'text-white' : 'bg-slate-200 text-slate-600'}`}
      style={isAdmin ? { background: 'linear-gradient(135deg,#6FD89A,#3FAE72)' } : undefined}
      title={name}
    >
      {ini}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-400">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 shrink-0 ml-1">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

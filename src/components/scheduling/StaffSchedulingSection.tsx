/**
 * StaffSchedulingSection — "Who handles bookings" (ui_plan Surface 3, v2 design).
 *
 * Admin: a glanceable read-out of which staff can take bookings, GROUPED BY PROGRAM and sorted
 * thinnest-coverage-first so gaps jump out. Program membership is DERIVED through the routing
 * chain (Program → appointment type.program_id → Handled-By-Team → team tag → staff
 * scheduling_tags), so the read-out reflects who actually gets routed a program's bookings —
 * see lib/scheduling/whoHandlesBookings. The person-scoped Edit modal writes program membership
 * back as team tags (§E13c PATCH /scheduling/employees/{id}); "Remind to connect" is a local v1
 * nudge (server-side lastRemindedAt + 24h cooldown is a follow-up).
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
  SchedulingApiError,
  type Program,
  type AppointmentType,
  type RoutingPolicy,
  type EmployeeSchedulingWrite,
} from '../../services/schedulingApi';
import type { TeamMember } from '../../types/analytics';
import { staffSchedulingStatus, staffWarning } from '../../lib/scheduling/staffStatus';
import {
  buildBookingGroups,
  programTagMap,
  coveragePill,
  applyProgramSelection,
  type MemberStatus,
} from '../../lib/scheduling/whoHandlesBookings';

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 422 && e.unknownTags?.length) return `Unknown team name(s): ${e.unknownTags.join(', ')}.`;
    if (e.status === 403) return "You don't have permission to change that.";
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Status pill styling per the v2 design (exact hues; paired with a text label). */
const STATUS_STYLE: Record<MemberStatus, { fg: string; bg: string; dot: boolean }> = {
  bookable: { fg: '#1C7A45', bg: '#ECFDF5', dot: true },
  paused: { fg: '#64748B', bg: '#F1F5F9', dot: false },
  needs_calendar: { fg: '#B54708', bg: '#FEF3C7', dot: false },
};

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

  // Remind-to-connect: local v1 (keyed by employee_id). The real version persists lastRemindedAt
  // server-side so the sent/cooldown state survives reload and is shared across admins.
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  // Person-scoped Edit modal (admin).
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ programs: Set<string>; pause: boolean; calendarEmail: string }>({
    programs: new Set(),
    pause: false,
    calendarEmail: '',
  });

  // Member self-card edit.
  const [selfEditing, setSelfEditing] = useState(false);
  const [selfCalEmail, setSelfCalEmail] = useState('');

  const load = useCallback(
    async (isActive: () => boolean) => {
      setLoading(true);
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

  const ptags = useMemo(() => programTagMap(appts, policies), [appts, policies]);
  const groups = useMemo(
    () => buildBookingGroups({ programs, appointmentTypes: appts, routingPolicies: policies, staff: members }),
    [programs, appts, policies, members],
  );
  // Only programs backed by a team (appointment type) are assignable in the modal.
  const assignablePrograms = useMemo(
    () => programs.filter((p) => (ptags.get(p.program_id) ?? []).length > 0),
    [programs, ptags],
  );

  function memberProgramsOf(m: TeamMember): Set<string> {
    const tags = new Set(m.scheduling_tags ?? []);
    const s = new Set<string>();
    for (const p of programs) {
      if ((ptags.get(p.program_id) ?? []).some((t) => tags.has(t))) s.add(p.program_id);
    }
    return s;
  }

  function openEdit(employeeId: string) {
    const m = members.find((x) => x.employee_id === employeeId);
    if (!m) return;
    setEditId(employeeId);
    setSaveError(null);
    setDraft({
      programs: memberProgramsOf(m),
      pause: m.bookable_override === 'off',
      calendarEmail: m.calendar_email_override ?? '',
    });
  }

  function toggleProgram(pid: string) {
    setDraft((d) => {
      const s = new Set(d.programs);
      if (s.has(pid)) s.delete(pid);
      else s.add(pid);
      return { ...d, programs: s };
    });
  }

  function mergeWritten(employeeId: string, written: EmployeeSchedulingWrite) {
    setMembers((prev) => prev.map((m) => (m.employee_id === employeeId ? { ...m, ...written } : m)));
  }

  async function saveEdit() {
    const m = members.find((x) => x.employee_id === editId);
    if (!m) return;
    setSaving(true);
    setSaveError(null);
    const scheduling_tags = applyProgramSelection(
      m.scheduling_tags ?? [],
      assignablePrograms.map((p) => p.program_id),
      draft.programs,
      ptags,
    );
    try {
      const res = await updateEmployeeScheduling(m.employee_id, {
        scheduling_tags,
        bookable_override: draft.pause ? 'off' : null,
        calendar_email_override: draft.calendarEmail.trim() || null,
      });
      const { employee_id: _id, ...written } = res;
      mergeWritten(m.employee_id, written);
      setEditId(null);
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
      const res = await updateEmployeeScheduling(me.employee_id, {
        calendar_email_override: selfCalEmail.trim() || null,
      });
      const { employee_id: _id, ...written } = res;
      mergeWritten(me.employee_id, written);
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
      <p className="text-sm text-red-600 py-8 text-center" role="alert">
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
        {saveError && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{saveError}</p>}
        <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
          {me.scheduling_tags && me.scheduling_tags.length > 0 && (
            <p className="text-xs text-slate-500">Your teams: {me.scheduling_tags.join(', ')}</p>
          )}
          {meWarning && (
            <p className="text-xs text-amber-600" role="status">
              ⚠{' '}
              {meWarning === 'Connect calendar to be bookable' ? (
                <>
                  {meWarning}.{' '}
                  <a href="?settings_tab=calendar" className="underline hover:text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded" aria-label="Open Integrations to connect your calendar">
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

  // ---- Admin: "Who handles bookings" read-out, grouped by program ----
  const editMember = editId ? members.find((m) => m.employee_id === editId) : null;

  return (
    <section aria-label="Who handles bookings" className="flex flex-col">
      <div>
        <h3 className="text-[17px] font-bold text-slate-900">Who handles bookings</h3>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Staff who can take bookings, grouped by program so you can spot coverage gaps at a glance.
        </p>
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No programs defined for this tenant yet.</p>
      ) : (
        groups.map((g) => {
          const pill = coveragePill(g.bookableCount, g.memberCount);
          return (
            <div key={g.program_id} className="mt-[18px]">
              <div className="flex items-center gap-2.5 mb-1">
                <span aria-hidden="true" className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: g.color.fg }} />
                <span className="text-[13.5px] font-bold text-slate-900">{g.program_name}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ color: pill.fg, background: pill.bg }}>
                  {pill.label}
                </span>
              </div>
              {g.members.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2 pl-[21px]">No staff assigned to this program.</p>
              ) : (
                g.members.map((m) => {
                  const st = STATUS_STYLE[m.status];
                  const isReminded = reminded.has(m.employee_id);
                  return (
                    <div key={m.employee_id} className="flex items-center gap-[11px] py-2.5 border-b border-slate-100">
                      <StaffAvatar name={m.name} initials={m.initials} isAdmin={m.isAdmin} imageUrl={m.image_url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-slate-900 truncate">{m.name}</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ color: st.fg, background: st.bg }}>
                            {st.dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.fg }} />}
                            {m.statusLabel}
                          </span>
                        </div>
                        {m.secondary && <div className="text-[12px] text-slate-400 mt-0.5">{m.secondary}</div>}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {m.status === 'needs_calendar' &&
                          (isReminded ? (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-400 whitespace-nowrap">
                              <CheckIcon /> Reminder sent · just now
                            </span>
                          ) : (
                            <>
                              <button onClick={() => remind(m.employee_id)} className="text-[13px] font-semibold whitespace-nowrap" style={{ color: '#1C7A45' }}>
                                Remind to connect
                              </button>
                              <span aria-hidden="true" className="w-px h-3.5 bg-slate-200" />
                            </>
                          ))}
                        <button onClick={() => openEdit(m.employee_id)} className="text-[13px] font-semibold text-slate-500 hover:text-slate-700">
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })
      )}

      {/* Footer: staff are managed in the Team tab; this section is a read-out. NO invite button. */}
      <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-slate-100">
        <span className="text-[12.5px] text-slate-400">Staff are added in the Team tab and appear here automatically.</span>
        <a href="?settings_tab=team" className="inline-flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap" style={{ color: '#1C7A45' }}>
          Manage team <ArrowRightIcon />
        </a>
      </div>

      {editMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.35)' }} onClick={() => { setEditId(null); setSaveError(null); }}>
          <div className="bg-white rounded-2xl p-6 w-[min(440px,100%)] box-border shadow-[0_24px_60px_rgba(15,23,42,0.25)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[17px] font-bold text-slate-900">Edit {editMember.name || editMember.email}</div>
            <div className="text-[12.5px] text-slate-400 mt-0.5">Program assignment applies to this person across the whole section.</div>

            <div className="text-[11.5px] font-bold text-slate-600 tracking-[0.05em] mt-5">PROGRAMS</div>
            <div className="flex flex-col mt-1.5">
              {assignablePrograms.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">No programs have a bookable appointment type yet.</p>
              ) : (
                assignablePrograms.map((p) => (
                  <label key={p.program_id} className="flex items-center gap-3 py-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="w-5 h-5 accent-primary-600" checked={draft.programs.has(p.program_id)} onChange={() => toggleProgram(p.program_id)} />
                    {p.program_name}
                  </label>
                ))
              )}
            </div>

            <label className="flex items-center gap-3 pt-3 mt-2 border-t border-slate-100 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" className="w-5 h-5 accent-primary-600" checked={draft.pause} onChange={(e) => setDraft({ ...draft, pause: e.target.checked })} />
              Pause booking (force off)
            </label>

            <div className="text-[11.5px] font-bold text-slate-600 tracking-[0.05em] mt-[18px]">CALENDAR EMAIL</div>
            <input className={`${inputCls} mt-2`} type="email" aria-label="Calendar email" value={draft.calendarEmail} placeholder="optional — defaults to login email" onChange={(e) => setDraft({ ...draft, calendarEmail: e.target.value })} />

            {saveError && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3" role="alert">{saveError}</p>}

            <div className="flex items-center gap-4 mt-5">
              <button onClick={saveEdit} disabled={saving} className="border-none text-white font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50" style={{ background: '#50C878', boxShadow: '0 8px 24px rgba(80,200,120,0.28)' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditId(null); setSaveError(null); }} className="text-sm font-semibold text-slate-500">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Avatar — the member photo when present, else a gradient circle with initials. */
function StaffAvatar({ name, initials, isAdmin, imageUrl }: { name: string; initials: string; isAdmin: boolean; imageUrl?: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <span
      aria-hidden="true"
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold"
      style={isAdmin ? { background: 'linear-gradient(135deg,#6FD89A,#3FAE72)', color: '#fff' } : { background: '#E2E8F0', color: '#475569' }}
      title={name}
    >
      {initials}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

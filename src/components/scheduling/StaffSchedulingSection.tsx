/**
 * StaffSchedulingSection — E13 (ui_plan Surface 3): per-staff scheduling settings.
 *
 * Assigns the §E13b Teams (= scheduling_tags) to staff, completing the routing loop
 * (candidate-resolver reads scheduling_tags off the registry). Writes via §E13c
 * PATCH /scheduling/employees/{id} (lambda#259) — NO optimistic lock by design.
 *
 * Role-aware per the §8 matrix + §E13c per-field auth (server-enforced; UI mirrors it):
 *   - admin: full roster; edit each member's tags + bookable-override + calendar-email.
 *   - member: only their OWN record's calendar_email_override (self-editable); their tags
 *     / bookable are read-only, and other members' calendar emails come back null (PII gate).
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { fetchTeamMembers } from '../../services/analyticsApi';
import {
  fetchTagVocabulary,
  updateEmployeeScheduling,
  SchedulingApiError,
  type EmployeeSchedulingWrite,
} from '../../services/schedulingApi';
import type { TeamMember } from '../../types/analytics';
import {
  staffSchedulingStatus,
  staffWarning,
  matchesStaffFilter,
  type StaffFilter,
} from '../../lib/scheduling/staffStatus';

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 422 && e.unknownTags?.length) return `Unknown tag(s): ${e.unknownTags.join(', ')}.`;
    if (e.status === 403) return "You don't have permission to change that.";
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

interface Draft {
  tags: string[];
  bookableOff: boolean;
  calendarEmail: string;
}

export function StaffSchedulingSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const myEmail = user?.email?.toLowerCase();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [vocab, setVocab] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ tags: [], bookableOff: false, calendarEmail: '' });
  const [filter, setFilter] = useState<StaffFilter>('all');

  const load = useCallback(
    async (isActive: () => boolean) => {
      setLoading(true);
      setLoadError(null);
      try {
        const [m, v] = await Promise.all([
          fetchTeamMembers(),
          isAdmin ? fetchTagVocabulary() : Promise.resolve<string[]>([]),
        ]);
        if (!isActive()) return;
        setMembers(m.members);
        setVocab(v);
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

  function openEdit(m: TeamMember) {
    setEditingId(m.employee_id);
    setSaveError(null);
    setDraft({
      tags: m.scheduling_tags ?? [],
      bookableOff: m.bookable_override === 'off',
      calendarEmail: m.calendar_email_override ?? '',
    });
  }

  function toggleTag(tag: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  }

  /** Merge the server-echoed written fields back onto the row in state. */
  function applyWritten(employeeId: string, written: EmployeeSchedulingWrite) {
    setMembers((prev) =>
      prev.map((m) => (m.employee_id === employeeId ? { ...m, ...written } : m)),
    );
  }

  async function save(m: TeamMember, fields: EmployeeSchedulingWrite) {
    setSavingId(m.employee_id);
    setSaveError(null);
    try {
      const res = await updateEmployeeScheduling(m.employee_id, fields);
      const { employee_id: _id, ...written } = res;
      applyWritten(m.employee_id, written);
      setEditingId(null);
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSavingId(null);
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
    if (!me) {
      return <p className="text-sm text-slate-400">Your staff record isn't available.</p>;
    }
    const editing = editingId === me.employee_id;
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
                  <a
                    href="?settings_tab=calendar"
                    className="underline hover:text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                    aria-label="Go to Calendar settings to connect your calendar"
                  >
                    Go to Calendar settings
                  </a>
                </>
              ) : (
                meWarning
              )}
            </p>
          )}
          <div>
            <label htmlFor="my-cal-email" className="block text-xs font-medium text-slate-600 mb-1">Calendar email</label>
            {editing ? (
              <input id="my-cal-email" type="email" className={inputCls} value={draft.calendarEmail}
                placeholder="leave blank to use your login email"
                onChange={(e) => setDraft({ ...draft, calendarEmail: e.target.value })} />
            ) : (
              <p className="text-sm text-slate-700">{me.calendar_email_override || <span className="text-slate-400">— (login email)</span>}</p>
            )}
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={() => save(me, { calendar_email_override: draft.calendarEmail.trim() || null })}
                disabled={savingId === me.employee_id}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {savingId === me.employee_id ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
            </div>
          ) : (
            <button onClick={() => openEdit(me)} className="self-start text-sm text-primary-600 hover:text-primary-700">Edit</button>
          )}
        </div>
      </section>
    );
  }

  // ---- Admin roster ----
  const shown = members.filter((m) => matchesStaffFilter(staffSchedulingStatus(m), filter));
  return (
    <section aria-label="Staff scheduling" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Staff</h3>
          <p className="text-xs text-slate-500">Assign staff to teams (tags), force a booking pause, or set a booking calendar email.</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          Show
          <select
            aria-label="Filter staff"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StaffFilter)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All staff</option>
            <option value="bookable">Bookable</option>
            <option value="not_bookable">Not bookable</option>
            <option value="missing_connection">Missing connection</option>
          </select>
        </label>
      </div>
      {saveError && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{saveError}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No staff match this filter.</p>
      ) : (
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {shown.map((m) => {
          const editing = editingId === m.employee_id;
          const warning = staffWarning(staffSchedulingStatus(m));
          return (
            <li key={m.employee_id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{m.name || m.email}</p>
                  <p className="text-xs text-slate-400">
                    {(m.scheduling_tags?.length ?? 0) > 0 ? m.scheduling_tags!.join(', ') : 'No teams'}
                    {m.bookable_override === 'off' && <span className="ml-2 text-amber-600">· Booking paused</span>}
                  </p>
                  {warning && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      ⚠{' '}
                      {warning === 'Connect calendar to be bookable' ? (
                        <>
                          {warning}.{' '}
                          <a
                            href="?settings_tab=calendar"
                            className="underline hover:text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                            aria-label={`Go to Calendar settings to connect calendar for ${m.name || m.email}`}
                          >
                            Go to Calendar settings
                          </a>
                        </>
                      ) : (
                        warning
                      )}
                    </p>
                  )}
                </div>
                {!editing && (
                  <button onClick={() => openEdit(m)} className="shrink-0 text-sm text-primary-600 hover:text-primary-700">Edit</button>
                )}
              </div>

              {editing && (
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <span className="block text-xs font-medium text-slate-600 mb-1">Teams</span>
                    {vocab.length === 0 ? (
                      <p className="text-xs text-slate-400">No team tags defined in the tenant vocabulary.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {vocab.map((tag) => (
                          <label key={tag} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                            <input type="checkbox" checked={draft.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                            {tag}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={draft.bookableOff} onChange={(e) => setDraft({ ...draft, bookableOff: e.target.checked })} />
                    Pause booking (force off)
                  </label>
                  <div>
                    <label htmlFor={`cal-${m.employee_id}`} className="block text-xs font-medium text-slate-600 mb-1">Calendar email</label>
                    <input id={`cal-${m.employee_id}`} type="email" className={inputCls} value={draft.calendarEmail}
                      placeholder="optional — defaults to login email"
                      onChange={(e) => setDraft({ ...draft, calendarEmail: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => save(m, {
                        scheduling_tags: draft.tags,
                        bookable_override: draft.bookableOff ? 'off' : null,
                        calendar_email_override: draft.calendarEmail.trim() || null,
                      })}
                      disabled={savingId === m.employee_id}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                      {savingId === m.employee_id ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingId(null); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}

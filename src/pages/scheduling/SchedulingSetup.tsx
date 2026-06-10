/**
 * SchedulingSetup — E13/E13b: the Customer-Portal "Scheduling" Settings sub-tab
 * (SEAM-5: a NEW Settings sub-tab; does NOT extend TeamManagement.tsx).
 *
 * Tenant admins manage **Appointment Types** and **Teams** (= RoutingPolicies, D4 framing:
 * the word "tag" never surfaces). Writes the §A AppointmentType/RoutingPolicy tables via the
 * locked §E13b Analytics_Dashboard_API endpoints (lambda#258). ADMIN-only (the endpoints also
 * enforce it server-side). Optimistic-locked via If-Match; vocab-validation is server-side
 * (422 → unknownTags surfaced here).
 *
 * Deferred (v2 per §E13b): deletion (orphan-FK risk); tag-vocabulary editing (config-owned,
 * staging config is read-only — a new team's tag is typed and validated fail-closed on save).
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  fetchAppointmentTypes,
  fetchRoutingPolicies,
  createAppointmentType,
  updateAppointmentType,
  createRoutingPolicy,
  updateRoutingPolicy,
  ifMatchToken,
  SchedulingApiError,
  type AppointmentType,
  type RoutingPolicy,
  type AppointmentTypeWrite,
} from '../../services/schedulingApi';
import { StaffSchedulingSection } from '../../components/scheduling/StaffSchedulingSection';
import { NotificationTemplatesEditor } from '../../components/scheduling/NotificationTemplatesEditor';
import { lastEditedLabel } from '../../lib/scheduling/formatModifiedAt';

/** A routing policy's team label = its first tag value, or "Everyone (solo)" when unconditioned. */
function teamLabel(p: RoutingPolicy): string {
  const tag = p.tag_conditions?.[0]?.values?.[0];
  return tag ?? 'Everyone (solo)';
}

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    if (e.status === 409) return 'This was changed by someone else — reload and retry.';
    if (e.status === 422 && e.unknownTags?.length) {
      return `Unknown team tag(s): ${e.unknownTags.join(', ')}. Tags must be in the tenant vocabulary.`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const blankAppt: AppointmentTypeWrite = {
  name: '',
  duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  lead_time_minutes: 0,
  routing_policy_id: '',
};

export function SchedulingSetup() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [appts, setAppts] = useState<AppointmentType[]>([]);
  const [policies, setPolicies] = useState<RoutingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Appointment-type form: null = closed; {id?} = editing existing (id present) or creating.
  const [apptForm, setApptForm] = useState<
    (AppointmentTypeWrite & { _id?: string; _ifMatch?: string }) | null
  >(null);
  // Team form: null = closed; {_id} = editing existing, else creating.
  const [teamForm, setTeamForm] = useState<
    { tag: string; tie_breaker: 'round_robin' | 'first_available'; _id?: string; _ifMatch?: string } | null
  >(null);

  const load = useCallback(async (isActive: () => boolean) => {
    // Teams + Appointment Types are admin-only endpoints; members skip them and see
    // only the per-staff self-card (StaffSchedulingSection) rendered below.
    if (!isAdmin) {
      if (isActive()) setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [a, p] = await Promise.all([fetchAppointmentTypes(), fetchRoutingPolicies()]);
      if (!isActive()) return;
      setAppts(a);
      setPolicies(p);
    } catch (e) {
      if (isActive()) setLoadError(errMessage(e));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const reload = () => load(() => true);

  const policyById = (id: string) => policies.find((p) => p.routing_policy_id === id);

  async function saveAppt() {
    if (!apptForm) return;
    setSaving(true);
    setSaveError(null);
    const { _id, _ifMatch, ...body } = apptForm;
    try {
      if (_id) await updateAppointmentType(_id, body, _ifMatch ?? '*');
      else await createAppointmentType(body);
      setApptForm(null);
      await reload();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveTeam() {
    if (!teamForm) return;
    setSaving(true);
    setSaveError(null);
    const tag = teamForm.tag.trim();
    const body = {
      tie_breaker: teamForm.tie_breaker,
      tag_conditions: tag ? [{ operator: 'in_any' as const, values: [tag] }] : [],
    };
    try {
      if (teamForm._id) await updateRoutingPolicy(teamForm._id, body, teamForm._ifMatch ?? '*');
      else await createRoutingPolicy(body);
      setTeamForm(null);
      await reload();
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // Members see only their own per-staff card — no admin Teams / Appointment Types config.
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-8">
        <StaffSchedulingSection />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <div className="w-8 h-8 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Loading scheduling setup…</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-red-600 py-12 text-center" role="alert">
        Couldn't load scheduling setup: {loadError}
      </p>
    );
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  return (
    <div className="flex flex-col gap-8">
      {saveError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {saveError}
        </p>
      )}

      {/* ---- Teams (routing policies) ---- */}
      <section aria-label="Teams" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Teams</h3>
            <p className="text-xs text-slate-500">Who can be booked for an appointment type. Round-robin shares bookings across the team.</p>
          </div>
          <button
            onClick={() => { setTeamForm({ tag: '', tie_breaker: 'round_robin' }); setSaveError(null); }}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            + Add team
          </button>
        </div>

        {policies.length === 0 && !teamForm && (
          <p className="text-sm text-slate-400">No teams yet. Add one so appointment types have somewhere to route.</p>
        )}

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {policies.map((p) => (
            <li key={p.routing_policy_id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="text-slate-700">{teamLabel(p)}</span>
                <span className="ml-2 text-xs text-slate-400">{p.tie_breaker ?? 'round_robin'}</span>
                {lastEditedLabel(p.modified_at) && (
                  <p className="text-[11px] text-slate-400">{lastEditedLabel(p.modified_at)}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setTeamForm({
                    _id: p.routing_policy_id,
                    _ifMatch: ifMatchToken(p),
                    tag: p.tag_conditions?.[0]?.values?.[0] ?? '',
                    tie_breaker: p.tie_breaker ?? 'round_robin',
                  });
                  setSaveError(null);
                }}
                aria-label={`Edit team ${teamLabel(p)}`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Edit
              </button>
            </li>
          ))}
        </ul>

        {teamForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div>
              <label htmlFor="team-tag" className="block text-xs font-medium text-slate-600 mb-1">Team tag</label>
              <input
                id="team-tag"
                className={inputCls}
                value={teamForm.tag}
                placeholder="e.g. volunteer_coordinators (leave blank = everyone)"
                onChange={(e) => setTeamForm({ ...teamForm, tag: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Must match a tag in the tenant vocabulary; validated on save.</p>
            </div>
            <div>
              <label htmlFor="team-tie" className="block text-xs font-medium text-slate-600 mb-1">Assignment</label>
              <select
                id="team-tie"
                className={inputCls}
                value={teamForm.tie_breaker}
                onChange={(e) => setTeamForm({ ...teamForm, tie_breaker: e.target.value as 'round_robin' | 'first_available' })}
              >
                <option value="round_robin">Round-robin (share evenly)</option>
                <option value="first_available">First available</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={saveTeam} disabled={saving} className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : teamForm._id ? 'Save changes' : 'Save team'}
              </button>
              <button onClick={() => { setTeamForm(null); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Appointment Types ---- */}
      <section aria-label="Appointment types" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Appointment Types</h3>
            <p className="text-xs text-slate-500">What people can book, how long it takes, and which team handles it.</p>
          </div>
          <button
            onClick={() => { setApptForm({ ...blankAppt }); setSaveError(null); }}
            disabled={policies.length === 0}
            title={policies.length === 0 ? 'Add a team first' : undefined}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:text-slate-300"
          >
            + Add appointment type
          </button>
        </div>

        {appts.length === 0 && !apptForm && (
          <p className="text-sm text-slate-400">No appointment types yet.</p>
        )}

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {appts.map((a) => (
            <li key={a.appointment_type_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <p className="font-medium text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-400">
                  {a.duration_minutes} min · {policyById(a.routing_policy_id) ? teamLabel(policyById(a.routing_policy_id)!) : a.routing_policy_id}
                </p>
                {lastEditedLabel(a.modified_at) && (
                  <p className="text-[11px] text-slate-400">{lastEditedLabel(a.modified_at)}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setApptForm({
                    _id: a.appointment_type_id,
                    _ifMatch: ifMatchToken(a),
                    name: a.name,
                    duration_minutes: a.duration_minutes,
                    buffer_before_minutes: a.buffer_before_minutes ?? 0,
                    buffer_after_minutes: a.buffer_after_minutes ?? 0,
                    lead_time_minutes: a.lead_time_minutes ?? 0,
                    routing_policy_id: a.routing_policy_id,
                  });
                  setSaveError(null);
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Edit
              </button>
            </li>
          ))}
        </ul>

        {apptForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div>
              <label htmlFor="at-name" className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input id="at-name" className={inputCls} value={apptForm.name}
                onChange={(e) => setApptForm({ ...apptForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="at-duration" className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
                <input id="at-duration" type="number" min={1} max={480} className={inputCls} value={apptForm.duration_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-lead" className="block text-xs font-medium text-slate-600 mb-1">Min lead time (min)</label>
                <input id="at-lead" type="number" min={0} className={inputCls} value={apptForm.lead_time_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, lead_time_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-bb" className="block text-xs font-medium text-slate-600 mb-1">Buffer before (min)</label>
                <input id="at-bb" type="number" min={0} className={inputCls} value={apptForm.buffer_before_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, buffer_before_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-ba" className="block text-xs font-medium text-slate-600 mb-1">Buffer after (min)</label>
                <input id="at-ba" type="number" min={0} className={inputCls} value={apptForm.buffer_after_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, buffer_after_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label htmlFor="at-team" className="block text-xs font-medium text-slate-600 mb-1">Handled by team</label>
              <select id="at-team" className={inputCls} value={apptForm.routing_policy_id}
                onChange={(e) => setApptForm({ ...apptForm, routing_policy_id: e.target.value })}>
                <option value="">Select a team…</option>
                {policies.map((p) => (
                  <option key={p.routing_policy_id} value={p.routing_policy_id}>{teamLabel(p)}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={saveAppt} disabled={saving || !apptForm.name.trim() || !apptForm.routing_policy_id}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setApptForm(null); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Staff (per-staff scheduling settings, E13) ---- */}
      <StaffSchedulingSection />

      {/* ---- Notification templates (E14) ---- */}
      <NotificationTemplatesEditor />
    </div>
  );
}

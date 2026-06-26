/**
 * SchedulingSetup — the Customer-Portal "Scheduling" Settings sub-tab (E13/E13b, SEAM-5).
 *
 * Presented as a 3-stage lifecycle "spine" (per the "Scheduling Settings" design import):
 *   1. What can be booked  — Appointment Types + Teams (= RoutingPolicies, D4: never "tag")
 *   2. Who handles bookings — the per-staff roster (StaffSchedulingSection)
 *   3. Messages we send     — lifecycle-notice copy (NotificationTemplatesEditor slide-over)
 *
 * Tenant admins manage Appointment Types + Teams via the locked §E13b Analytics_Dashboard_API
 * endpoints (lambda#258), ADMIN-only (also enforced server-side). Optimistic-locked via If-Match;
 * vocab-validation is server-side (422 → unknownTags surfaced here). Members see only their own
 * per-staff self-card (StaffSchedulingSection), no spine.
 *
 * Deferred (v2 per §E13b): deletion (orphan-FK risk); tag-vocabulary editing (config-owned).
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
  fetchSchedulingActivation,
  initCalendarConnection,
  fetchCalendarConnectionStatus,
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

/** Human blurb for a team's assignment rule. */
function teamRule(p: RoutingPolicy): string {
  return (p.tie_breaker ?? 'round_robin') === 'first_available'
    ? 'First available'
    : 'Round-robin — shares bookings across the team';
}

/**
 * The conference modality a booking joins at start, mirroring the backend §B18b
 * CONFERENCE_LABELS. Absent → 'google_meet' (the server default), so a booking always
 * has somewhere to meet — the Booking_Commit_Handler mints the Meet/Zoom link.
 */
const CONFERENCE_LABELS: Record<string, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
};
function conferenceLabel(a: AppointmentType): string {
  return CONFERENCE_LABELS[a.conference_type ?? 'google_meet'] ?? 'Google Meet';
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

/** 3-step onboarding progress badges (Approve → Connect → Set up). */
function StepBadges({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['Approve scheduling', 'Connect your calendar', 'Set up scheduling'];
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 text-xs mb-5">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={n}
            className={[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
              active
                ? 'border-primary-300 bg-primary-50 text-primary-700 font-semibold'
                : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-400',
            ].join(' ')}
          >
            <span aria-hidden="true">{done ? '✓' : `${n}.`}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

/** One numbered node of the lifecycle spine: the bullet + connector rail and the card body. */
function StageCard({ n, last, children }: { n: number; last?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 sm:gap-[18px]">
      <div className="flex-none flex flex-col items-center">
        <div className="w-[30px] h-[30px] rounded-full bg-slate-900 text-white text-[13px] font-bold flex items-center justify-center">
          {n}
        </div>
        {!last && <div className="w-0.5 flex-1 bg-slate-200 my-1.5" />}
      </div>
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {children}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-2">
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-slate-900 mb-1.5">Scheduling</h1>
      <p className="text-[15px] text-slate-500">
        Set up what people can book and the messages they get along the way. Everything has a
        sensible default — you only change what you want.
      </p>
    </div>
  );
}

function VideoIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SchedulingSetup() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [appts, setAppts] = useState<AppointmentType[]>([]);
  const [policies, setPolicies] = useState<RoutingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 3-step onboarding gate — the setup is blocked until both prerequisites are met:
  //   (1) admin approves scheduling for the org  (2) connect your calendar  (3) set up
  const [readiness, setReadiness] =
    useState<'loading' | 'needs_activation' | 'needs_connection' | 'ready'>('loading');

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

  // Readiness gate (once on mount): org activation → viewer's calendar connection.
  useEffect(() => {
    let active = true;
    (async () => {
      let enabled: boolean;
      try {
        const act = await fetchSchedulingActivation();
        enabled = act.enabled;
      } catch {
        // Backward-compat: an API without the activation endpoint (e.g. prod before
        // lambda#347) → fall back to the dashboard_scheduling entitlement.
        enabled = user?.features?.dashboard_scheduling === true;
      }
      if (!active) return;
      if (!enabled) { setReadiness('needs_activation'); return; }
      // Activated → is the viewer's own calendar connected?
      let connected = false;
      try {
        const init = await initCalendarConnection();
        const status = await fetchCalendarConnectionStatus(init.status_url);
        connected = status.status === 'connected';
      } catch {
        connected = false;
      }
      if (!active) return;
      setReadiness(connected ? 'ready' : 'needs_connection');
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load admin config only once past the gate.
  useEffect(() => {
    if (readiness !== 'ready') return;
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load, readiness]);

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

  // ─── onboarding gate (blocks setup until org-on + calendar connected) ───────
  if (readiness === 'loading') {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
        <div className="w-8 h-8 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Checking scheduling status…</span>
      </div>
    );
  }
  if (readiness === 'needs_activation') {
    return (
      <div className="max-w-xl mx-auto text-center py-12" data-testid="gate-needs-activation">
        <StepBadges current={1} />
        <h3 className="text-base font-semibold text-slate-800 mb-1">Turn on scheduling for your organization</h3>
        {isAdmin ? (
          <>
            <p className="text-sm text-slate-500 mb-5">
              Approve scheduling, then connect your calendar to start taking bookings.
            </p>
            <a
              href="?settings_tab=calendar"
              className="inline-block px-4 py-2 text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
            >
              Go to Integrations
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Scheduling isn't enabled for your organization yet. Ask an admin to turn it on.
          </p>
        )}
      </div>
    );
  }
  if (readiness === 'needs_connection') {
    return (
      <div className="max-w-xl mx-auto text-center py-12" data-testid="gate-needs-connection">
        <StepBadges current={2} />
        <h3 className="text-base font-semibold text-slate-800 mb-1">Connect your calendar</h3>
        <p className="text-sm text-slate-500 mb-5">
          You're set up to schedule — connect your calendar in Integrations to become bookable,
          then come back here to finish.
        </p>
        <a
          href="?settings_tab=calendar"
          className="inline-block px-4 py-2 text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
        >
          Go to Integrations
        </a>
      </div>
    );
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
  const sectionLabel = 'text-[11px] font-bold tracking-[0.05em] uppercase text-slate-400';
  const editLink = 'text-[13px] font-bold text-primary-700 hover:text-primary-800 shrink-0';
  const addRow =
    'flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-[15px] py-3 text-[13.5px] font-semibold text-primary-700 hover:border-primary-400 hover:bg-primary-50/40 w-full text-left';

  // Members see only their own per-staff card — no admin Teams / Appointment Types config.
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <StaffSchedulingSection />
      </div>
    );
  }

  // ---- Stage 1 body: loading / error / content ----
  let stage1: React.ReactNode;
  if (loading) {
    stage1 = (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        <div className="w-7 h-7 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Loading scheduling setup…</span>
      </div>
    );
  } else if (loadError) {
    stage1 = (
      <p className="text-sm text-red-600 py-8 text-center" role="alert">
        Couldn't load scheduling setup: {loadError}
      </p>
    );
  } else {
    stage1 = (
      <>
        <div className="text-[17px] font-bold text-slate-900">What can be booked</div>
        <div className="text-[13px] text-slate-500 mt-0.5">The appointment types people can pick, and who handles each.</div>

        {saveError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4" role="alert">
            {saveError}
          </p>
        )}

        {/* Appointment types */}
        <div className={`${sectionLabel} mt-[18px] mb-2.5`}>Appointment types</div>
        <div className="flex flex-col gap-2">
          {appts.map((a) => (
            <div key={a.appointment_type_id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-[15px] py-3">
              <span className="w-[34px] h-[34px] rounded-[9px] bg-primary-50 flex items-center justify-center shrink-0 text-primary-700">
                <VideoIcon />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold text-slate-900">{a.name}</div>
                <div className="text-[12.5px] text-slate-500">
                  {a.duration_minutes} min · {conferenceLabel(a)} · {policyById(a.routing_policy_id) ? teamLabel(policyById(a.routing_policy_id)!) : a.routing_policy_id}
                </div>
                {lastEditedLabel(a.modified_at) && (
                  <div className="text-[11px] text-slate-400">{lastEditedLabel(a.modified_at)}</div>
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
                className={editLink}
              >
                Edit
              </button>
            </div>
          ))}
          {appts.length === 0 && !apptForm && (
            <p className="text-sm text-slate-400">No appointment types yet.</p>
          )}
          <button
            onClick={() => { setApptForm({ ...blankAppt }); setSaveError(null); }}
            disabled={policies.length === 0}
            title={policies.length === 0 ? 'Add a team first' : undefined}
            className={`${addRow} disabled:text-slate-300 disabled:border-slate-200 disabled:hover:bg-transparent`}
          >
            <PlusIcon />
            Add appointment type
          </button>
        </div>

        {apptForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 mt-2">
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

        {/* Teams */}
        <div className={`${sectionLabel} mt-5 mb-2.5`}>Teams</div>
        <div className="flex flex-col gap-2">
          {policies.map((p) => (
            <div key={p.routing_policy_id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-[15px] py-3">
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold text-slate-900">{teamLabel(p)}</div>
                <div className="text-[12.5px] text-slate-500">{teamRule(p)}</div>
                {lastEditedLabel(p.modified_at) && (
                  <div className="text-[11px] text-slate-400">{lastEditedLabel(p.modified_at)}</div>
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
                className={editLink}
              >
                Edit
              </button>
            </div>
          ))}
          {policies.length === 0 && !teamForm && (
            <p className="text-sm text-slate-400">No teams yet. Add one so appointment types have somewhere to route.</p>
          )}
          <button onClick={() => { setTeamForm({ tag: '', tie_breaker: 'round_robin' }); setSaveError(null); }} className={addRow}>
            <PlusIcon />
            Add team
          </button>
        </div>

        {teamForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 mt-2">
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
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader />
      <div className="mt-7">
        <StageCard n={1}>{stage1}</StageCard>
        <StageCard n={2}><StaffSchedulingSection /></StageCard>
        <StageCard n={3} last><NotificationTemplatesEditor /></StageCard>
      </div>
    </div>
  );
}

/**
 * SchedulingSetup — the Customer-Portal "Scheduling" Settings sub-tab.
 *
 * Presented as a 3-stage lifecycle "spine" (per the "Scheduling Settings" design):
 *   1. Who handles bookings — bookable programs + coverage (StaffSchedulingSection)
 *   2. What can be booked   — the appointment types a prospect can book, each tied to a program
 *                             and routed to that program's team
 *   3. Messages we send     — lifecycle-notice copy (NotificationTemplatesEditor slide-over)
 *
 * A program becomes bookable in §1 (which creates its Team); §2 only picks among bookable
 * programs — the team is that program's team (program↔team is 1:1). Admins manage appointment
 * types via the locked Analytics_Dashboard_API endpoints (ADMIN-only, also server-enforced),
 * optimistic-locked via If-Match. Members see only their own self-card (StaffSchedulingSection).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  fetchAppointmentTypes,
  fetchRoutingPolicies,
  fetchPrograms,
  createAppointmentType,
  updateAppointmentType,
  fetchSchedulingActivation,
  initCalendarConnection,
  fetchCalendarConnectionStatus,
  ifMatchToken,
  SchedulingApiError,
  type AppointmentType,
  type RoutingPolicy,
  type AppointmentTypeWrite,
  type Program,
} from '../../services/schedulingApi';
import { StaffSchedulingSection } from '../../components/scheduling/StaffSchedulingSection';
import { NotificationTemplatesEditor } from '../../components/scheduling/NotificationTemplatesEditor';
import { Select } from '../../components/shared/Select';
import { lastEditedLabel } from '../../lib/scheduling/formatModifiedAt';
import { bookablePrograms, programColor } from '../../lib/scheduling/whoHandlesBookings';

/** A routing policy's team label = its first tag value, or "Everyone" when unconditioned. */
function teamLabel(p: RoutingPolicy): string {
  return p.tag_conditions?.[0]?.values?.[0] ?? 'Everyone';
}

/**
 * The conference modality a booking joins at start (§B18b). Absent → 'google_meet'. Phase 1 ships
 * the two live providers; phone / in-person is a future provider (roadmap), so the picker lists
 * only what the backend accepts today.
 */
const CONFERENCE_LABELS: Record<string, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
};
function conferenceLabel(a: AppointmentType): string {
  return CONFERENCE_LABELS[a.conference_type ?? 'google_meet'] ?? 'Google Meet';
}

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong';
}

const blankAppt: AppointmentTypeWrite = {
  name: '',
  duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  lead_time_minutes: 0,
  conference_type: 'google_meet',
  routing_policy_id: '',
  program_id: '',
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
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SchedulingSetup() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [appts, setAppts] = useState<AppointmentType[]>([]);
  const [policies, setPolicies] = useState<RoutingPolicy[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 3-step onboarding gate — blocked until (1) org approves scheduling (2) calendar connected.
  const [readiness, setReadiness] =
    useState<'loading' | 'needs_activation' | 'needs_connection' | 'ready'>('loading');

  // Appointment-type form: null = closed; {_id} = editing existing, else creating.
  const [apptForm, setApptForm] = useState<
    (AppointmentTypeWrite & { _id?: string; _ifMatch?: string }) | null
  >(null);

  const load = useCallback(async (isActive: () => boolean) => {
    if (!isAdmin) {
      if (isActive()) setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [a, p, pr] = await Promise.all([
        fetchAppointmentTypes(),
        fetchRoutingPolicies(),
        fetchPrograms(),
      ]);
      if (!isActive()) return;
      setAppts(a);
      setPolicies(p);
      setPrograms(pr);
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
        enabled = user?.features?.dashboard_scheduling === true;
      }
      if (!active) return;
      if (!enabled) { setReadiness('needs_activation'); return; }
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

  useEffect(() => {
    if (readiness !== 'ready') return;
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load, readiness]);

  const reload = () => load(() => true);

  // Only bookable programs are pickable for an appointment type (make a program bookable in §1).
  const bps = useMemo(() => bookablePrograms(programs, policies), [programs, policies]);
  const programName = (id?: string) => programs.find((p) => p.program_id === id)?.program_name ?? id ?? 'Program';
  const apptTeamLabel = (a: AppointmentType) => {
    const p = policies.find((x) => x.routing_policy_id === a.routing_policy_id);
    return p ? teamLabel(p) : 'Unassigned';
  };

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

  // ─── onboarding gate ────────────────────────────────────────────────────────
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

  // Members see only their own per-staff card — no admin Appointment Types config.
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <StaffSchedulingSection />
      </div>
    );
  }

  // ---- §2 "What can be booked" body: loading / error / content ----
  let whatCanBeBooked: React.ReactNode;
  if (loading) {
    whatCanBeBooked = (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        <div className="w-7 h-7 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Loading appointment types…</span>
      </div>
    );
  } else if (loadError) {
    whatCanBeBooked = (
      <p className="text-sm text-danger-600 py-8 text-center" role="alert">
        Couldn't load appointment types: {loadError}
      </p>
    );
  } else {
    const noBookable = bps.length === 0;
    whatCanBeBooked = (
      <>
        <div className="text-[17px] font-bold text-slate-900">What can be booked</div>
        <div className="text-[13px] text-slate-500 mt-0.5">
          The calls a prospect can book from the chat widget. Each is tied to a program and routed to that program's team.
        </div>

        {saveError && (
          <p className="text-sm text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-4" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex flex-col gap-2 mt-4">
          {appts.map((a) => (
            <button
              key={a.appointment_type_id}
              onClick={() => {
                setApptForm({
                  _id: a.appointment_type_id,
                  _ifMatch: ifMatchToken(a),
                  name: a.name,
                  duration_minutes: a.duration_minutes,
                  buffer_before_minutes: a.buffer_before_minutes ?? 0,
                  buffer_after_minutes: a.buffer_after_minutes ?? 0,
                  lead_time_minutes: a.lead_time_minutes ?? 0,
                  conference_type: a.conference_type ?? 'google_meet',
                  routing_policy_id: a.routing_policy_id,
                  program_id: a.program_id ?? '',
                });
                setSaveError(null);
              }}
              className="w-full flex items-center gap-3 border border-slate-100 rounded-xl px-[15px] py-3 text-left hover:border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <span aria-hidden="true" className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ background: a.program_id ? programColor(a.program_id).fg : '#94A3B8' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold text-slate-900 truncate">{a.name || programName(a.program_id)}</div>
                <div className="text-[12.5px] text-slate-500 truncate">
                  {programName(a.program_id)} · {a.duration_minutes} min · {conferenceLabel(a)} · {apptTeamLabel(a)}
                </div>
                {lastEditedLabel(a.modified_at) && (
                  <div className="text-[11px] text-slate-400">{lastEditedLabel(a.modified_at)}</div>
                )}
              </div>
              <ChevronRightIcon />
            </button>
          ))}
          {appts.length === 0 && !apptForm && (
            <p className="text-sm text-slate-400">No appointment types yet.</p>
          )}
          <button
            onClick={() => { setApptForm({ ...blankAppt }); setSaveError(null); }}
            disabled={noBookable}
            title={noBookable ? 'Make a program bookable first (in “Who handles bookings”)' : undefined}
            className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-[15px] py-3 text-[13.5px] font-semibold text-primary-700 hover:border-primary-400 hover:bg-primary-50/40 w-full text-left disabled:text-slate-300 disabled:border-slate-200 disabled:hover:bg-transparent"
          >
            <PlusIcon />
            Add appointment type
          </button>
          {noBookable && appts.length === 0 && (
            <p className="text-xs text-slate-400">
              No bookable programs yet — make one bookable in “Who handles bookings” above.
            </p>
          )}
        </div>

        {apptForm && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 mt-3">
            <div>
              <Select
                label="Program"
                placeholder="Select a program…"
                value={apptForm.program_id}
                onChange={(v) => {
                  const bp = bps.find((b) => b.program_id === v);
                  // Bind the program AND its team (program↔team is 1:1); default the event title
                  // to the program name if the admin hasn't set one yet.
                  setApptForm({
                    ...apptForm,
                    program_id: v,
                    routing_policy_id: bp?.routing_policy_id ?? apptForm.routing_policy_id,
                    name: apptForm.name.trim() ? apptForm.name : (bp?.program_name ?? ''),
                  });
                }}
                options={bps.map((b) => ({ value: b.program_id, label: b.program_name }))}
              />
              <label htmlFor="at-program-id" className="block text-xs font-medium text-slate-600 mb-1 mt-2">Program ID</label>
              <input id="at-program-id" className={`${inputCls} bg-slate-50 text-slate-500 font-mono`}
                value={apptForm.program_id} readOnly aria-readonly="true" placeholder="—" />
              <p className="text-xs text-slate-400 mt-1">
                Programs come from your configuration, so the widget and backend can never drift.
              </p>
            </div>

            <div>
              <label htmlFor="at-title" className="block text-xs font-medium text-slate-600 mb-1">Event title</label>
              <input id="at-title" className={inputCls} value={apptForm.name} maxLength={200}
                placeholder="What the prospect sees on their calendar invite"
                onChange={(e) => setApptForm({ ...apptForm, name: e.target.value })} />
            </div>

            <Select
              label="Location"
              value={apptForm.conference_type ?? 'google_meet'}
              onChange={(v) => setApptForm({ ...apptForm, conference_type: v as 'google_meet' | 'zoom' })}
              options={[
                { value: 'google_meet', label: 'Google Meet' },
                { value: 'zoom', label: 'Zoom' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="at-duration" className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
                <input id="at-duration" type="number" min={15} max={480} step={15} className={inputCls} value={apptForm.duration_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-lead" className="block text-xs font-medium text-slate-600 mb-1">Min lead time (min)</label>
                <input id="at-lead" type="number" min={0} step={15} className={inputCls} value={apptForm.lead_time_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, lead_time_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-bb" className="block text-xs font-medium text-slate-600 mb-1">Buffer before (min)</label>
                <input id="at-bb" type="number" min={0} step={15} className={inputCls} value={apptForm.buffer_before_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, buffer_before_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="at-ba" className="block text-xs font-medium text-slate-600 mb-1">Buffer after (min)</label>
                <input id="at-ba" type="number" min={0} step={15} className={inputCls} value={apptForm.buffer_after_minutes}
                  onChange={(e) => setApptForm({ ...apptForm, buffer_after_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Select
                label="Handled by team"
                placeholder="Select a team…"
                value={apptForm.routing_policy_id}
                onChange={(v) => setApptForm({ ...apptForm, routing_policy_id: v })}
                options={bps.map((b) => ({ value: b.routing_policy_id, label: b.teamName }))}
              />
              <p className="text-xs text-slate-400 mt-1">
                Only teams from bookable programs are listed — manage teams in “Who handles bookings”.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveAppt} disabled={saving || !apptForm.program_id || !apptForm.routing_policy_id || !apptForm.name.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setApptForm(null); setSaveError(null); }} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>
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
        <StageCard n={1}><StaffSchedulingSection /></StageCard>
        <StageCard n={2}>{whatCanBeBooked}</StageCard>
        <StageCard n={3} last><NotificationTemplatesEditor /></StageCard>
      </div>
    </div>
  );
}

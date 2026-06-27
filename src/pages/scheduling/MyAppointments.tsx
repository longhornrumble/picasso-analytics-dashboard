/**
 * MyAppointments — the employee's primary scheduling view (Customer Portal, Surface 2).
 *
 * Master–detail realization of the "Scheduling + Lead Workspace" design: a day-grouped list
 * of the viewer's Picasso bookings (left) and a sticky preview of the selected one (right).
 * Pure render over a Booking[] (FROZEN_CONTRACTS §A) + the §8 permission filter — no fetch
 * here; SchedulingPage supplies the data.
 *
 * Meaningful-from-what-we-have: a few design fields (program category, relationship, last
 * touch) have no 1:1 backing field, so they are DERIVED honestly from booking data —
 * program ← appointment type, relationship ← whether the attendee recurs across bookings,
 * last touch ← when it was booked. The free-text "what they want to talk about" note and the
 * "Open Contact" deep-link genuinely need the lead's form submission; those light up once a
 * booking→lead link (Booking.submission_id, forward-compat optional) is projected — until
 * then the note shows an honest empty state and "Open Contact" self-disables.
 *
 * Security: attendee name/email are USER-GENERATED form data — rendered as text (React
 * escapes) or through https-only / mailto|tel hrefs built from the raw value.
 */
import { useMemo, useState } from 'react';
import type { Booking, BookingStatus, SchedulingViewer } from '../../types/scheduling';
import {
  visibleBookings,
  filterByTimeRange,
  filterByStatus,
  statusMeta,
  formatSlotLabel,
  appointmentTypeLabel,
  safeExternalHref,
  type TimeRange,
} from '../../lib/scheduling/bookingLogic';
import { BookingActions } from '../../components/scheduling/BookingActions';
import { LeadWorkspacePanel, type LeadWorkspaceLead } from '../../components/scheduling/LeadWorkspacePanel';

const SCOPES: { id: TimeRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
];

const STATUS_FILTERS: { id: BookingStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All dispositions' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Completed' },
  { id: 'no_show', label: 'No-show' },
  { id: 'coordinator_no_show', label: "Didn't connect" },
  { id: 'canceled', label: 'Canceled' },
];

/**
 * Sanctioned categorical program palette (from the design — a brand extension, AA-safe as
 * text, always paired with a label). Inline hex like the attribution/chart viz colors; keyed
 * to the program label by a stable hash so the same program always gets the same swatch.
 */
const PROGRAM_COLORS: { fg: string; bg: string }[] = [
  { fg: '#047857', bg: '#ecfdf5' }, // emerald (brand anchor)
  { fg: '#6d4ed6', bg: '#f1edfc' }, // violet
  { fg: '#a13670', bg: '#fbeaf2' }, // plum-rose
  { fg: '#0e7490', bg: '#e0f2f7' }, // cyan
  { fg: '#b45309', bg: '#fffbeb' }, // amber
];
function programColor(label: string): { fg: string; bg: string } {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return PROGRAM_COLORS[Math.abs(h) % PROGRAM_COLORS.length];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function relDayLabel(dayMs: number, nowMs: number): string {
  const diff = Math.round((dayMs - startOfDay(nowMs)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return new Date(dayMs).toLocaleDateString(undefined, { weekday: 'long' });
}
function dowLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}
function dayNum(ms: number): string {
  return String(new Date(ms).getDate());
}
function timeOnly(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
/** "3 days ago" / "2 hours ago" / "just now" — used for the derived "Booked · …" last touch. */
function agoLabel(iso: string | undefined, now: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const days = Math.floor(diff / DAY_MS);
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  if (hrs >= 1) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const mins = Math.floor(diff / 60000);
  if (mins >= 1) return `${mins} min ago`;
  return 'just now';
}

export function MyAppointments({
  bookings,
  viewer,
  appointmentTypeNames,
  now,
  onActionComplete,
}: {
  bookings: Booking[];
  viewer: SchedulingViewer;
  appointmentTypeNames?: Record<string, string>;
  /** Injected for deterministic time filtering; defaults to wall-clock at mount. */
  now?: number;
  /** Called after a booking action mutates the set, so the parent can re-fetch. */
  onActionComplete?: () => void;
}) {
  const [mountNow] = useState(() => Date.now());
  const ref = now ?? mountNow;
  const isAdmin = viewer.role === 'admin' || viewer.role === 'super_admin';

  const [timeRange, setTimeRange] = useState<TimeRange>('upcoming');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The Lead Workspace panel (slide-over). Desktop: opened from the preview's "Open Contact".
  // Mobile: opened directly by tapping a card (no inline preview on small screens).
  const [panelOpen, setPanelOpen] = useState(false);

  const visible = useMemo(() => visibleBookings(bookings, viewer), [bookings, viewer]);

  // "Returning" when the attendee email shows up on more than one of the viewer's bookings.
  const emailCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of visible) {
      const e = b.attendee?.email?.toLowerCase();
      if (e) m.set(e, (m.get(e) ?? 0) + 1);
    }
    return m;
  }, [visible]);
  const relationshipOf = (b: Booking): 'New' | 'Returning' => {
    const e = b.attendee?.email?.toLowerCase();
    return e && (emailCounts.get(e) ?? 0) > 1 ? 'Returning' : 'New';
  };
  const lastTouchOf = (b: Booking): string => {
    const ago = agoLabel(b.created_at, ref);
    return ago ? `Booked · ${ago}` : 'Booked via Picasso';
  };

  const scopeCounts = useMemo(() => {
    const counts = {} as Record<TimeRange, number>;
    for (const s of SCOPES) counts[s.id] = filterByTimeRange(visible, s.id, ref).length;
    return counts;
  }, [visible, ref]);

  // Filter dropdown option sets, derived from the visible bookings.
  const programOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const b of visible) if (b.appointment_type_id) ids.add(b.appointment_type_id);
    return [...ids].sort();
  }, [visible]);
  const staffOptions = useMemo(() => {
    const emails = new Set<string>();
    for (const b of visible) if (b.coordinator_email) emails.add(b.coordinator_email);
    return [...emails].sort();
  }, [visible]);

  const shown = useMemo(() => {
    let list = filterByTimeRange(visible, timeRange, ref);
    list = filterByStatus(list, statusFilter);
    if (programFilter !== 'all') list = list.filter((b) => (b.appointment_type_id ?? '') === programFilter);
    if (staffFilter !== 'all') list = list.filter((b) => (b.coordinator_email ?? '') === staffFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          (b.attendee?.name ?? '').toLowerCase().includes(q) ||
          (b.attendee?.email ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  }, [visible, timeRange, statusFilter, programFilter, staffFilter, search, ref]);

  const dayGroups = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of shown) {
      const t = Date.parse(b.start_at);
      if (Number.isNaN(t)) continue;
      const day = startOfDay(t);
      const arr = map.get(day);
      if (arr) arr.push(b);
      else map.set(day, [b]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        rel: relDayLabel(day, ref),
        full: new Date(day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
        count: items.length,
        items,
      }));
  }, [shown, ref]);

  const selected = useMemo(
    () => shown.find((b) => b.booking_id === selectedId) ?? shown[0] ?? null,
    [shown, selectedId],
  );

  function openPanel() {
    setPanelOpen(true);
  }
  // Tapping a card always selects it; on mobile (no inline preview) it also opens the panel.
  function selectCard(b: Booking) {
    setSelectedId(b.booking_id);
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1023px)').matches
    ) {
      setPanelOpen(true);
    }
  }
  const selectedIdx = shown.findIndex((b) => b.booking_id === selected?.booking_id);
  function stepRecord(delta: number) {
    if (shown.length === 0) return;
    const next = shown[(selectedIdx + delta + shown.length) % shown.length];
    setSelectedId(next.booking_id);
  }

  // The Lead Workspace panel's data: the selected booking + its server-joined lead summary
  // (note / phase / form fields / app name), with empty states for whatever the join lacks.
  const panelLead: LeadWorkspaceLead | null = selected
    ? {
        name: selected.attendee?.name?.trim() || 'Guest',
        relationship: relationshipOf(selected),
        appName: selected.lead?.app_name ?? appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames),
        program: appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames),
        programColor: programColor(appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames)),
        phone: selected.attendee?.phone,
        email: selected.attendee?.email,
        note: selected.lead?.note,
        phase: selected.lead?.phase,
        fields: selected.lead?.fields,
        activity: (() => {
          const acts: { label: string; meta: string }[] = [];
          if (selected.lead?.submitted_at)
            acts.push({
              label: 'Form submitted',
              meta: `${selected.lead.app_name ?? 'Application'} · ${agoLabel(selected.lead.submitted_at, ref)}`,
            });
          if (selected.created_at) acts.push({ label: 'Appointment booked', meta: agoLabel(selected.created_at, ref) });
          return acts;
        })(),
        appointments: [
          {
            dow: dowLabel(Date.parse(selected.start_at)),
            day: dayNum(Date.parse(selected.start_at)),
            title: appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames),
            time: formatSlotLabel(selected.start_at, selected.end_at),
            dispo: statusMeta(selected.status).label,
            joinable: !!safeExternalHref(selected.html_link) && selected.status === 'booked' && Date.parse(selected.start_at) >= ref,
            joinHref: safeExternalHref(selected.html_link),
          },
        ],
      }
    : null;

  const ddCls =
    'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">My Appointments</h2>
        <p className="text-sm text-slate-500">Booked through your MyRecruiter Virtual Assistant</p>
      </div>

      {/* Scope chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SCOPES.map((s) => {
          const active = timeRange === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTimeRange(s.id)}
              aria-pressed={active}
              className={`flex-none rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {s.label} <span className={active ? 'opacity-90' : 'opacity-60'}>{scopeCounts[s.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5">
        <label className="sr-only" htmlFor="appt-program">Filter by program</label>
        <select id="appt-program" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={ddCls}>
          <option value="all">All programs</option>
          {programOptions.map((id) => (
            <option key={id} value={id}>
              {appointmentTypeLabel(id, appointmentTypeNames)}
            </option>
          ))}
        </select>

        {isAdmin && staffOptions.length > 0 && (
          <>
            <label className="sr-only" htmlFor="appt-staff">Filter by staff</label>
            <select id="appt-staff" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={ddCls}>
              <option value="all">All staff</option>
              {staffOptions.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </>
        )}

        <label className="sr-only" htmlFor="appt-disposition">Filter by disposition</label>
        <select id="appt-disposition" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')} className={ddCls}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>

        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email…"
            aria-label="Search appointments by name or email"
            className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Master–detail */}
      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No appointments match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
          {/* LEFT: day-grouped rows */}
          <div role="list" aria-label="Appointments" className="flex flex-col gap-4">
            {dayGroups.map((grp) => (
              <div key={grp.day}>
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <span className="text-sm font-bold text-slate-900">{grp.rel}</span>
                  <span className="text-xs font-semibold text-slate-400">{grp.full}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{grp.count}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {grp.items.map((b) => {
                    const active = selected?.booking_id === b.booking_id;
                    const t = Date.parse(b.start_at);
                    const program = appointmentTypeLabel(b.appointment_type_id, appointmentTypeNames);
                    const pc = programColor(program);
                    const rel = relationshipOf(b);
                    const calHref = safeExternalHref(b.html_link);
                    const joinable = !!calHref && b.status === 'booked' && t >= ref;
                    return (
                      <div role="listitem" key={b.booking_id}>
                        <div
                          className={`flex items-center gap-3.5 rounded-xl border bg-white px-3.5 py-3 transition-shadow ${
                            active
                              ? 'border-primary-600 shadow-[0_2px_10px_rgba(80,200,120,0.14)] border-[1.5px]'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectCard(b)}
                            aria-pressed={active}
                            className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                          >
                            <div className="w-11 flex-none text-center">
                              <div className="text-[10px] font-bold uppercase text-slate-400">{dowLabel(t)}</div>
                              <div className="text-lg font-bold leading-none text-slate-900">{dayNum(t)}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center gap-2">
                                <span className="truncate text-[15px] font-bold text-slate-900">{b.attendee?.name?.trim() || 'Guest'}</span>
                                <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">{rel}</span>
                              </div>
                              <div className="mb-1 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 flex-none rounded-sm" style={{ background: pc.fg }} />
                                <span className="truncate text-xs font-semibold text-slate-500">{program}</span>
                              </div>
                              <div className="text-[11.5px] font-semibold text-slate-400">{lastTouchOf(b)}</div>
                            </div>
                          </button>
                          <div className="flex flex-none flex-col items-end gap-1.5">
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-600">{timeOnly(b.start_at)}</div>
                              <div className="text-[11px] font-semibold text-slate-400">{timeOnly(b.end_at)}</div>
                            </div>
                            {(joinable || calHref) && (
                              <div className="flex items-center gap-1.5">
                                {joinable && (
                                  <a
                                    href={calHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700 hover:bg-primary-100"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5v1.8l4.3-2.6a.55.55 0 0 1 .85.47v9.66a.55.55 0 0 1-.85.47L14 14.7v1.8A1.5 1.5 0 0 1 12.5 18h-8A1.5 1.5 0 0 1 3 16.5v-9Z" fill="currentColor" /></svg>
                                    Join
                                  </a>
                                )}
                                {calHref && (
                                  <a
                                    href={calHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Open in Google Calendar"
                                    className="inline-flex items-center rounded-full border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: sticky preview of the selected appointment */}
          {selected &&
            (() => {
              const program = appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames);
              const pc = programColor(program);
              const rel = relationshipOf(selected);
              const meta = statusMeta(selected.status);
              const calHref = safeExternalHref(selected.html_link);
              const joinable = !!calHref && selected.status === 'booked' && Date.parse(selected.start_at) >= ref;
              const qaCls =
                'flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3.5 text-[11px] font-bold text-primary-700 hover:border-primary-200 hover:bg-primary-50';
              return (
                /* Desktop-only inline preview; on mobile a card tap opens the full Lead Workspace panel instead. */
                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-6 lg:block">
                  <div className="border-b border-slate-100 px-6 py-5" style={{ background: pc.bg }}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold" style={{ color: pc.fg }}>
                        <span className="h-2 w-2 rounded-sm" style={{ background: pc.fg }} />
                        {program}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-600">{rel}</span>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${meta.chipClass}`}>{meta.label}</span>
                      {joinable && (
                        <a href={calHref} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(80,200,120,0.28)] hover:bg-primary-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5v1.8l4.3-2.6a.55.55 0 0 1 .85.47v9.66a.55.55 0 0 1-.85.47L14 14.7v1.8A1.5 1.5 0 0 1 12.5 18h-8A1.5 1.5 0 0 1 3 16.5v-9Z" fill="currentColor" /></svg>
                          Join
                        </a>
                      )}
                    </div>
                    <div className="text-xl font-bold tracking-tight text-slate-900">{selected.attendee?.name?.trim() || 'Guest'}</div>
                    <div className="text-sm font-semibold text-slate-600">
                      {program} · {formatSlotLabel(selected.start_at, selected.end_at)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Contact</div>
                      {selected.attendee?.email ? (
                        <a href={`mailto:${selected.attendee.email}`} className="block truncate text-sm font-semibold text-slate-700 hover:text-primary-700">{selected.attendee.email}</a>
                      ) : (
                        <div className="text-sm font-semibold text-slate-400">No email</div>
                      )}
                      {selected.attendee?.phone ? (
                        <a href={`tel:${selected.attendee.phone}`} className="mt-1 block text-sm font-semibold text-slate-600 hover:text-primary-700">{selected.attendee.phone}</a>
                      ) : (
                        <div className="mt-1 text-sm font-semibold text-slate-400">No phone</div>
                      )}
                    </div>
                    <div>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Last touch</div>
                      <div className="text-sm font-semibold text-slate-600">{lastTouchOf(selected)}</div>
                      <div className="mt-1 truncate text-sm text-slate-500">Host: {selected.coordinator_email || 'Unassigned'}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">What they want to talk about</div>
                      {selected.lead?.note ? (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
                          “{selected.lead.note}”
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-400">
                          Conversation context appears here once this booking is linked to the lead's profile.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-6 py-5">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {calHref ? (
                        <a href={calHref} target="_blank" rel="noopener noreferrer" className={qaCls}>
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5v1.8l4.3-2.6a.55.55 0 0 1 .85.47v9.66a.55.55 0 0 1-.85.47L14 14.7v1.8A1.5 1.5 0 0 1 12.5 18h-8A1.5 1.5 0 0 1 3 16.5v-9Z" fill="currentColor" /></svg>
                          Join Meeting
                        </a>
                      ) : (
                        <button type="button" disabled className={qaCls} title="No meeting link on this booking">
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5v1.8l4.3-2.6a.55.55 0 0 1 .85.47v9.66a.55.55 0 0 1-.85.47L14 14.7v1.8A1.5 1.5 0 0 1 12.5 18h-8A1.5 1.5 0 0 1 3 16.5v-9Z" fill="currentColor" /></svg>
                          Join Meeting
                        </button>
                      )}
                      {calHref ? (
                        <a href={calHref} target="_blank" rel="noopener noreferrer" className={qaCls}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
                          Calendar
                        </a>
                      ) : (
                        <button type="button" disabled className={qaCls} title="No calendar link on this booking">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
                          Calendar
                        </button>
                      )}
                      <button type="button" onClick={openPanel} className={qaCls}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M14 4v4h4M8 13h8M8 16.5h5" /></svg>
                        Add Note
                      </button>
                      <button type="button" onClick={openPanel} className={qaCls}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></svg>
                        Open Contact
                      </button>
                    </div>

                    <div className="mt-3">
                      <BookingActions booking={selected} viewer={viewer} onActionComplete={onActionComplete} />
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* Lead Workspace panel (to-spec component) — opens from "Open Contact" (desktop) or a card tap (mobile). */}
      <LeadWorkspacePanel
        lead={panelLead}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onNext={() => stepRecord(1)}
        onPrev={() => stepRecord(-1)}
        queueCount={Math.max(0, shown.length - 1)}
      />
    </div>
  );
}

/**
 * MyAppointments — the employee's primary scheduling view (Customer Portal, Surface 2).
 *
 * Master–detail redesign of the booking list ("Scheduling + Lead Workspace" design): a
 * day-grouped list of the viewer's Picasso bookings on the left, a sticky preview of the
 * selected appointment on the right. Pure render over a Booking[] (FROZEN_CONTRACTS §A) +
 * the §8 permission filter — no fetch here; SchedulingPage supplies the data.
 *
 * Honest degradation: the design also shows program category / relationship / last-touch /
 * "what they want to talk about". Those live on the lead's FORM SUBMISSION, not the booking
 * projection, so they are intentionally omitted here. The lead's full context (form data,
 * notes, activity) is reached by REUSING the existing LeadWorkspaceDrawer via "Open Contact"
 * — which needs a booking→lead link (Booking.submission_id, forward-compat optional). Until
 * the read projection surfaces it, that action self-disables.
 *
 * Security: attendee name/email are USER-GENERATED form data — rendered as text (React
 * escapes) or through https-only safe hrefs (safeExternalHref / mailto|tel built from the
 * raw value, never interpolated into HTML).
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
import { LeadWorkspaceDrawer } from '../../components/lead-workspace';

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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today" / "Tomorrow" / "Yesterday" / weekday name, relative to `now`. */
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

  const [timeRange, setTimeRange] = useState<TimeRange>('upcoming');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visible = useMemo(() => visibleBookings(bookings, viewer), [bookings, viewer]);

  const scopeCounts = useMemo(() => {
    const counts = {} as Record<TimeRange, number>;
    for (const s of SCOPES) counts[s.id] = filterByTimeRange(visible, s.id, ref).length;
    return counts;
  }, [visible, ref]);

  const shown = useMemo(() => {
    const byRange = filterByTimeRange(visible, timeRange, ref);
    const byStatus = filterByStatus(byRange, statusFilter);
    const q = search.trim().toLowerCase();
    const bySearch = q
      ? byStatus.filter(
          (b) =>
            (b.attendee?.name ?? '').toLowerCase().includes(q) ||
            (b.attendee?.email ?? '').toLowerCase().includes(q),
        )
      : byStatus;
    return [...bySearch].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  }, [visible, timeRange, statusFilter, search, ref]);

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

  function openContact(b: Booking | null) {
    if (!b?.submission_id) return;
    setDrawerLeadId(b.submission_id);
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
    // Delay clearing the id so the drawer can animate out.
    setTimeout(() => setDrawerLeadId(null), 300);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">My Appointments</h2>
        <p className="text-sm text-slate-500">
          Booked through your MyRecruiter Virtual Assistant
        </p>
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
                active
                  ? 'bg-primary-700 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {s.label}{' '}
              <span className={active ? 'opacity-90' : 'opacity-60'}>{scopeCounts[s.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5">
        <label className="sr-only" htmlFor="appt-disposition">
          Filter by disposition
        </label>
        <select
          id="appt-disposition"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
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
        <p className="py-12 text-center text-sm text-slate-400">
          No appointments match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
          {/* LEFT: day-grouped rows */}
          <div role="list" aria-label="Appointments" className="flex flex-col gap-4">
            {dayGroups.map((grp) => (
              <div key={grp.day}>
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <span className="text-sm font-bold text-slate-900">{grp.rel}</span>
                  <span className="text-xs font-semibold text-slate-400">{grp.full}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {grp.count}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {grp.items.map((b) => {
                    const active = selected?.booking_id === b.booking_id;
                    const t = Date.parse(b.start_at);
                    const meta = statusMeta(b.status);
                    return (
                      <div role="listitem" key={b.booking_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(b.booking_id)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-3.5 rounded-xl border bg-white px-3.5 py-3 text-left transition-shadow ${
                          active
                            ? 'border-primary-600 shadow-[0_2px_10px_rgba(80,200,120,0.14)] border-[1.5px]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-11 flex-none text-center">
                          <div className="text-[10px] font-bold uppercase text-slate-400">
                            {dowLabel(t)}
                          </div>
                          <div className="text-lg font-bold leading-none text-slate-900">
                            {dayNum(t)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="truncate text-[15px] font-bold text-slate-900">
                              {b.attendee?.name?.trim() || 'Guest'}
                            </span>
                            <span
                              className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold ${meta.chipClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 flex-none rounded-sm bg-primary-500" />
                            <span className="truncate text-xs font-semibold text-slate-500">
                              {appointmentTypeLabel(b.appointment_type_id, appointmentTypeNames)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <div className="text-xs font-bold text-slate-600">{timeOnly(b.start_at)}</div>
                          <div className="text-[11px] font-semibold text-slate-400">
                            {timeOnly(b.end_at)}
                          </div>
                        </div>
                      </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: sticky preview of the selected appointment */}
          {selected && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-6">
              <div className="border-b border-slate-100 bg-primary-50 px-6 py-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-700">
                    <span className="h-2 w-2 rounded-sm bg-primary-500" />
                    {appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusMeta(selected.status).chipClass}`}
                  >
                    {statusMeta(selected.status).label}
                  </span>
                  {safeExternalHref(selected.html_link) && (
                    <a
                      href={safeExternalHref(selected.html_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3.5 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100"
                    >
                      Open in Google Calendar →
                    </a>
                  )}
                </div>
                <div className="text-xl font-bold tracking-tight text-slate-900">
                  {selected.attendee?.name?.trim() || 'Guest'}
                </div>
                <div className="text-sm font-semibold text-slate-600">
                  {appointmentTypeLabel(selected.appointment_type_id, appointmentTypeNames)} ·{' '}
                  {formatSlotLabel(selected.start_at, selected.end_at)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Contact
                  </div>
                  {selected.attendee?.email ? (
                    <a
                      href={`mailto:${selected.attendee.email}`}
                      className="block truncate text-sm font-semibold text-slate-700 hover:text-primary-700"
                    >
                      {selected.attendee.email}
                    </a>
                  ) : (
                    <div className="text-sm font-semibold text-slate-400">No email</div>
                  )}
                  {selected.attendee?.phone ? (
                    <a
                      href={`tel:${selected.attendee.phone}`}
                      className="mt-1 block text-sm font-semibold text-slate-600 hover:text-primary-700"
                    >
                      {selected.attendee.phone}
                    </a>
                  ) : (
                    <div className="mt-1 text-sm font-semibold text-slate-400">No phone</div>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Host
                  </div>
                  <div className="truncate text-sm font-semibold text-slate-600">
                    {selected.coordinator_email || 'Unassigned'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 px-6 py-5">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Quick Actions
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {safeExternalHref(selected.html_link) && (
                    <a
                      href={safeExternalHref(selected.html_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3.5 text-[11px] font-bold text-primary-700 hover:border-primary-200 hover:bg-primary-50"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
                      Calendar
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openContact(selected)}
                    disabled={!selected.submission_id}
                    title={selected.submission_id ? undefined : 'Lead profile link not available for this booking yet'}
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3.5 text-[11px] font-bold text-primary-700 hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></svg>
                    Open Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => openContact(selected)}
                    disabled={!selected.submission_id}
                    title={selected.submission_id ? undefined : 'Lead profile link not available for this booking yet'}
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3.5 text-[11px] font-bold text-primary-700 hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M14 4v4h4M8 13h8M8 16.5h5" /></svg>
                    Add Note
                  </button>
                </div>

                {/* Real per-booking disposition / cancel actions (self-gates to an actionable booking). */}
                <div className="mt-3">
                  <BookingActions booking={selected} viewer={viewer} onActionComplete={onActionComplete} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reused Lead Workspace overlay (from the Forms page) — opens for the selected lead. */}
      <LeadWorkspaceDrawer leadId={drawerLeadId} isOpen={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}

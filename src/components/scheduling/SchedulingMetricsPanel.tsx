/**
 * SchedulingMetricsPanel — Surface 8 historical metrics (ui_plan §8 v1-must:
 * booking volume + no-show rate).
 *
 * Derived purely from the §E7 Booking rows the dashboard already fetches — no separate
 * metrics endpoint (same approach as OperationalDebtPanel). The viewer scope is applied
 * upstream (SchedulingAnalytics passes the already-scoped set), so admin sees the tenant
 * aggregate and a staff member sees their own.
 */
import { useState } from 'react';
import type { Booking } from '../../types/scheduling';
import {
  computeBookingMetrics,
  formatRate,
  noShowByAppointmentType,
  appointmentTypeLabel,
} from '../../lib/scheduling/bookingLogic';

export function SchedulingMetricsPanel({
  bookings,
  now,
  appointmentTypeNames,
}: {
  bookings: Booking[];
  /** Injected for determinism; defaults to wall-clock in the app. */
  now?: number;
  /**
   * id→name map for the per-type no-show breakdown. Only the admin tenant-aggregate view
   * provides it (the appointment-types endpoint is admin-only); when absent the breakdown
   * is hidden (a staff own-view doesn't get the per-type slice).
   */
  appointmentTypeNames?: Record<string, string>;
}) {
  // Capture wall-clock once at mount (lazy init keeps render pure); tests pass `now`.
  const [mountNow] = useState(() => Date.now());
  const ref = now ?? mountNow;
  const m = computeBookingMetrics(bookings, ref);
  const byType = appointmentTypeNames ? noShowByAppointmentType(bookings) : [];

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: 'Total bookings', value: String(m.total), hint: 'last 90 days' },
    { label: 'Upcoming', value: String(m.upcoming) },
    { label: 'Last 30 days', value: String(m.last30d) },
    { label: 'No-show rate', value: formatRate(m.noShowRate), hint: 'of dispositioned' },
    { label: 'Completion rate', value: formatRate(m.completionRate), hint: 'of dispositioned' },
    { label: 'Cancellation rate', value: formatRate(m.cancellationRate), hint: 'of all' },
  ];

  return (
    <section aria-label="Booking metrics" className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Booking volume &amp; outcomes
        </h3>
        <p className="text-xs text-slate-400">
          Derived from Picasso bookings in the last 90 days. Rates over disposed meetings only.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl border border-slate-100 p-4 text-center"
          >
            <p className="text-2xl font-bold text-slate-800">{c.value}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mt-1">
              {c.label}
            </p>
            {c.hint && <p className="text-[10px] text-slate-400 mt-0.5">{c.hint}</p>}
          </div>
        ))}
      </div>

      {byType.length > 0 && (
        <div className="mt-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            No-show rate by appointment type
          </h4>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
            {byType.map((t) => (
              <li key={t.appointmentTypeId || '(unspecified)'} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-700">
                  {t.appointmentTypeId === ''
                    ? 'Unspecified'
                    : appointmentTypeLabel(t.appointmentTypeId, appointmentTypeNames)}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-800">{formatRate(t.noShowRate)}</span>
                  <span className="text-[11px] text-slate-400">
                    {t.noShow}/{t.dispositioned} disposed · {t.total} total
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

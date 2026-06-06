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
import { computeBookingMetrics, formatRate } from '../../lib/scheduling/bookingLogic';

export function SchedulingMetricsPanel({
  bookings,
  now,
}: {
  bookings: Booking[];
  /** Injected for determinism; defaults to wall-clock in the app. */
  now?: number;
}) {
  // Capture wall-clock once at mount (lazy init keeps render pure); tests pass `now`.
  const [mountNow] = useState(() => Date.now());
  const ref = now ?? mountNow;
  const m = computeBookingMetrics(bookings, ref);

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
    </section>
  );
}

/**
 * OperationalDebtPanel — Surface 8 operational-debt metrics (ui_plan §8 / §249).
 *
 * Renders the count of awaiting-disposition bookings by age bucket (24h / 72h / 7d / 30d)
 * and a per-staff unresolved breakdown (the §8 "staff with the most unresolved dispositions"
 * drill-down source). Derived purely from Booking rows — no backend.
 */
import { useState } from 'react';
import type { Booking } from '../../types/scheduling';
import {
  computeOperationalDebt,
  staffDebtBreakdown,
} from '../../lib/scheduling/bookingLogic';

const BUCKET_LABELS: { key: 'over24h' | 'over72h' | 'over7d' | 'over30d'; label: string }[] = [
  { key: 'over24h', label: '> 24 hours' },
  { key: 'over72h', label: '> 72 hours' },
  { key: 'over7d', label: '> 7 days' },
  { key: 'over30d', label: '> 30 days' },
];

export function OperationalDebtPanel({
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
  const debt = computeOperationalDebt(bookings, ref);
  const byStaff = staffDebtBreakdown(bookings, ref);

  return (
    <section aria-label="Operational debt" className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Bookings awaiting disposition
        </h3>
        <p className="text-xs text-slate-400">
          Past meetings still marked <span className="font-medium">booked</span> — nobody has
          recorded the outcome yet.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKET_LABELS.map((b) => (
          <div
            key={b.key}
            className="bg-white rounded-xl border border-slate-100 p-4 text-center"
          >
            <p
              className={`text-2xl font-bold ${
                debt[b.key] > 0 ? 'text-amber-600' : 'text-slate-300'
              }`}
            >
              {debt[b.key]}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mt-1">
              {b.label}
            </p>
          </div>
        ))}
      </div>

      {byStaff.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            By staff member
          </h4>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
            {byStaff.map((row) => (
              <li
                key={row.coordinatorEmail}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="truncate text-slate-700">{row.coordinatorEmail}</span>
                <span className="font-semibold text-amber-600">{row.unresolved}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

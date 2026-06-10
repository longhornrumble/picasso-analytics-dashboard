/**
 * OperationalDebtPanel — Surface 8 operational-debt metrics (ui_plan §8 / §249).
 *
 * Renders the count of awaiting-disposition bookings by age bucket (24h / 72h / 7d / 30d)
 * and a per-staff unresolved breakdown. Per ui_plan §8 each staff row is a DRILL-DOWN target:
 * clicking it expands that member's awaiting-disposition queue (oldest first) inline — the
 * "admin can drill from any aggregate row to the individual staff member's queue" must-have
 * (and, for a staff own-view, their own pending-dispositions list). Derived purely from
 * Booking rows — no backend.
 */
import { useState } from 'react';
import type { Booking } from '../../types/scheduling';
import {
  computeOperationalDebt,
  staffDebtBreakdown,
  staffDispositionQueue,
  formatSlotLabel,
  appointmentTypeLabel,
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
  appointmentTypeNames,
}: {
  bookings: Booking[];
  /** Injected for determinism; defaults to wall-clock in the app. */
  now?: number;
  /** Admin-only id→name map for labeling appointment types in the drill-down queue. */
  appointmentTypeNames?: Record<string, string>;
}) {
  // Capture wall-clock once at mount (lazy init keeps render pure); tests pass `now`.
  const [mountNow] = useState(() => Date.now());
  const ref = now ?? mountNow;
  // The coordinatorEmail of the currently drilled-into staff row (null = none expanded).
  const [openStaff, setOpenStaff] = useState<string | null>(null);
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
          <p className="text-[11px] text-slate-400 mb-1">
            Select a row to see that person's unresolved bookings.
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
            {byStaff.map((row) => {
              const isOpen = openStaff === row.coordinatorEmail;
              const queue = isOpen
                ? staffDispositionQueue(bookings, ref, row.coordinatorEmail)
                : [];
              return (
                <li key={row.coordinatorEmail}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenStaff((cur) =>
                        cur === row.coordinatorEmail ? null : row.coordinatorEmail,
                      )
                    }
                    className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        ▸
                      </span>
                      <span className="truncate text-slate-700">{row.coordinatorEmail}</span>
                    </span>
                    <span className="font-semibold text-amber-600">{row.unresolved}</span>
                  </button>
                  {isOpen && (
                    <ul className="bg-slate-50 px-4 py-2 flex flex-col gap-1">
                      {queue.map((b) => (
                        <li
                          key={b.booking_id}
                          className="flex items-center justify-between gap-2 text-xs text-slate-600"
                        >
                          <span className="truncate">
                            {formatSlotLabel(b.start_at, b.end_at)}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {appointmentTypeLabel(b.appointment_type_id, appointmentTypeNames)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

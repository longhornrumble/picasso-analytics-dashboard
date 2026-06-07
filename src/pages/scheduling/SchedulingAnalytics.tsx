/**
 * SchedulingAnalytics — Surface 8 (Customer Portal): scheduling analytics, render slice.
 *
 * This slice ships the operational-debt portion (ui_plan §8 must-have: counts of
 * awaiting-disposition bookings by age + staff drill-down), derived purely from Booking
 * rows (FROZEN_CONTRACTS §A). Historical aggregates (booking volume, no-show rate,
 * time-to-book) come from the hourly Analytics_Aggregator and are wired in sub-phase E/F.
 *
 * §8 audience split: admin sees the tenant-aggregate; a staff member sees only their own
 * (visibleBookings enforces the scope on the §A data this component is given).
 */
import type { Booking, SchedulingViewer } from '../../types/scheduling';
import { visibleBookings } from '../../lib/scheduling/bookingLogic';
import { SchedulingMetricsPanel } from '../../components/scheduling/SchedulingMetricsPanel';
import { OperationalDebtPanel } from '../../components/scheduling/OperationalDebtPanel';

export function SchedulingAnalytics({
  bookings,
  viewer,
  now,
}: {
  bookings: Booking[];
  viewer: SchedulingViewer;
  now?: number;
}) {
  const isAdmin = viewer.role === 'admin' || viewer.role === 'super_admin';
  const scoped = visibleBookings(bookings, viewer);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Scheduling Analytics</h2>
        <p className="text-xs text-slate-500">
          {isAdmin
            ? 'Tenant-wide operational debt across all staff.'
            : 'Your own bookings awaiting disposition.'}
        </p>
      </div>

      <SchedulingMetricsPanel bookings={scoped} now={now} />
      <OperationalDebtPanel bookings={scoped} now={now} />
    </div>
  );
}

/**
 * MyBookings — Surface 2 (Customer Portal): the staff operational view of Picasso bookings.
 *
 * Render slice (WS-EUI): pure component over a Booking[] (FROZEN_CONTRACTS §A) + the WS-FIX
 * fixture shape. Applies the §8 permission filter (staff → own; admin → all), then the
 * time-range + status chip filters, then renders booking cards. No live data fetch — the
 * Analytics_Dashboard_API wiring is sub-phase E; this component takes its data as a prop.
 */
import { useMemo, useState } from 'react';
import type { Booking, BookingStatus, SchedulingViewer } from '../../types/scheduling';
import {
  filterByStatus,
  filterByTimeRange,
  visibleBookings,
  type TimeRange,
} from '../../lib/scheduling/bookingLogic';
import { BookingFilters } from '../../components/scheduling/BookingFilters';
import { BookingCard } from '../../components/scheduling/BookingCard';

export function MyBookings({
  bookings,
  viewer,
  appointmentTypeNames,
  now,
  onActionComplete,
}: {
  bookings: Booking[];
  viewer: SchedulingViewer;
  appointmentTypeNames?: Record<string, string>;
  /** Injected for deterministic time-range filtering; defaults to wall-clock. */
  now?: number;
  /** Called after a booking action mutates the set, so the parent can re-fetch. */
  onActionComplete?: () => void;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>('upcoming');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  // Capture wall-clock once at mount (lazy init keeps render pure); tests pass `now`.
  const [mountNow] = useState(() => Date.now());
  const ref = now ?? mountNow;

  const visible = useMemo(
    () => visibleBookings(bookings, viewer),
    [bookings, viewer],
  );

  const shown = useMemo(() => {
    const byRange = filterByTimeRange(visible, timeRange, ref);
    const byStatus = filterByStatus(byRange, statusFilter);
    return [...byStatus].sort(
      (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
    );
  }, [visible, timeRange, statusFilter, ref]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">My Bookings</h2>
        <p className="text-xs text-slate-500">
          Picasso bookings only. Check Google Calendar for your full schedule.
        </p>
      </div>

      <BookingFilters
        timeRange={timeRange}
        statusFilter={statusFilter}
        onTimeRangeChange={setTimeRange}
        onStatusChange={setStatusFilter}
      />

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">
          No bookings match these filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map((b) => (
            <li key={b.booking_id}>
              <BookingCard
                booking={b}
                viewer={viewer}
                appointmentTypeNames={appointmentTypeNames}
                onActionComplete={onActionComplete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

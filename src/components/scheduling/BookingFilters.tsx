/**
 * BookingFilters — chip rows for the My Bookings view (Surface 2): a time-range row
 * (Today / This week / Upcoming / Past) and a status row (All + the 5 Booking.status).
 * Controlled component — parent owns the selected values.
 *
 * ui_plan §3 Surface 2 lists "Reschedule requested" / "Follow-up needed" filters too;
 * those are session/derived states not present on a Booking row, so they are deferred to
 * sub-phase E (when session state is wired). This slice filters on §A Booking.status only.
 */
import { BOOKING_STATUSES, type BookingStatus } from '../../types/scheduling';
import { STATUS_META, type TimeRange } from '../../lib/scheduling/bookingLogic';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

function chipClass(active: boolean): string {
  return active
    ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary-500 text-white'
    : 'px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200';
}

export function BookingFilters({
  timeRange,
  statusFilter,
  onTimeRangeChange,
  onStatusChange,
}: {
  timeRange: TimeRange;
  statusFilter: BookingStatus | 'all';
  onTimeRangeChange: (range: TimeRange) => void;
  onStatusChange: (status: BookingStatus | 'all') => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-pressed={timeRange === r.value}
            className={chipClass(timeRange === r.value)}
            onClick={() => onTimeRangeChange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        <button
          type="button"
          aria-pressed={statusFilter === 'all'}
          className={chipClass(statusFilter === 'all')}
          onClick={() => onStatusChange('all')}
        >
          All
        </button>
        {BOOKING_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={statusFilter === s}
            className={chipClass(statusFilter === s)}
            onClick={() => onStatusChange(s)}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}

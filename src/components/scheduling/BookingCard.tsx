/**
 * BookingCard — one Picasso booking in the My Bookings operational view (Surface 2).
 *
 * Render-only: shows appointment type, slot time, attendee, coordinator, status chip,
 * and an "Open in Google Calendar" link when a native event link is present.
 *
 * Security: the attendee name is USER-GENERATED form data. React escapes text content
 * by default, so it renders safely as text. The only injection sink is the external
 * link href — gated through safeExternalHref (https-only) to block scheme injection.
 *
 * NOT included in this slice: Reschedule / Cancel / admin-override actions — those mutate
 * via the Calendar API + token issuance (sub-phase E/D backend), out of the render slice.
 */
import type { Booking } from '../../types/scheduling';
import {
  appointmentTypeLabel,
  formatSlotLabel,
  safeExternalHref,
} from '../../lib/scheduling/bookingLogic';
import { StatusChip } from './StatusChip';

export function BookingCard({
  booking,
  appointmentTypeNames,
}: {
  booking: Booking;
  /** Optional id→name lookup so the card can show the type's label, not its id. */
  appointmentTypeNames?: Record<string, string>;
}) {
  const calendarHref = safeExternalHref(booking.html_link);
  const attendeeName = booking.attendee?.name?.trim();

  return (
    <div className="card-base bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {appointmentTypeLabel(booking.appointment_type_id, appointmentTypeNames)}
          </p>
          <p className="text-xs text-slate-500">
            {formatSlotLabel(booking.start_at, booking.end_at)}
          </p>
        </div>
        <StatusChip status={booking.status} />
      </div>

      <dl className="text-xs text-slate-600 space-y-0.5">
        <div className="flex gap-1">
          <dt className="text-slate-400">With</dt>
          <dd className="truncate">{attendeeName || 'Guest'}</dd>
        </div>
        {booking.coordinator_email && (
          <div className="flex gap-1">
            <dt className="text-slate-400">Staff</dt>
            <dd className="truncate">{booking.coordinator_email}</dd>
          </div>
        )}
      </dl>

      {calendarHref && (
        <a
          href={calendarHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary-600 hover:text-primary-700 self-start"
        >
          Open in Google Calendar →
        </a>
      )}
    </div>
  );
}

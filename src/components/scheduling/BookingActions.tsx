/**
 * BookingActions — the per-card cancel-with-reason + reschedule-link actions for a Picasso
 * booking (Surface 2 / §E12-actions / G6; backend lambda#269).
 *
 * Gated to an ACTIONABLE booking: status 'booked' AND the viewer is the booking's coordinator
 * (own) or an admin (§8 "cancel-on-behalf" override). This gate is UX only — the backend
 * (ADA → BCH) re-enforces §8 (404, not 403, for a non-owner → no enumeration oracle) and the
 * terminal-status guard (409). Cancel fires events.delete via BCH (the §14.2 listener flips the
 * status + sends the cancel notice); reschedule-link mints a fresh token + emails the GUEST,
 * who picks the new time (staff never picks — avoids the "time the guest can't make" anti-pattern).
 */
import { useState } from 'react';
import type { Booking, SchedulingViewer } from '../../types/scheduling';
import {
  cancelBooking,
  sendRescheduleLink,
  SchedulingApiError,
} from '../../services/schedulingApi';

/** §8: admins act on any in-tenant booking; a staff member only on their own (by coordinator_email). */
function canAct(viewer: SchedulingViewer, booking: Booking): boolean {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
  const email = viewer.email?.toLowerCase();
  return !!email && booking.coordinator_email?.toLowerCase() === email;
}

function actionError(e: unknown): string {
  if (e instanceof SchedulingApiError) {
    switch (e.status) {
      case 400:
        return 'A reason is required to cancel.';
      case 404:
        return "You can't change this booking.";
      case 409:
        return 'This booking is already closed.';
      case 429:
        return 'A reschedule link was just sent — try again in about a minute.';
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function BookingActions({
  booking,
  viewer,
  onActionComplete,
}: {
  booking: Booking;
  viewer: SchedulingViewer;
  /** Called after a successful cancel so the parent can re-fetch (the row changes status). */
  onActionComplete?: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'cancelling'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Only a live booking the viewer owns (or admin) is actionable. Hooks run first (rules of hooks).
  if (booking.status !== 'booked' || !canAct(viewer, booking)) return null;

  async function confirmCancel() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A reason is required to cancel.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cancelBooking(booking.booking_id, trimmed);
      setMode('idle');
      setReason('');
      onActionComplete?.(); // re-fetch: the row is now canceled (or pending the listener flip)
    } catch (e) {
      setError(actionError(e));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sendRescheduleLink(booking.booking_id);
      setNotice(
        res.sent
          ? 'Reschedule link sent to the guest.'
          : 'Reschedule link could not be delivered.',
      );
    } catch (e) {
      setError(actionError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-2">
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-primary-700" role="status">
          {notice}
        </p>
      )}

      {mode === 'idle' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reschedule}
            disabled={busy}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
          >
            Send reschedule link
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('cancelling');
              setError(null);
              setNotice(null);
            }}
            disabled={busy}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Cancel booking
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`cancel-reason-${booking.booking_id}`}
            className="text-xs font-medium text-slate-600"
          >
            Reason for cancelling (the guest is notified)
          </label>
          <textarea
            id={`cancel-reason-${booking.booking_id}`}
            value={reason}
            maxLength={1000}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g. Coordinator unavailable — please rebook"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmCancel}
              disabled={busy || !reason.trim()}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-lg disabled:opacity-50"
            >
              {busy ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setReason('');
                setError(null);
              }}
              disabled={busy}
              className="px-3 py-1 text-xs text-slate-500"
            >
              Keep booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

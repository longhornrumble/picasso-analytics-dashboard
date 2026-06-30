/**
 * calendarStatusAlert — the worked "structured context → alert" example.
 *
 * Maps the calendar connection STATUS (the real discriminator the backend returns)
 * to actionable Alert content, or null when there's nothing to flag. This is how an
 * alert "knows what it's alerting on": the status enum IS the context; the caller
 * pairs the returned content with a Reconnect action wired to the OAuth flow.
 *
 * Grounded in services/schedulingApi.ts `CalendarConnectionStatusResponse`:
 *   connected       → null (no problem)
 *   stale_connected → warning: token may be valid but we couldn't verify it
 *   disconnected + reason 'revoked' → error: was connected, access pulled → bookings paused
 *   disconnected (clean / first-time) → null: that's onboarding (the Connect CTA), not an error
 */
import type { AlertContent } from './errorAlert';
import type { CalendarConnectionStatusResponse } from '../services/schedulingApi';

export function calendarStatusAlert(status: CalendarConnectionStatusResponse): AlertContent | null {
  if (status.status === 'connected') return null;

  if (status.status === 'stale_connected') {
    return {
      severity: 'warning',
      title: 'Calendar connection unverified',
      description: "We couldn't confirm your Google Calendar. Reconnect if new bookings start failing — your existing appointments aren't affected.",
    };
  }

  // disconnected
  if (status.reason === 'revoked') {
    return {
      severity: 'error',
      title: 'Google Calendar access was revoked',
      description: "New bookings are paused until you reconnect. Your existing appointments aren't affected.",
    };
  }

  // Clean / first-time disconnected — the Connect onboarding CTA is the right affordance, not an alert.
  return null;
}

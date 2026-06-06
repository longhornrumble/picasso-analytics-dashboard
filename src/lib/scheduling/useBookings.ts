/**
 * useBookings — data hook for the Customer Portal scheduling surfaces (WS-E-PORTAL).
 *
 * Thin wrapper over schedulingApi.fetchBookings so the render slices (MyBookings,
 * SchedulingAnalytics) stay pure (Booking[] in, UI out). Loading / error / data are
 * surfaced explicitly; the live §E7 endpoint is a one-line swap inside the service.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Booking } from '../../types/scheduling';
import { fetchBookings, type BookingScope } from '../../services/schedulingApi';

export interface UseBookingsResult {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
}

export function useBookings(scope: BookingScope = 'staff_self'): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Defined outside the effect (useCallback) so the setState calls aren't synchronous
  // in the effect body; `isActive` discards a superseded fetch (scope change / unmount).
  const loadData = useCallback(
    async (isActive: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBookings(scope);
        if (isActive()) setBookings(data);
      } catch (e) {
        if (isActive()) {
          setError(e instanceof Error ? e.message : 'Failed to load bookings');
        }
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    let active = true;
    loadData(() => active);
    return () => {
      active = false;
    };
  }, [loadData]);

  return { bookings, loading, error };
}

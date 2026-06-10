/**
 * useAppointmentTypeNames — loads the tenant's appointment-type id→name map for the
 * scheduling surfaces. The backing endpoint (§E13b GET /scheduling/appointment-types,
 * lambda#258) is ADMIN-only, so the hook fetches only when `enabled` (admin viewer);
 * otherwise it returns an empty map. Names resolve raw appointment_type_ids in the
 * per-type analytics breakdown (and BookingCard); absence is non-fatal — callers fall
 * back to the id via appointmentTypeLabel().
 *
 * Shape mirrors useBookings (loading flag + useCallback loader): the leading synchronous
 * setLoading lets react-hooks/set-state-in-effect recognize this as the canonical
 * fetch-in-effect pattern rather than a stray data-setState.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchAppointmentTypes } from '../../services/schedulingApi';

export interface UseAppointmentTypeNamesResult {
  names: Record<string, string>;
  loading: boolean;
}

export function useAppointmentTypeNames(enabled: boolean): UseAppointmentTypeNamesResult {
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(
    async (isActive: () => boolean) => {
      setLoading(true);
      try {
        // Non-admins never have access to the appointment-types endpoint — skip the
        // fetch and keep the empty map (the per-type breakdown is admin-only).
        if (!enabled) {
          if (isActive()) setNames({});
          return;
        }
        const types = await fetchAppointmentTypes();
        if (!isActive()) return;
        const map: Record<string, string> = {};
        for (const t of types) map[t.appointment_type_id] = t.name;
        setNames(map);
      } catch {
        // Non-fatal: names are a nicety; on failure the UI shows the raw id.
        if (isActive()) setNames({});
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    let active = true;
    loadData(() => active);
    return () => {
      active = false;
    };
  }, [loadData]);

  return { names, loading };
}

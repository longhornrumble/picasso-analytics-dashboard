/**
 * Format a row's `modified_at` ({at, by}) for display (AC#20 — surface who last edited an
 * AppointmentType / RoutingPolicy and when). Returns null for legacy/fixture rows that
 * predate the field. Pure — no React/API — so it's unit-testable and rendered identically.
 */
import type { ModifiedAt } from '../../services/schedulingApi';

export function lastEditedLabel(m?: ModifiedAt): string | null {
  if (!m?.at) return null;
  const d = new Date(m.at);
  const when = Number.isNaN(d.getTime())
    ? m.at
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return m.by ? `Edited by ${m.by} · ${when}` : `Edited ${when}`;
}

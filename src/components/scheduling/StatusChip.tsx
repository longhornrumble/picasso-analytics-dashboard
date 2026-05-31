/**
 * StatusChip — a color + text-labeled chip for a Booking.status (ui_plan §4).
 * Text label is always present (WCAG: information is never conveyed by color alone).
 * Tolerates an unknown status value (forward-compat) via a neutral fallback.
 */
import { statusMeta } from '../../lib/scheduling/bookingLogic';

export function StatusChip({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${meta.chipClass}`}
    >
      {meta.label}
    </span>
  );
}

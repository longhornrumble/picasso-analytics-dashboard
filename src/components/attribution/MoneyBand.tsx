/**
 * MoneyBand
 *
 * Dark-emerald hero band: after-hours conversations · staff-hours · work-weeks.
 * HEADLINE type (locked decision #6 — largest number on screen).
 * NO dollar signs anywhere (locked decision #5).
 * This band never shrinks or moves below the fold.
 *
 * Design ref: v5 mockup .money section.
 */

import type { AttributionTime } from '../../types/attribution';

interface MoneyBandProps {
  time: AttributionTime;
}

interface CellProps {
  kicker: string;
  value: React.ReactNode;
  description: string;
  last?: boolean;
}

function Cell({ kicker, value, description, last }: CellProps) {
  return (
    <div
      className="flex-1"
      style={{
        minWidth: 220,
        padding: '24px 28px',
        borderRight: last ? 'none' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        className="font-bold uppercase"
        style={{ fontSize: '0.62rem', letterSpacing: '0.13em', color: '#a7f3d0' }}
      >
        {kicker}
      </div>
      <div
        className="font-extrabold text-white"
        style={{ fontSize: '2.3rem', letterSpacing: '-0.025em', lineHeight: 1.05, marginTop: 8 }}
      >
        {value}
      </div>
      <div
        className="text-primary-100"
        style={{ fontSize: '0.8rem', marginTop: 6, lineHeight: 1.5 }}
      >
        {description}
      </div>
    </div>
  );
}

export function MoneyBand({ time }: MoneyBandProps) {
  const afterHours = time.after_hours_conversations;
  const staffHours = time.staff_hours;
  const workWeeks = time.work_weeks;

  // Format work_weeks: "3.5 weeks" or "< 1 week"
  const workWeeksDisplay = workWeeks != null && !isNaN(workWeeks)
    ? workWeeks < 1
      ? '< 1 week'
      : `${workWeeks.toFixed(1)} weeks`
    : '—';

  // Format staffHours: "~140" (tilde for approximation)
  const staffHoursDisplay = staffHours != null && !isNaN(staffHours)
    ? `~${Math.round(staffHours)}`
    : '—';

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-wrap"
      style={{
        border: '1px solid #065f46',
        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 65%, #065f46 100%)',
        color: '#fff',
      }}
      role="region"
      aria-label="After-hours coverage summary"
    >
      <Cell
        kicker="The night shift you never had to staff"
        value={afterHours != null && !isNaN(afterHours) ? afterHours.toLocaleString() : '—'}
        description="conversations held after your office closed — nights, weekends, 11 PMs"
      />
      <Cell
        kicker="Staff-hours you didn't hire for"
        value={staffHoursDisplay}
        description="hours of conversations your team never had to take — no overhead, no burnout"
      />
      <Cell
        kicker="In coverage terms"
        value={workWeeksDisplay}
        description="of full-time work, absorbed by your AI team member this month"
        last
      />
    </div>
  );
}

/**
 * TrendChart — six-month bar chart (conversations + leads).
 *
 * Inline SVG, no chart library dep. Matches the v5 mockup .chart section.
 * Bar-conv = slate-200, bar-lead = emerald-500.
 */

import type { AttributionTrendPoint } from '../../types/attribution';

interface TrendChartProps {
  trend: AttributionTrendPoint[];
}

const BAR_W = 18;
const LEAD_W = 8;
const CHART_H = 100; // drawing height (y=0 = top)
const CHART_W = 420;

function monthLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const [y, m] = iso.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short' });
  } catch {
    return iso;
  }
}

export function TrendChart({ trend }: TrendChartProps) {
  if (!trend || trend.length === 0) {
    return (
      <div
        className="border border-slate-100 rounded-xl flex items-center justify-center text-slate-400"
        style={{ height: 122, fontSize: '0.75rem' }}
      >
        No trend data
      </div>
    );
  }

  const maxConv = Math.max(...trend.map((t) => t.conversations ?? 0), 1);
  const maxLead = Math.max(...trend.map((t) => t.leads ?? 0), 1);

  const cols = trend.slice(-6); // at most 6 months
  const spacing = CHART_W / Math.max(cols.length, 1);

  return (
    <div
      className="border border-slate-100 rounded-xl"
      style={{ padding: '12px 14px 6px' }}
      role="img"
      aria-label="Six-month conversation and lead trend"
    >
      <svg
        viewBox={`0 0 ${CHART_W} 130`}
        width="100%"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        {cols.map((pt, i) => {
          const conv = pt.conversations ?? 0;
          const leads = pt.leads ?? 0;
          const cx = i * spacing + spacing / 2;

          const convH = Math.round((conv / maxConv) * CHART_H);
          const leadH = Math.round((leads / maxLead) * CHART_H * 0.3 + 4);

          const convX = cx - BAR_W / 2;
          const leadX = cx - LEAD_W / 2;

          return (
            <g key={i}>
              <rect
                className="bar-conv"
                x={convX}
                y={CHART_H - convH}
                width={BAR_W}
                height={convH}
                rx={3}
                fill="#e2e8f0"
              />
              <rect
                className="bar-lead"
                x={leadX}
                y={CHART_H - leadH}
                width={LEAD_W}
                height={leadH}
                rx={2}
                fill="#50C878"
              />
              <text
                x={cx}
                y={121}
                textAnchor="middle"
                style={{
                  fontSize: 9,
                  fill: '#94a3b8',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                }}
              >
                {monthLabel(pt.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        className="flex gap-4 text-slate-500"
        style={{ fontSize: '0.64rem', padding: '7px 2px 4px' }}
      >
        <span>
          <span
            className="inline-block rounded-full mr-1"
            style={{ width: 7, height: 7, background: '#e2e8f0' }}
          />
          Conversations
        </span>
        <span>
          <span
            className="inline-block rounded-full mr-1"
            style={{ width: 7, height: 7, background: '#50C878' }}
          />
          Leads
        </span>
      </div>
    </div>
  );
}

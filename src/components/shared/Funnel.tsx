/**
 * Funnel Component (Generic)
 * Premium Design System
 *
 * Features:
 * - Chromatic gradient bars (primary to darker shades)
 * - Super-ellipse bar corners (rounded-xl)
 * - Premium tooltip styling
 * - Aviation-style stat labels
 *
 * Used by: Forms Dashboard, Conversations Dashboard, Attribution Dashboard
 */

import { useState } from 'react';

export interface FunnelStage {
  name: string;
  count: number;
  displayName?: string; // Optional override for display
}

export interface FunnelStat {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'danger';
}

interface FunnelProps {
  /** Title displayed in the header */
  title: string;
  /** Array of funnel stages (top to bottom) */
  stages: FunnelStage[];
  /** Conversion/completion rate shown in badge */
  rate?: number;
  /** Label for the rate badge (e.g., "Conversion Rate", "Resolution Rate") */
  rateLabel?: string;
  /** Bottom stats (up to 3 recommended) */
  stats?: FunnelStat[];
  /** Bar color - uses Tailwind class (default: bg-green-400) */
  barColor?: string;
  /** Badge variant for rate display */
  badgeVariant?: 'success' | 'info' | 'warning';
}

export function Funnel({
  title,
  stages,
  rate,
  rateLabel = 'Conversion Rate',
  stats = [],
}: FunnelProps) {
  // Tooltip state
  const [hoveredStage, setHoveredStage] = useState<{
    name: string;
    count: number;
    percent: number;
    rect: DOMRect | null;
  } | null>(null);

  // Find max count for bar scaling
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  // Stat variant colors with primary for success
  const statColors = {
    default: 'text-slate-900',
    success: 'text-primary-600',
    danger: 'text-danger-500',
  };

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {rate !== undefined && (
            <span className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-primary-500 self-start sm:self-auto">
              {rate}% {rateLabel}
            </span>
          )}
        </div>
      </div>

      {/* Funnel bars */}
      <div className="space-y-4 relative">
        {stages.map((stage, index) => {
          const widthPercent = (stage.count / maxCount) * 100;
          const displayName = stage.displayName || stage.name;
          const isHovered = hoveredStage?.name === stage.name;
          // Calculate percentage relative to first stage
          const percentOfFirst = stages[0]?.count > 0
            ? Math.round((stage.count / stages[0].count) * 100)
            : 0;

          // Chromatic gradient: each bar gets slightly darker shade using CSS variables
          const gradientShades = [
            'linear-gradient(90deg, var(--color-primary-300) 0%, var(--color-primary-500) 100%)',  // Lightest
            'linear-gradient(90deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%)',  // Medium
            'linear-gradient(90deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%)',  // Darkest
          ];
          const barGradient = gradientShades[Math.min(index, gradientShades.length - 1)];

          return (
            <div key={stage.name} className="flex items-center gap-2 sm:gap-4">
              <div className="w-20 sm:w-24 text-xs sm:text-sm font-medium text-slate-600 text-right">
                {displayName}
              </div>
              <div className="flex-1 relative">
                <div
                  className={`h-10 bg-slate-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isHovered ? 'ring-2 ring-primary-400 ring-offset-2' : ''
                  }`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredStage({ name: displayName, count: stage.count, percent: percentOfFirst, rect });
                  }}
                  onMouseLeave={() => setHoveredStage(null)}
                >
                  <div
                    className="h-full rounded-xl transition-all duration-500"
                    style={{
                      width: `${widthPercent}%`,
                      background: barGradient,
                    }}
                  />
                </div>
              </div>
              <div className="w-12 sm:w-16 text-right text-sm sm:text-base font-bold text-slate-900">
                {stage.count.toLocaleString()}
              </div>
            </div>
          );
        })}

        {/* Tooltip */}
        {hoveredStage && hoveredStage.rect && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredStage.rect.left + hoveredStage.rect.width / 2,
              top: hoveredStage.rect.top - 12,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-slate-900 text-white text-sm rounded-2xl px-4 py-3 shadow-xl whitespace-nowrap">
              <div className="font-bold">{hoveredStage.count.toLocaleString()}</div>
              <div className="text-slate-400 text-xs mt-0.5">{hoveredStage.name} ({hoveredStage.percent}% of total)</div>
            </div>
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full"
              style={{
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid #0f172a',
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom stats with aviation-style labels */}
      {stats.length > 0 && (
        <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="text-[10px] font-black uppercase text-slate-500"
                style={{ letterSpacing: '0.2em' }}
              >
                {stat.label}
              </p>
              <p className={`text-lg font-bold ${statColors[stat.variant || 'default']}`}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

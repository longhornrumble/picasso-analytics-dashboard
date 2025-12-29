/**
 * ConversationHeatMap Component
 * Premium Emerald Design System
 *
 * Displays a day of week × hour of day grid showing engagement density.
 * Features:
 * - Super-ellipse tiles (rounded-xl)
 * - Monochromatic emerald gradient
 * - Hover scale effect (1.1x)
 * - Glow effect on peak cells (box-shadow: 0 0 20px emerald)
 * - Premium tooltip styling
 */

import { useState } from 'react';
import type { HeatmapRow, HeatmapPeak } from '../types/analytics';

interface ConversationHeatMapProps {
  /** Heatmap data rows (8 rows for 3-hour blocks) */
  data: HeatmapRow[];
  /** Peak time slot info */
  peak: HeatmapPeak | null;
  /** Total conversation count for header */
  totalConversations: number;
  /** Loading state */
  loading?: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Primary color gradient ramp for heatmap
 * From light tint to full brand color
 */
const PRIMARY_GRADIENT = {
  0: { bg: '#f8faf9', text: '#64748b' },      // slate-50 equivalent
  1: { bg: '#d1fae5', text: '#065f46' },      // primary-100
  2: { bg: '#a7f3d0', text: '#047857' },      // primary-200
  3: { bg: '#6ee7b7', text: '#047857' },      // primary-300
  4: { bg: '#34d399', text: '#ffffff' },      // primary-400
  5: { bg: 'var(--color-primary-500)', text: '#ffffff' },      // Brand primary
};

function getHeatColor(value: number, maxValue: number): { bg: string; text: string; isPeak: boolean } {
  if (value === 0 || maxValue === 0) return { ...PRIMARY_GRADIENT[0], isPeak: false };

  const intensity = value / maxValue;

  if (intensity >= 0.8) return { ...PRIMARY_GRADIENT[5], isPeak: true };
  if (intensity >= 0.6) return { ...PRIMARY_GRADIENT[4], isPeak: false };
  if (intensity >= 0.4) return { ...PRIMARY_GRADIENT[3], isPeak: false };
  if (intensity >= 0.2) return { ...PRIMARY_GRADIENT[2], isPeak: false };
  return { ...PRIMARY_GRADIENT[1], isPeak: false };
}

export function ConversationHeatMap({
  data,
  peak,
  totalConversations,
  loading = false,
}: ConversationHeatMapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hourBlock: string;
    value: number;
    rect: DOMRect | null;
  } | null>(null);

  const maxValue = data.reduce((max, row) => {
    const rowMax = Math.max(...row.data.map(cell => cell.value));
    return Math.max(max, rowMax);
  }, 0);

  if (loading) {
    return (
      <div className="card-analytical">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card-analytical">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Engagement Density</h3>
        <div className="flex items-center justify-center h-48 text-slate-400">
          No conversation data available
        </div>
      </div>
    );
  }

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Engagement Density</h3>
          {peak && (
            <p className="text-sm text-slate-500 mt-1">
              Peak: <span className="font-semibold text-primary-500">{peak.day} at {peak.hour_block}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-primary-500">{totalConversations.toLocaleString()}</p>
          <p className="text-[10px] font-black uppercase text-slate-500 mt-1" style={{ letterSpacing: '0.2em' }}>Total</p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr>
              <th className="w-16 p-1 text-xs text-slate-400 font-medium text-left" />
              {DAYS.map(day => (
                <th key={day} className="p-1 text-xs text-slate-500 font-semibold text-center uppercase tracking-wider">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.hour_block}>
                <td className="p-1 text-xs text-slate-400 font-medium text-left whitespace-nowrap">
                  {row.hour_block}
                </td>
                {DAYS.map(day => {
                  const cell = row.data.find(c => c.day === day);
                  const value = cell?.value ?? 0;
                  const colors = getHeatColor(value, maxValue);
                  const isHovered = hoveredCell?.day === day && hoveredCell?.hourBlock === row.hour_block;
                  const isPeakCell = peak && peak.day === day && peak.hour_block === row.hour_block;

                  return (
                    <td key={day} className="p-1">
                      <div
                        className={`
                          w-full h-10 rounded-xl flex items-center justify-center
                          text-xs font-semibold cursor-pointer
                          transition-all duration-300 ease-out
                          ${isHovered ? 'ring-2 ring-slate-800 ring-offset-2 z-10' : ''}
                        `}
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                          // Glow effect on peak cells
                          boxShadow: isPeakCell || colors.isPeak
                            ? '0 0 20px rgba(80, 200, 120, 0.25)'
                            : undefined,
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({ day, hourBlock: row.hour_block, value, rect });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tooltip */}
        {hoveredCell && hoveredCell.rect && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredCell.rect.left + hoveredCell.rect.width / 2,
              top: hoveredCell.rect.top - 12,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-slate-900 text-white text-sm rounded-2xl px-4 py-3 shadow-xl">
              <div className="font-bold">{hoveredCell.value} conversations</div>
              <div className="text-slate-400 text-xs mt-0.5">{hoveredCell.day} {hoveredCell.hourBlock}</div>
            </div>
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

      {/* Legend */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Less</span>
        <div className="flex gap-1">
          {Object.values(PRIMARY_GRADIENT).map((color, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-lg"
              style={{ backgroundColor: color.bg }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">More</span>
      </div>
    </div>
  );
}

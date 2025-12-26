/**
 * ConversationHeatMap Component
 *
 * Displays a day of week × hour of day grid showing conversation volume.
 * Color intensity indicates relative conversation count.
 *
 * Based on Bubble mockup: 7 columns (Mon-Sun) × 8 rows (3-hour blocks)
 */

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
 * Get background color class based on value relative to max
 */
function getHeatColor(value: number, maxValue: number): string {
  if (value === 0 || maxValue === 0) return 'bg-gray-50';

  const intensity = value / maxValue;

  if (intensity >= 0.8) return 'bg-primary-500 text-white';
  if (intensity >= 0.6) return 'bg-primary-400 text-white';
  if (intensity >= 0.4) return 'bg-primary-300 text-gray-800';
  if (intensity >= 0.2) return 'bg-primary-200 text-gray-700';
  return 'bg-primary-100 text-gray-600';
}

export function ConversationHeatMap({
  data,
  peak,
  totalConversations,
  loading = false,
}: ConversationHeatMapProps) {
  // Calculate max value for color scaling
  const maxValue = data.reduce((max, row) => {
    const rowMax = Math.max(...row.data.map(cell => cell.value));
    return Math.max(max, rowMax);
  }, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation Heat Map</h3>
        <div className="flex items-center justify-center h-48 text-gray-400">
          No conversation data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Conversation Heat Map</h3>
          {peak && (
            <p className="text-sm text-gray-500">
              Peak: <span className="font-medium text-primary-600">{peak.day} at {peak.hour_block}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{totalConversations.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr>
              <th className="w-16 p-1 text-xs text-gray-500 font-normal text-left" />
              {DAYS.map(day => (
                <th key={day} className="p-1 text-xs text-gray-500 font-medium text-center">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.hour_block}>
                <td className="p-1 text-xs text-gray-500 text-left whitespace-nowrap">
                  {row.hour_block}
                </td>
                {DAYS.map(day => {
                  const cell = row.data.find(c => c.day === day);
                  const value = cell?.value ?? 0;
                  const colorClass = getHeatColor(value, maxValue);

                  return (
                    <td key={day} className="p-0.5">
                      <div
                        className={`
                          w-full h-8 rounded flex items-center justify-center
                          text-xs font-medium transition-colors
                          ${colorClass}
                        `}
                        title={`${day} ${row.hour_block}: ${value} conversations`}
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
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-gray-500">Less</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
          <div className="w-4 h-4 rounded bg-primary-100" />
          <div className="w-4 h-4 rounded bg-primary-200" />
          <div className="w-4 h-4 rounded bg-primary-300" />
          <div className="w-4 h-4 rounded bg-primary-400" />
          <div className="w-4 h-4 rounded bg-primary-500" />
        </div>
        <span className="text-xs text-gray-500">More</span>
      </div>
    </div>
  );
}

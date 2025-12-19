/**
 * ConversionFunnel Component
 * Displays the conversion funnel with horizontal bars
 */

import type { FunnelStage } from '../types/analytics';

interface ConversionFunnelProps {
  stages: FunnelStage[];
  conversionRate: number;
  totalViews?: number;
  abandoned?: number;
  completed?: number;
}

export function ConversionFunnel({
  stages,
  conversionRate,
  totalViews = 0,
  abandoned = 0,
  completed = 0,
}: ConversionFunnelProps) {
  // Find max count for bar scaling
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  // Map stage names to display names
  const stageDisplayNames: Record<string, string> = {
    'Widget Opened': 'Form Views',
    'Chip Clicked': 'Engaged',
    'Form Started': 'Started',
    'Form Completed': 'Completed',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Conversion Funnel</h3>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          {conversionRate}% Conversion Rate
        </span>
      </div>

      {/* Funnel bars */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const widthPercent = (stage.count / maxCount) * 100;
          const displayName = stageDisplayNames[stage.stage] || stage.stage;

          return (
            <div key={stage.stage} className="flex items-center gap-4">
              <div className="w-24 text-sm text-gray-600 text-right">
                {displayName}
              </div>
              <div className="flex-1 relative">
                <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-lg transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right font-semibold text-gray-900">
                {stage.count.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom stats */}
      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Views</p>
          <p className="text-lg font-bold text-gray-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Abandoned</p>
          <p className="text-lg font-bold text-red-500">{abandoned.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Completed</p>
          <p className="text-lg font-bold text-green-500">{completed.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

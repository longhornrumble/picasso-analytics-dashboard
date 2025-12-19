/**
 * Funnel Component (Generic)
 * Reusable horizontal bar funnel visualization
 *
 * Used by: Forms Dashboard, Conversations Dashboard, Attribution Dashboard
 */

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
  barColor = 'bg-green-400',
  badgeVariant = 'success',
}: FunnelProps) {
  // Find max count for bar scaling
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  // Badge color mapping
  const badgeColors = {
    success: 'bg-green-100 text-green-700',
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-700',
  };

  // Stat variant colors
  const statColors = {
    default: 'text-gray-900',
    success: 'text-green-500',
    danger: 'text-red-500',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {rate !== undefined && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColors[badgeVariant]}`}>
            {rate}% {rateLabel}
          </span>
        )}
      </div>

      {/* Funnel bars */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const widthPercent = (stage.count / maxCount) * 100;
          const displayName = stage.displayName || stage.name;

          return (
            <div key={stage.name} className="flex items-center gap-4">
              <div className="w-24 text-sm text-gray-600 text-right">
                {displayName}
              </div>
              <div className="flex-1 relative">
                <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-lg transition-all duration-500`}
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
      {stats.length > 0 && (
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xs text-gray-500 uppercase font-medium">{stat.label}</p>
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

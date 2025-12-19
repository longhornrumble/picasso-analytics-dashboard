/**
 * TrendChart Component (Generic)
 * Lightweight SVG-based line chart for time-series trends
 *
 * Used by: All dashboards for session counts, event trends, etc.
 *
 * Note: For production, consider replacing with recharts/chart.js
 * This lightweight version avoids heavy dependencies for MVP.
 */


export interface DataPoint {
  /** X-axis label (e.g., "Dec 1", "Week 45") */
  label: string;
  /** Y-axis value */
  value: number;
}

export interface TrendLine {
  /** Unique identifier */
  id: string;
  /** Display name (for legend) */
  name: string;
  /** Data points */
  data: DataPoint[];
  /** Line color (Tailwind color class or hex) */
  color: string;
}

interface TrendChartProps {
  /** Title displayed in header */
  title: string;
  /** Subtitle */
  subtitle?: string;
  /** Single line or multiple lines */
  lines: TrendLine[];
  /** Chart height in pixels */
  height?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show data point dots */
  showDots?: boolean;
  /** Show area fill under line */
  showArea?: boolean;
  /** Y-axis formatter */
  formatValue?: (value: number) => string;
}

export function TrendChart({
  title,
  subtitle,
  lines,
  height = 200,
  showLegend = true,
  showGrid = true,
  showDots = true,
  showArea = false,
  formatValue = (v) => v.toLocaleString(),
}: TrendChartProps) {
  if (lines.length === 0 || lines[0].data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  // Calculate bounds across all lines
  const allValues = lines.flatMap(line => line.data.map(d => d.value));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = 100; // Percentage-based for responsiveness
  const chartHeight = height;

  // Get labels from first line (assumes all lines have same labels)
  const labels = lines[0].data.map(d => d.label);
  const labelCount = labels.length;

  // Generate path for a line
  const generatePath = (data: DataPoint[]): string => {
    const points = data.map((point, i) => {
      const x = padding.left + (i / (labelCount - 1)) * (chartWidth - padding.left - padding.right);
      const y = padding.top + (1 - (point.value - minValue) / valueRange) * (chartHeight - padding.top - padding.bottom);
      return { x, y };
    });

    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  // Generate area path (same as line but closed at bottom)
  const generateAreaPath = (data: DataPoint[]): string => {
    const linePath = generatePath(data);
    const bottomY = chartHeight - padding.bottom;
    const startX = padding.left;
    const endX = padding.left + ((labelCount - 1) / (labelCount - 1)) * (chartWidth - padding.left - padding.right);
    return `${linePath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  };

  // Color mapping (convert Tailwind classes to actual colors for SVG)
  const colorMap: Record<string, string> = {
    'green': '#50C878',
    'blue': '#3b82f6',
    'red': '#ef4444',
    'purple': '#8b5cf6',
    'orange': '#f97316',
    'gray': '#6b7280',
  };

  const getColor = (color: string): string => {
    if (color.startsWith('#')) return color;
    return colorMap[color] || colorMap.green;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {/* Legend */}
        {showLegend && lines.length > 1 && (
          <div className="flex items-center gap-4">
            {lines.map(line => (
              <div key={line.id} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getColor(line.color) }}
                />
                <span className="text-xs text-gray-600">{line.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: chartHeight }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {showGrid && (
            <g className="text-gray-200">
              {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                const y = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
                return (
                  <line
                    key={ratio}
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                );
              })}
            </g>
          )}

          {/* Lines */}
          {lines.map(line => {
            const color = getColor(line.color);
            return (
              <g key={line.id}>
                {/* Area fill */}
                {showArea && (
                  <path
                    d={generateAreaPath(line.data)}
                    fill={color}
                    fillOpacity="0.1"
                  />
                )}
                {/* Line */}
                <path
                  d={generatePath(line.data)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {showDots && line.data.map((point, i) => {
                  const x = padding.left + (i / (labelCount - 1)) * (chartWidth - padding.left - padding.right);
                  const y = padding.top + (1 - (point.value - minValue) / valueRange) * (chartHeight - padding.top - padding.bottom);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3"
                      fill="white"
                      stroke={color}
                      strokeWidth="2"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-5 text-xs text-gray-500 w-14 text-right pr-2">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue((maxValue + minValue) / 2)}</span>
          <span>{formatValue(minValue)}</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-14 right-5 flex justify-between text-xs text-gray-500">
          {labels.filter((_, i) => {
            // Show fewer labels on mobile
            const step = Math.ceil(labelCount / 6);
            return i % step === 0 || i === labelCount - 1;
          }).map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper: Single line trend chart
 * Convenience wrapper for single-line charts
 */
export function SimpleTrendChart({
  title,
  subtitle,
  data,
  color = 'green',
  ...props
}: Omit<TrendChartProps, 'lines'> & {
  data: DataPoint[];
  color?: string;
}) {
  return (
    <TrendChart
      title={title}
      subtitle={subtitle}
      lines={[{ id: 'main', name: title, data, color }]}
      showLegend={false}
      {...props}
    />
  );
}

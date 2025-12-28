/**
 * TrendChart Component (Generic)
 * Clean SVG-based line chart for time-series trends
 *
 * Used by: All dashboards for session counts, event trends, etc.
 * Designed to mirror the Bubble dashboard's clean line chart style.
 */

import { useState } from 'react';

export interface DataPoint {
  /** X-axis label (e.g., "12am", "3pm", "Dec 1") */
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
  /** Subtitle (shown as badge, e.g., "Questions per hour") */
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
  formatValue = (v: number) => v.toLocaleString(),
}: TrendChartProps) {
  // Tooltip state
  const [hoveredPoint, setHoveredPoint] = useState<{
    lineId: string;
    index: number;
    label: string;
    value: number;
    x: number;
    y: number;
    color: string;
  } | null>(null);

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
  const maxValue = Math.max(...allValues);
  // Always start Y-axis at 0 for cleaner visualization
  const minValue = 0;

  // Round max to nice number for Y-axis
  const niceMax = Math.ceil(maxValue / 10) * 10 || 10;

  // Chart layout dimensions
  const svgHeight = height;
  const chartAreaHeight = svgHeight - 35; // Leave room for X-axis labels

  // Get labels from first line (assumes all lines have same labels)
  const labels = lines[0].data.map(d => d.label);
  const labelCount = labels.length;

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

  // Calculate Y-axis tick values (0, 10, 20, 30 style)
  const yTicks = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(Math.round(niceMax * (1 - i / tickCount)));
  }

  // Calculate which X labels to show (avoid overcrowding)
  const maxLabels = 8;
  const labelStep = Math.ceil(labelCount / maxLabels);

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {subtitle && (
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
              {subtitle}
            </span>
          )}
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

      {/* Chart with HTML labels (won't distort) and SVG for lines */}
      <div className="relative" style={{ height: svgHeight }}>
        {/* Y-axis labels (HTML) */}
        <div
          className="absolute left-0 top-0 flex flex-col justify-between text-xs text-slate-400 font-medium"
          style={{
            height: chartAreaHeight,
            width: '30px',
            textAlign: 'right',
            paddingRight: '8px'
          }}
        >
          {yTicks.map((tick, i) => (
            <span key={i} style={{ lineHeight: '1' }}>{tick}</span>
          ))}
        </div>

        {/* Main chart area */}
        <div
          className="absolute"
          style={{
            left: '35px',
            right: '5px',
            top: 0,
            height: chartAreaHeight
          }}
        >
          <svg
            viewBox={`0 0 100 100`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* Grid lines */}
            {showGrid && (
              <g>
                {yTicks.map((_, i) => {
                  const y = (i / tickCount) * 100;
                  return (
                    <line
                      key={i}
                      x1="0"
                      y1={y}
                      x2="100"
                      y2={y}
                      stroke="var(--chart-grid-color)"
                      strokeWidth="0.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            )}

            {/* Lines and areas */}
            {lines.map(line => {
              const color = getColor(line.color);
              // Generate path in 0-100 coordinate space
              const pathPoints = line.data.map((point, i) => {
                const x = (i / (labelCount - 1 || 1)) * 100;
                const y = (1 - (point.value - minValue) / (niceMax - minValue)) * 100;
                return { x, y };
              });
              const linePath = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
              const areaPath = `${linePath} L 100 100 L 0 100 Z`;

              return (
                <g key={line.id}>
                  {/* Area fill */}
                  {showArea && (
                    <path
                      d={areaPath}
                      fill={color}
                      fillOpacity="0.15"
                    />
                  )}
                  {/* Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {/* Dots overlay (HTML for consistent sizing) - interactive with tooltips */}
          {showDots && lines.map(line => {
            const color = getColor(line.color);
            return line.data.map((point, i) => {
              const leftPercent = (i / (labelCount - 1 || 1)) * 100;
              const topPercent = (1 - (point.value - minValue) / (niceMax - minValue)) * 100;
              const isHovered = hoveredPoint?.lineId === line.id && hoveredPoint?.index === i;
              return (
                <div
                  key={`${line.id}-${i}`}
                  className={`absolute rounded-full bg-white border-2 cursor-pointer transition-all ${
                    isHovered ? 'w-3 h-3 z-10' : 'w-2 h-2'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: color,
                  }}
                  onMouseEnter={() => setHoveredPoint({
                    lineId: line.id,
                    index: i,
                    label: point.label,
                    value: point.value,
                    x: leftPercent,
                    y: topPercent,
                    color,
                  })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            });
          })}

          {/* Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${hoveredPoint.x}%`,
                top: `${hoveredPoint.y}%`,
                transform: hoveredPoint.y > 50
                  ? 'translate(-50%, calc(-100% - 12px))'
                  : 'translate(-50%, 12px)',
              }}
            >
              <div className="bg-slate-900 text-white text-sm rounded-2xl px-4 py-3 shadow-xl whitespace-nowrap">
                <div className="font-bold">{formatValue(hoveredPoint.value)}</div>
                <div className="text-slate-400 text-xs mt-0.5">{hoveredPoint.label}</div>
              </div>
              {/* Arrow */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  [hoveredPoint.y > 50 ? 'bottom' : 'top']: '-6px',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  [hoveredPoint.y > 50 ? 'borderTop' : 'borderBottom']: '8px solid #0f172a',
                }}
              />
            </div>
          )}
        </div>

        {/* X-axis labels (HTML) */}
        <div
          className="absolute bottom-0 flex justify-between text-xs text-slate-400 font-medium"
          style={{
            left: '35px',
            right: '5px',
            height: '20px'
          }}
        >
          {labels.map((label, i) => {
            // Only show some labels to avoid overcrowding
            if (i % labelStep !== 0 && i !== labelCount - 1) return null;
            return (
              <span key={i} className="text-center" style={{ minWidth: '30px' }}>{label}</span>
            );
          })}
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

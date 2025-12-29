/**
 * FieldBottlenecks Component
 * Premium Emerald Design System
 *
 * Features:
 * - Friction spectrum color palette (rose gradient)
 * - Super-ellipse bars (rounded-xl)
 * - Premium tooltip styling
 * - Aviation-style labels
 * - Insight callout with rose accent
 */

import { useState } from 'react';
import type { FieldBottleneck } from '../types/analytics';

interface FieldBottlenecksProps {
  bottlenecks: FieldBottleneck[];
  totalAbandons: number;
}

/**
 * Friction spectrum: rose gradient for severity
 * Higher abandon rates get more intense rose colors
 */
function getFrictionColor(abandonRate: number): string {
  if (abandonRate >= 40) return 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)'; // Intense rose
  if (abandonRate >= 25) return 'linear-gradient(90deg, #fda4af 0%, #fb7185 100%)'; // Medium rose
  if (abandonRate >= 15) return 'linear-gradient(90deg, #fecdd3 0%, #fda4af 100%)'; // Light rose
  return 'linear-gradient(90deg, #ffe4e6 0%, #fecdd3 100%)'; // Subtle rose
}

export function FieldBottlenecks({ bottlenecks, totalAbandons }: FieldBottlenecksProps) {
  // Tooltip state
  const [hoveredBar, setHoveredBar] = useState<{
    fieldName: string;
    abandonRate: number;
    rect: DOMRect | null;
  } | null>(null);

  // Get the top bottleneck for the insight
  const topBottleneck = bottlenecks[0];

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900">Bottleneck Analysis</h3>
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-danger-500">{totalAbandons.toLocaleString()}</p>
          <p
            className="text-[10px] font-black uppercase text-danger-400"
            style={{ letterSpacing: '0.2em' }}
          >
            Abandons
          </p>
        </div>
      </div>

      {/* Bottleneck bars with friction spectrum */}
      <div className="space-y-3 relative">
        {bottlenecks.length > 0 ? (
          bottlenecks.map((bottleneck) => {
            const isHovered = hoveredBar?.fieldName === bottleneck.fieldName;
            return (
              <div key={bottleneck.fieldName} className="flex items-center gap-3">
                <div className="w-28 text-sm font-medium text-slate-600 truncate" title={bottleneck.fieldName}>
                  {bottleneck.fieldName}
                </div>
                <div className="flex-1 relative">
                  <div
                    className={`h-6 bg-slate-100 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                      isHovered ? 'ring-2 ring-danger-400 ring-offset-2' : ''
                    }`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredBar({ fieldName: bottleneck.fieldName, abandonRate: bottleneck.abandonRate, rect });
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div
                      className="h-full rounded-xl transition-all duration-500"
                      style={{
                        width: `${bottleneck.abandonRate}%`,
                        background: getFrictionColor(bottleneck.abandonRate),
                      }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right text-sm font-bold text-danger-500">
                  {bottleneck.abandonRate}%
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-700">No bottlenecks detected</p>
            <p className="text-sm text-slate-400">All forms are completing without drop-offs</p>
          </div>
        )}

        {/* Tooltip */}
        {hoveredBar && hoveredBar.rect && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredBar.rect.left + hoveredBar.rect.width / 2,
              top: hoveredBar.rect.top - 12,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-slate-900 text-white text-sm rounded-2xl px-4 py-3 shadow-xl whitespace-nowrap">
              <div className="font-bold">{hoveredBar.abandonRate}% drop-off rate</div>
              <div className="text-slate-400 text-xs mt-0.5">{hoveredBar.fieldName}</div>
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

      {/* Insight callout with danger accent */}
      {topBottleneck && (
        <div className="mt-6 p-4 bg-danger-50 rounded-xl border border-danger-100">
          <div className="flex items-start gap-2">
            <span className="text-danger-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <p
                className="text-[10px] font-black uppercase text-danger-700 mb-1"
                style={{ letterSpacing: '0.2em' }}
              >
                Insight
              </p>
              <p className="text-sm text-danger-600">
                <span className="font-bold">{topBottleneck.fieldName}</span> causes {topBottleneck.abandonRate}% of drop-offs.
                Add a trust badge to reduce anxiety.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

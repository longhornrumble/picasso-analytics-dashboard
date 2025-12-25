/**
 * FieldBottlenecks Component
 * Shows which form fields cause the most drop-offs
 */

import type { FieldBottleneck } from '../types/analytics';

interface FieldBottlenecksProps {
  bottlenecks: FieldBottleneck[];
  totalAbandons: number;
}

export function FieldBottlenecks({ bottlenecks, totalAbandons }: FieldBottlenecksProps) {
  // Get the top bottleneck for the insight
  const topBottleneck = bottlenecks[0];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Field Bottlenecks</h3>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{totalAbandons.toLocaleString()}</p>
          <p className="text-xs text-red-500 uppercase font-medium">Abandons</p>
        </div>
      </div>

      {/* Bottleneck bars */}
      <div className="space-y-3">
        {bottlenecks.length > 0 ? (
          bottlenecks.map((bottleneck) => (
            <div key={bottleneck.fieldName} className="flex items-center gap-3">
              <div className="w-28 text-sm text-gray-600 truncate" title={bottleneck.fieldName}>
                {bottleneck.fieldName}
              </div>
              <div className="flex-1 relative">
                <div className="h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded transition-all duration-500"
                    style={{ width: `${bottleneck.abandonRate}%` }}
                  />
                </div>
              </div>
              <div className="w-12 text-right text-sm font-medium text-red-500">
                {bottleneck.abandonRate}%
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">No bottlenecks detected</p>
            <p className="text-sm">All forms are completing without drop-offs</p>
          </div>
        )}
      </div>

      {/* Insight box */}
      {topBottleneck && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-red-700">Insight</p>
              <p className="text-sm text-red-600">
                <span className="font-semibold">{topBottleneck.fieldName}</span> causes {topBottleneck.abandonRate}% of drop-offs.
                Add a trust badge to reduce anxiety.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

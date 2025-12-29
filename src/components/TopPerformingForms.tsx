/**
 * TopPerformingForms Component
 * Shows the best performing forms with conversion rates
 */

import type { FormStats } from '../types/analytics';

interface TopPerformingFormsProps {
  forms: FormStats[];
  totalSubmissions: number;
  totalActiveForms: number;
  onViewAll: () => void;
}

export function TopPerformingForms({
  forms,
  totalSubmissions,
  totalActiveForms,
  onViewAll,
}: TopPerformingFormsProps) {
  const getTrendIcon = (trend: FormStats['trend']) => {
    switch (trend) {
      case 'trending':
        return (
          <span className="text-primary-500 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Trending
          </span>
        );
      case 'stable':
        return (
          <span className="text-slate-400 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Stable
          </span>
        );
      case 'low':
        return (
          <span className="text-danger-400 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Low activity
          </span>
        );
    }
  };

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Top Performing Forms</h3>
        <span className="text-sm text-primary-500 font-medium">
          {totalSubmissions.toLocaleString()} Total Submissions
        </span>
      </div>

      {/* Forms grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((form) => (
          <div
            key={form.id}
            className="border border-slate-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-slate-900 text-sm truncate flex-1">
                {form.name}
              </h4>
              <span className="text-sm font-semibold text-slate-700 ml-2">
                {form.conversionRate}% Conv.
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {form.submissions} submissions
              </span>
              {getTrendIcon(form.trend)}
            </div>
          </div>
        ))}

        {/* View All card */}
        <button
          onClick={onViewAll}
          className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50 transition-all flex flex-col items-center justify-center min-h-[80px]"
        >
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-700">View All Forms</span>
          <span className="text-xs text-primary-500">{totalActiveForms} active forms</span>
        </button>
      </div>
    </div>
  );
}

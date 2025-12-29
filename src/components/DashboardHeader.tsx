/**
 * DashboardHeader Component
 * Contains title, time filters, dropdowns, and export button
 */

import { useAuth } from '../context/AuthContext';
import type { TimeRange } from '../types/analytics';

interface DashboardHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  selectedForm: string;
  onFormChange: (formId: string) => void;
  forms: { id: string; name: string }[];
  onExport: () => void;
  isExporting: boolean;
}

export function DashboardHeader({
  timeRange,
  onTimeRangeChange,
  selectedForm,
  onFormChange,
  forms,
  onExport,
  isExporting,
}: DashboardHeaderProps) {
  const { logout } = useAuth();

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '1d', label: '1 day' },
    { value: '7d', label: '1 week' },
    { value: '30d', label: '1 month' },
  ];

  return (
    <header className="mb-8">
      {/* Top row: Title and Sign out */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form Analytics Overview</h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-danger-500 text-white rounded-lg text-sm font-medium hover:bg-danger-600 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Time range tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => onTimeRangeChange(range.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === range.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Right: Dropdowns and Export */}
        <div className="flex items-center gap-3">
          {/* Form filter dropdown */}
          <select
            value={selectedForm}
            onChange={(e) => onFormChange(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-[140px]"
          >
            <option value="">All Forms</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>

          {/* Date range picker placeholder */}
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-600">Select Date Range</span>
          </button>

          {/* Export button */}
          <button
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isExporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            <span className="text-gray-700 font-medium">Export Data</span>
          </button>
        </div>
      </div>
    </header>
  );
}

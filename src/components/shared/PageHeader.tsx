/**
 * PageHeader Component (Generic)
 * Premium Design System
 *
 * Features:
 * - Section label with primary color accent line
 * - Large bold title
 * - Primary color-filled time range pills
 * - Date range and export buttons
 *
 * Used by: Forms Dashboard, Conversations Dashboard, Attribution Dashboard
 */

import type { ReactNode } from 'react';
import { DateRangePicker, type DateRange } from './DateRangePicker';
import { Dropdown } from './Dropdown';

export type TimeRangeValue = '1d' | '7d' | '30d' | '90d' | 'custom';

export interface TimeRangeOption {
  value: TimeRangeValue;
  label: string;
}

interface PageHeaderProps {
  /** Page title (large, bold) */
  title: string;
  /** Section label (small, uppercase, appears above title) */
  sectionLabel?: string;
  /** Currently selected time range */
  timeRange: TimeRangeValue;
  /** Time range change handler */
  onTimeRangeChange: (range: TimeRangeValue) => void;
  /** Custom time range options (defaults to 1D, 7D, 30D) */
  timeRangeOptions?: TimeRangeOption[];
  /** Export button click handler */
  onExport?: () => void;
  /** Export in progress */
  isExporting?: boolean;
  /** Sign out handler */
  onSignOut?: () => void;
  /** Show sign out button */
  showSignOut?: boolean;
  /** Show date range picker */
  showDatePicker?: boolean;
  /** Custom date range (when timeRange is 'custom') */
  dateRange?: DateRange | null;
  /** Date range change handler */
  onDateRangeChange?: (range: DateRange) => void;
  /** Show export button */
  showExport?: boolean;
  /** Slot for dashboard-specific filters (e.g., form dropdown) */
  filters?: ReactNode;
  /** Additional actions in header (e.g., refresh button) */
  actions?: ReactNode;
}

const defaultTimeRanges: TimeRangeOption[] = [
  { value: '1d', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

export function PageHeader({
  title,
  sectionLabel,
  timeRange,
  onTimeRangeChange,
  timeRangeOptions = defaultTimeRanges,
  onExport,
  isExporting = false,
  showDatePicker = true,
  dateRange = null,
  onDateRangeChange,
  showExport = true,
  filters,
  actions,
}: PageHeaderProps) {
  // Handle date range selection - switches to custom mode
  const handleDateRangeChange = (range: DateRange) => {
    onTimeRangeChange('custom');
    onDateRangeChange?.(range);
  };

  return (
    <header className="mb-8">
      {/* Section Label and Title */}
      <div className="mb-6">
        {sectionLabel && (
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-0.5 rounded-full bg-primary-500"
            />
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500"
            >
              {sectionLabel}
            </span>
          </div>
        )}
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Time range pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {timeRangeOptions.map((range) => {
            const isActive = timeRange === range.value;
            return (
              <button
                key={range.value}
                onClick={() => onTimeRangeChange(range.value)}
                className={`
                  px-4 py-2 rounded-lg text-xs font-semibold tracking-wider
                  transition-all duration-200
                  ${isActive
                    ? 'text-white shadow-sm bg-primary-500'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {/* Right: Filters, Date picker, Actions */}
        <div className="flex items-center gap-3">
          {/* Dashboard-specific filters slot */}
          {filters}

          {/* Date range picker */}
          {showDatePicker && onDateRangeChange && (
            <DateRangePicker
              dateRange={timeRange === 'custom' ? dateRange : null}
              onDateRangeChange={handleDateRangeChange}
            />
          )}

          {/* Additional actions (e.g., export dropdown) */}
          {actions}

          {/* Export button (legacy - use actions prop with ExportDropdown instead) */}
          {showExport && onExport && (
            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-50 transition-all duration-200 uppercase tracking-wider"
            >
              {isExporting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span className="text-slate-700">Export</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Helper: Filter dropdown component
 * Reusable styled dropdown for filters (uses custom Dropdown component)
 */
export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder = 'All',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  className?: string;
}) {
  // Convert options format and add placeholder option
  const dropdownOptions = [
    { value: '', label: placeholder },
    ...options.map(opt => ({ value: opt.id, label: opt.name })),
  ];

  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={dropdownOptions}
      className={className}
    />
  );
}

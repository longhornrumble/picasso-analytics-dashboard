/**
 * DateRangePicker Component
 * Custom date range selection with calendar popover
 */

import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  /** Currently selected date range */
  dateRange: DateRange | null;
  /** Callback when date range changes */
  onDateRangeChange: (range: DateRange) => void;
  /** Optional className for styling */
  className?: string;
}

// Preset ranges for quick selection
const presets = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(dateRange?.startDate || null);
  const [endDate, setEndDate] = useState<Date | null>(dateRange?.endDate || null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update local state when prop changes
  useEffect(() => {
    if (dateRange) {
      setStartDate(dateRange.startDate);
      setEndDate(dateRange.endDate);
    }
  }, [dateRange]);

  const handlePresetClick = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(days === 0 ? new Date() : subDays(new Date(), days));
    setStartDate(start);
    setEndDate(end);
    onDateRangeChange({ startDate: start, endDate: end });
    setIsOpen(false);
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onDateRangeChange({
        startDate: startOfDay(startDate),
        endDate: endOfDay(endDate),
      });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const formatDisplayDate = () => {
    if (!dateRange) return 'Select Date Range';
    const { startDate: start, endDate: end } = dateRange;
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'MMM d, yyyy');
    }
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors ${
          dateRange ? 'border-green-300 bg-green-50' : 'border-gray-200'
        }`}
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={dateRange ? 'text-gray-900 font-medium' : 'text-gray-600'}>
          {formatDisplayDate()}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 min-w-[340px]">
          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.days)}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={endDate || new Date()}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholderText="Start date"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || undefined}
                maxDate={new Date()}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholderText="End date"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!startDate || !endDate}
                className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

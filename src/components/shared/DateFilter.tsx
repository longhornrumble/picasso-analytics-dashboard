/**
 * DateFilter Component
 * Dropdown filter for date ranges in tables
 */

import { useState, useRef, useEffect } from 'react';

export type DateFilterValue = 'all' | 'today' | '7d' | '30d' | 'custom';

export interface DateFilterRange {
  value: DateFilterValue;
  startDate?: Date;
  endDate?: Date;
}

interface DateFilterProps {
  value: DateFilterRange;
  onChange: (range: DateFilterRange) => void;
  className?: string;
}

const DATE_OPTIONS: { value: DateFilterValue; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

export function DateFilter({ value, onChange, className = '' }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.value === 'custom');
  const [customStart, setCustomStart] = useState<string>(
    value.startDate ? value.startDate.toISOString().split('T')[0] : ''
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value.endDate ? value.endDate.toISOString().split('T')[0] : ''
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (selectedValue: DateFilterValue) => {
    if (selectedValue === 'custom') {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    onChange({ value: selectedValue });
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({
        value: 'custom',
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      });
      setIsOpen(false);
    }
  };

  const currentLabel = DATE_OPTIONS.find(opt => opt.value === value.value)?.label || 'All Dates';
  const isFiltered = value.value !== 'all';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Filter Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 border rounded-lg transition-colors ${
          isFiltered
            ? 'border-primary-300 bg-primary-50 text-primary-700'
            : 'border-gray-200 hover:bg-gray-50 text-gray-500'
        }`}
        title={isFiltered ? `Filtered: ${currentLabel}` : 'Filter by date'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {isFiltered && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by Date</p>
          </div>

          {/* Preset options */}
          {DATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${
                option.value === value.value && !showCustom
                  ? 'text-primary-700 bg-primary-50 font-medium'
                  : 'text-gray-700'
              }`}
            >
              {option.value === value.value && !showCustom && (
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(option.value !== value.value || showCustom) && <span className="w-4" />}
              <span>{option.label}</span>
            </button>
          ))}

          {/* Custom date picker */}
          {showCustom && (
            <div className="px-3 py-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="flex-1 px-3 py-1.5 text-sm text-white bg-primary-500 rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Clear filter */}
          {isFiltered && (
            <div className="px-3 py-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  onChange({ value: 'all' });
                  setShowCustom(false);
                  setIsOpen(false);
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

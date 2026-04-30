/**
 * ExportDropdown Component
 * Dropdown menu for exporting dashboard data in PDF or CSV format
 */

import { useState, useRef, useEffect } from 'react';

export type ExportFormat = 'pdf' | 'csv';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: 'pdf' | 'csv';
}

interface ExportDropdownProps {
  /** Export handler - called with selected format */
  onExport: (format: ExportFormat) => void;
  /** Export in progress */
  isExporting?: boolean;
  /** Currently exporting format */
  exportingFormat?: ExportFormat | null;
  /** Available export options */
  options?: ExportOption[];
  /** Disabled state */
  disabled?: boolean;
  /** Optional className for styling */
  className?: string;
}

const defaultOptions: ExportOption[] = [
  {
    format: 'pdf',
    label: 'Export as PDF',
    description: 'Summary report with charts',
    icon: 'pdf',
  },
  {
    format: 'csv',
    label: 'Export as CSV',
    description: 'Raw data for spreadsheets',
    icon: 'csv',
  },
];

const PdfIcon = () => (
  <svg className="w-5 h-5 text-danger-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13a.5.5 0 0 1 .5-.5h1a1.5 1.5 0 0 1 0 3H9.5v1a.5.5 0 0 1-1 0v-3.5zm1 2h.5a.5.5 0 0 0 0-1h-.5v1zm4-2a.5.5 0 0 1 .5-.5h1a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-1a.5.5 0 0 1-.5-.5v-4zm1 4h.5a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-.5v3z"/>
  </svg>
);

const CsvIcon = () => (
  <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v1H8v-1zm0 2h8v1H8v-1zm0 2h5v1H8v-1z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export function ExportDropdown({
  onExport,
  isExporting = false,
  exportingFormat = null,
  options = defaultOptions,
  disabled = false,
  className = '',
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ExportFormat) => {
    setIsOpen(false);
    onExport(format);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="flex items-center justify-between gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full"
      >
        <div className="flex items-center gap-2">
          {isExporting ? (
            <SpinnerIcon />
          ) : (
            <DownloadIcon />
          )}
          <span className="text-slate-700 font-medium">
            {isExporting ? 'Exporting...' : 'Export Data'}
          </span>
        </div>
        {!isExporting && <ChevronDownIcon />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                disabled={isExporting && exportingFormat === option.format}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {option.icon === 'pdf' ? <PdfIcon /> : <CsvIcon />}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {option.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

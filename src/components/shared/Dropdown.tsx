/**
 * Custom Dropdown Component
 * Styled dropdown that replaces native select for consistent appearance
 */

import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
}

export function Dropdown({ value, onChange, options, className = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current label
  const currentOption = options.find(opt => opt.value === value);
  const currentLabel = currentOption?.label || value;

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

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-full sm:min-w-[140px] text-left"
      >
        <span className="text-slate-700">{currentLabel}</span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-full sm:min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 ${
                option.value === value
                  ? 'text-primary-700 bg-primary-50 font-medium'
                  : 'text-slate-700'
              }`}
            >
              {option.value === value && (
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className={option.value === value ? '' : 'ml-6'}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

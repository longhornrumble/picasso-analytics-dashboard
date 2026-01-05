/**
 * PipelineStepper Component
 * Interactive pipeline status progression for Lead Workspace Drawer
 *
 * Phase 3: Pipeline Stepper
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 *
 * Responsive Design:
 * - Desktop: Pill buttons for quick status changes
 * - Mobile: Custom dropdown for space efficiency (avoids native select positioning issues)
 */

import { useState, useRef, useEffect } from 'react';
import type { PipelineStatus } from '../../types/analytics';

interface PipelineStepperProps {
  /** Current pipeline status */
  currentStatus: PipelineStatus;
  /** Handler when status changes */
  onStatusChange?: (newStatus: PipelineStatus) => void;
  /** Whether changes are being saved */
  isSaving?: boolean;
  /** Disable all interactions */
  disabled?: boolean;
}

/** Pipeline stage configuration */
interface PipelineStage {
  id: PipelineStatus;
  label: string;
  description: string;
  color: 'green' | 'blue' | 'purple' | 'red' | 'amber' | 'gray';
}

/** Ordered pipeline stages (excluding archived which is handled separately) */
const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'new',
    label: 'New',
    description: 'Awaiting review',
    color: 'green',
  },
  {
    id: 'reviewing',
    label: 'Reviewing',
    description: 'Under evaluation',
    color: 'blue',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    description: 'Outreach complete',
    color: 'purple',
  },
  {
    id: 'disqualified',
    label: 'Disqualified',
    description: 'Does not meet criteria',
    color: 'red',
  },
  {
    id: 'advancing',
    label: 'Advancing',
    description: 'Moving to next step',
    color: 'amber',
  },
];

/**
 * Get color classes for a stage button
 */
function getStageColors(color: PipelineStage['color'], isActive: boolean) {
  if (isActive) {
    switch (color) {
      case 'green':
        return 'bg-primary-500 text-white';
      case 'blue':
        return 'bg-blue-500 text-white';
      case 'purple':
        return 'bg-purple-500 text-white';
      case 'red':
        return 'bg-red-500 text-white';
      case 'amber':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }
  return 'text-slate-400 bg-slate-100 hover:text-slate-500 hover:bg-slate-200';
}

/**
 * Get color dot class for dropdown items
 */
function getDotColor(color: PipelineStage['color']) {
  switch (color) {
    case 'green':
      return 'bg-primary-500';
    case 'blue':
      return 'bg-blue-500';
    case 'purple':
      return 'bg-purple-500';
    case 'red':
      return 'bg-red-500';
    case 'amber':
      return 'bg-amber-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Check if a stage is the current active stage
 */
function isStageActive(stageId: PipelineStatus, currentStatus: PipelineStatus): boolean {
  return stageId === currentStatus;
}

/**
 * Check if a stage can be selected (any stage except current)
 */
function isStageSelectable(stageId: PipelineStatus, currentStatus: PipelineStatus): boolean {
  return stageId !== currentStatus;
}

/**
 * Loading spinner for saving state
 */
function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function PipelineStepper({
  currentStatus,
  onStatusChange,
  isSaving = false,
  disabled = false,
}: PipelineStepperProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current stage
  const currentStage = PIPELINE_STAGES.find(s => s.id === currentStatus) || PIPELINE_STAGES[0];

  const handleStageClick = (stageId: PipelineStatus) => {
    if (disabled || isSaving) return;
    if (!isStageSelectable(stageId, currentStatus)) return;

    onStatusChange?.(stageId);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDropdownOpen]);

  return (
    <div>
      {/* Section Label */}
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
        CONTACT PHASE
      </p>

      {/* Desktop: Pill Buttons (hidden on mobile) */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {PIPELINE_STAGES.map((stage) => {
          const isActive = isStageActive(stage.id, currentStatus);
          const isSelectable = isStageSelectable(stage.id, currentStatus);

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStageClick(stage.id)}
              disabled={disabled || isSaving || (!isSelectable && !isActive)}
              className={`
                px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200
                ${getStageColors(stage.color, isActive)}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label={`${stage.label}: ${stage.description}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isSaving && isActive ? (
                <LoadingSpinner />
              ) : (
                stage.label.toUpperCase()
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile: Custom Dropdown (hidden on desktop) */}
      <div className="sm:hidden relative" ref={dropdownRef}>
        {/* Dropdown Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && !isSaving && setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled || isSaving}
          className={`
            w-full flex items-center justify-between px-4 py-2.5
            text-sm font-medium rounded-lg border-2 bg-white
            ${isDropdownOpen ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'}
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          `}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <span className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${getDotColor(currentStage.color)}`} />
            <span>{currentStage.label} — {currentStage.description}</span>
          </span>
          {isSaving ? (
            <LoadingSpinner className="w-5 h-5 text-slate-400" />
          ) : (
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden"
            role="listbox"
            aria-label="Select contact phase"
          >
            {PIPELINE_STAGES.map((stage) => {
              const isActive = stage.id === currentStatus;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleStageClick(stage.id)}
                  disabled={isActive}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left text-sm
                    transition-colors duration-150
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                    }
                    disabled:cursor-default
                  `}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(stage.color)}`} />
                  <span className="flex-1">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-slate-400"> — {stage.description}</span>
                  </span>
                  {isActive && (
                    <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Archived State Message */}
      {currentStatus === 'archived' && (
        <p className="mt-3 text-sm text-gray-500">
          This lead has been archived
        </p>
      )}
    </div>
  );
}

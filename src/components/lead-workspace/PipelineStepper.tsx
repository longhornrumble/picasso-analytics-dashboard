/**
 * PipelineStepper Component
 * Interactive pipeline status progression for Lead Workspace Drawer
 *
 * Phase 3: Pipeline Stepper
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

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
  icon: 'inbox' | 'eye' | 'phone' | 'archive';
}

/** Ordered pipeline stages */
const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'new',
    label: 'New',
    description: 'Awaiting review',
    icon: 'inbox',
  },
  {
    id: 'reviewing',
    label: 'Reviewing',
    description: 'Under evaluation',
    icon: 'eye',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    description: 'Outreach complete',
    icon: 'phone',
  },
  {
    id: 'archived',
    label: 'Archived',
    description: 'Processing complete',
    icon: 'archive',
  },
];

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
  // Can select any stage except the current one
  return stageId !== currentStatus;
}

/**
 * Loading spinner for saving state
 */
function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
  const handleStageClick = (stageId: PipelineStatus) => {
    if (disabled || isSaving) return;
    if (!isStageSelectable(stageId, currentStatus)) return;
    if (stageId === currentStatus) return;

    onStatusChange?.(stageId);
  };

  // Only show first 3 stages in the main stepper (not archived)
  const visibleStages = PIPELINE_STAGES.slice(0, 3);

  return (
    <div>
      {/* Section Label */}
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
        EXECUTION PHASE
      </p>

      {/* Compact Pill Buttons - modern minimal design */}
      <div className="flex items-center gap-2">
        {visibleStages.map((stage) => {
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
                ${isActive
                  ? 'bg-primary-500 text-white'
                  : 'text-slate-400 bg-slate-100 hover:text-slate-500 hover:bg-slate-200'
                }
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

      {/* Archived State Message */}
      {currentStatus === 'archived' && (
        <p className="mt-3 text-sm text-gray-500">
          This lead has been archived
        </p>
      )}
    </div>
  );
}

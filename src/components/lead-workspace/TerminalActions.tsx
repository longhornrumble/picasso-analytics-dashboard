/**
 * TerminalActions Component
 * Footer actions for lead processing: Archive and Next Lead
 *
 * Phase 7: Terminal Actions
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import { useState } from 'react';
import type { PipelineStatus } from '../../types/analytics';

interface TerminalActionsProps {
  /** Current pipeline status */
  currentStatus: PipelineStatus;
  /** Handler to archive the lead */
  onArchive?: () => void;
  /** Handler to navigate to next lead */
  onNextLead?: () => void;
  /** Handler to close the drawer */
  onClose?: () => void;
  /** Whether archive is in progress */
  isArchiving?: boolean;
  /** Whether there's a next lead available */
  hasNextLead?: boolean;
  /** Count of leads remaining in queue */
  queueCount?: number;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Confirmation modal for archive action (light theme)
 */
function ArchiveConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isArchiving,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isArchiving: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white border border-gray-200 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Archive this lead?
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            This will move the lead to archived status. You can restore it later if needed.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isArchiving}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isArchiving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isArchiving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Archiving...
                </>
              ) : (
                'Archive Lead'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TerminalActions({
  currentStatus,
  onArchive,
  onNextLead,
  onClose,
  isArchiving = false,
  hasNextLead = false,
  queueCount = 0,
  disabled = false,
}: TerminalActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const isArchived = currentStatus === 'archived';

  const handleArchiveClick = () => {
    if (isArchived) return;
    setShowConfirm(true);
  };

  const handleConfirmArchive = () => {
    onArchive?.();
    setShowConfirm(false);
  };

  const handleNextLead = () => {
    if (hasNextLead) {
      onNextLead?.();
    }
  };

  return (
    <>
      <footer className="sticky bottom-0 px-6 py-5 border-t border-gray-200 bg-white">
        {/* Top row: Archive and Next Record */}
        <div className="flex items-center justify-between gap-4 mb-3">
          {/* Left side: Archive */}
          <div className="flex items-center gap-3">
            {!isArchived && (
              <button
                type="button"
                onClick={handleArchiveClick}
                disabled={disabled || isArchiving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                ARCHIVE RECORD
              </button>
            )}

            {isArchived && (
              <span className="px-5 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-semibold flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                ARCHIVED
              </span>
            )}
          </div>

          {/* Right side: Next Record */}
          <button
            type="button"
            onClick={handleNextLead}
            disabled={disabled || !hasNextLead}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <span>NEXT RECORD</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        {/* Bottom row: Save & Exit Workspace */}
        <button
          type="button"
          onClick={onClose}
          disabled={disabled}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          SAVE & EXIT WORKSPACE
        </button>

        {/* Queue info */}
        {queueCount > 0 && (
          <p className="mt-3 text-center text-xs text-gray-500">
            {queueCount} lead{queueCount !== 1 ? 's' : ''} remaining in queue
          </p>
        )}
      </footer>

      {/* Archive Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={showConfirm}
        onConfirm={handleConfirmArchive}
        onCancel={() => setShowConfirm(false)}
        isArchiving={isArchiving}
      />
    </>
  );
}

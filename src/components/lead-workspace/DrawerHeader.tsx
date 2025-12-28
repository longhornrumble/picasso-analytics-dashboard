/**
 * DrawerHeader Component
 * Sticky header for Lead Workspace Drawer
 *
 * Phase 2: Header & Metadata
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import type { LeadWorkspaceData } from '../../types/analytics';

interface DrawerHeaderProps {
  /** Lead data to display */
  lead: LeadWorkspaceData | null;
  /** Loading state */
  isLoading?: boolean;
  /** Handler to close the drawer */
  onClose: () => void;
  /** Handler to navigate to next lead */
  onNext?: () => void;
  /** Whether next lead is available */
  hasNextLead?: boolean;
  /** Queue count for badge */
  queueCount?: number;
}

/**
 * Format lead name from fields
 */
function getLeadName(lead: LeadWorkspaceData | null): string {
  if (!lead?.fields) return 'Unknown Lead';

  const name = lead.fields.name || lead.fields.full_name;
  if (name) return name;

  const firstName = lead.fields.first_name || '';
  const lastName = lead.fields.last_name || '';
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return 'Anonymous';
}

export function DrawerHeader({
  lead,
  isLoading = false,
  onClose,
  onNext,
  hasNextLead = false,
  queueCount = 0,
}: DrawerHeaderProps) {
  const leadName = getLeadName(lead);

  return (
    <header className="sticky top-0 z-10 px-6 py-5 border-b border-gray-200 bg-white">
      {/* Top Row: Label, Ref ID, Close Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Lead Workspace Label */}
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            LEAD WORKSPACE
          </span>

          {/* Ref ID Badge */}
          {lead && (
            <span className="px-2 py-1 text-xs font-mono font-semibold bg-slate-800 text-white rounded">
              REF: SUB_{lead.submission_id.slice(0, 5).toUpperCase()}
            </span>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="drawer-close-btn"
          aria-label="Close drawer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Lead Name */}
      <div className="flex items-end justify-between">
        <div>
          {isLoading ? (
            <>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">
                {leadName}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {lead?.form_label || lead?.form_id || 'Form Submission'}
              </p>
            </>
          )}
        </div>

        {/* Next Lead Button (mini version in header) */}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNextLead}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: hasNextLead ? '#50C878' : 'transparent',
              border: hasNextLead ? 'none' : '1px solid rgba(148, 163, 184, 0.3)',
            }}
            title={hasNextLead ? `${queueCount} leads in queue` : 'No more leads'}
          >
            <span>Next</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {queueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                {queueCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

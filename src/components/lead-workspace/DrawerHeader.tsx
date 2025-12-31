/**
 * DrawerHeader Component
 * Sticky header for Lead Workspace Drawer
 *
 * Phase 2: Header & Metadata
 * Phase 8: Accessibility polish - auto-focus close button (WCAG 2.4.3)
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 * Uses centralized tokens from @picasso/shared-styles (see /picasso-shared-styles/README.md)
 */

import type { RefObject } from 'react';
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
  /** Ref for close button (auto-focus target for accessibility) */
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Get field value case-insensitively from fields object
 */
function getField(fields: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    // Check exact key first
    if (fields[key]) return fields[key];
    // Check lowercase
    const lower = key.toLowerCase();
    if (fields[lower]) return fields[lower];
    // Check Title Case
    const title = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    if (fields[title]) return fields[title];
  }
  return '';
}

/**
 * Format lead name from fields
 */
function getLeadName(lead: LeadWorkspaceData | null): string {
  if (!lead?.fields) return 'Unknown Lead';

  // Check for name fields (case-insensitive)
  const name = getField(lead.fields, 'name', 'Name', 'full_name', 'Full Name', 'fullName');
  if (name) return name;

  const firstName = getField(lead.fields, 'first_name', 'First Name', 'firstName');
  const lastName = getField(lead.fields, 'last_name', 'Last Name', 'lastName');
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
  closeButtonRef,
}: DrawerHeaderProps) {
  const leadName = getLeadName(lead);

  return (
    <header className="sticky top-0 z-10 px-6 py-5 border-b border-gray-200 bg-white">
      {/* Top Row: Label, Ref ID, Close Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Lead Workspace Label */}
          <span className="text-xs font-bold uppercase tracking-wider text-primary-600">
            LEAD WORKSPACE
          </span>
        </div>

        {/* Close Button - receives focus when drawer opens (WCAG 2.4.3) */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="drawer-close-btn"
          aria-label="Close drawer (Escape)"
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
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              hasNextLead ? 'bg-primary-500 text-white' : 'bg-transparent border border-slate-300/30 text-slate-400'
            }`}
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

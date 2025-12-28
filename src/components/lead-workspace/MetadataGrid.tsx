/**
 * MetadataGrid Component
 * Attribution info display for Lead Workspace Drawer
 *
 * Phase 2: Header & Metadata
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import type { LeadWorkspaceData } from '../../types/analytics';

interface MetadataGridProps {
  /** Lead data to display */
  lead: LeadWorkspaceData | null;
  /** Loading state */
  isLoading?: boolean;
}



/**
 * Extract zip code from fields
 */
function extractZipCode(lead: LeadWorkspaceData | null): string {
  if (!lead?.fields) return '—';

  return (
    lead.zip_code ||
    lead.fields.zip ||
    lead.fields.zip_code ||
    lead.fields.postal_code ||
    lead.fields.zipcode ||
    '—'
  );
}

/**
 * Extract program ID from fields
 */
function extractProgramId(lead: LeadWorkspaceData | null): string {
  if (!lead) return '—';

  return (
    lead.program_id ||
    lead.form_id ||
    '—'
  );
}

export function MetadataGrid({ lead, isLoading = false }: MetadataGridProps) {

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Program ID Card */}
      <div className="drawer-card flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">PROGRAM ID</p>
          {isLoading ? (
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-sm text-slate-800 font-semibold uppercase">{extractProgramId(lead)}</p>
          )}
        </div>
      </div>

      {/* Zip Code Card */}
      <div className="drawer-card flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">ZIP CODE</p>
          {isLoading ? (
            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-sm text-slate-800 font-semibold">{extractZipCode(lead)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

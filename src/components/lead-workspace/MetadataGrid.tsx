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
 * Checks dedicated zip fields first, then tries to parse from address
 */
function extractZipCode(lead: LeadWorkspaceData | null): string {
  if (!lead) return '—';

  // Check dedicated zip fields first
  const directZip =
    lead.zip_code ||
    lead.fields?.zip ||
    lead.fields?.zip_code ||
    lead.fields?.postal_code ||
    lead.fields?.zipcode ||
    lead.fields?.Zip ||
    lead.fields?.ZipCode ||
    lead.fields?.['Zip Code'];

  if (directZip) return directZip;

  // Try to extract from address field
  const addressField =
    lead.fields?.address ||
    lead.fields?.Address ||
    lead.fields?.full_address ||
    lead.fields?.['Full Address'] ||
    lead.fields?.mailing_address;

  if (addressField && typeof addressField === 'string') {
    // Look for 5-digit US zip code pattern (with optional +4)
    const zipMatch = addressField.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) {
      return zipMatch[1];
    }
  }

  return '—';
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* Program ID Card */}
      <div className="drawer-card flex items-center gap-2 sm:gap-3 overflow-hidden">
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-gray-400">PROGRAM ID</p>
          {isLoading ? (
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xs sm:text-sm text-slate-800 font-semibold uppercase truncate" title={extractProgramId(lead)}>{extractProgramId(lead)}</p>
          )}
        </div>
      </div>

      {/* Zip Code Card */}
      <div className="drawer-card flex items-center gap-2 sm:gap-3 overflow-hidden">
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-gray-400">ZIP CODE</p>
          {isLoading ? (
            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xs sm:text-sm text-slate-800 font-semibold truncate">{extractZipCode(lead)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CommunicationsCard Component
 * Quick action buttons for email and phone outreach
 *
 * Phase 5: Communications Card
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import { useState, useMemo } from 'react';
import type { LeadWorkspaceData } from '../../types/analytics';

interface CommunicationsCardProps {
  /** Lead data containing contact info */
  lead: LeadWorkspaceData | null;
  /** Loading state */
  isLoading?: boolean;
  /** Tenant name for email subject */
  tenantName?: string;
}

/**
 * Extract contact information from lead fields
 */
function extractContactInfo(lead: LeadWorkspaceData | null): {
  name: string;
  email: string | null;
  phone: string | null;
} {
  if (!lead?.fields) {
    return { name: 'Unknown', email: null, phone: null };
  }

  const fields = lead.fields;

  // Extract name
  let name = 'Unknown';
  if (fields.name) {
    name = fields.name;
  } else if (fields.full_name) {
    name = fields.full_name;
  } else if (fields.first_name || fields.last_name) {
    name = `${fields.first_name || ''} ${fields.last_name || ''}`.trim();
  }

  // Extract email
  const email = fields.email || fields.email_address || null;

  // Extract phone
  const phone = fields.phone || fields.mobile || fields.phone_number || fields.tel || null;

  return { name, email, phone };
}

/**
 * Format phone number for display
 */
function formatPhoneDisplay(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Generate mailto link with pre-filled subject
 */
function generateMailtoLink(email: string, leadName: string, tenantName?: string): string {
  const subject = encodeURIComponent(
    tenantName
      ? `Follow-up from ${tenantName}`
      : 'Following up on your inquiry'
  );
  const body = encodeURIComponent(
    `Hi ${leadName.split(' ')[0]},\n\nThank you for your interest. `
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/**
 * Copy button with feedback
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title={copied ? 'Copied!' : `Copy ${label}`}
    >
      {copied ? (
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Skeleton loader (light theme)
 */
function CommunicationsSkeleton() {
  return (
    <div className="drawer-card">
      <div className="h-3 w-28 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="space-y-3">
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export function CommunicationsCard({
  lead,
  isLoading = false,
  tenantName,
}: CommunicationsCardProps) {
  const contactInfo = useMemo(() => extractContactInfo(lead), [lead]);

  if (isLoading) {
    return <CommunicationsSkeleton />;
  }

  const hasEmail = !!contactInfo.email;
  const hasPhone = !!contactInfo.phone;
  const hasNoContact = !hasEmail && !hasPhone;

  if (hasNoContact) {
    return (
      <div className="drawer-card">
        <p className="label-aviation-muted mb-4">COMMUNICATIONS</p>
        <div className="text-center py-6">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p className="text-sm text-gray-500">No contact information available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer-card">
      <p className="label-aviation-muted mb-4">COMMUNICATIONS</p>

      <div className="space-y-3">
        {/* Email Action */}
        {hasEmail && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
              <p className="text-sm text-slate-800 truncate">{contactInfo.email}</p>
            </div>
            <div className="flex items-center gap-1">
              <CopyButton value={contactInfo.email!} label="email" />
              <a
                href={generateMailtoLink(contactInfo.email!, contactInfo.name, tenantName)}
                className="p-1.5 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="Compose email"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Phone Action */}
        {hasPhone && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Phone</p>
              <p className="text-sm text-slate-800">{formatPhoneDisplay(contactInfo.phone!)}</p>
            </div>
            <div className="flex items-center gap-1">
              <CopyButton value={contactInfo.phone!} label="phone" />
              <a
                href={`tel:${contactInfo.phone!.replace(/\D/g, '')}`}
                className="p-1.5 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                title="Call"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Quick tip */}
      <p className="mt-4 text-xs text-gray-500 text-center">
        Click the arrow to open in your default app
      </p>
    </div>
  );
}

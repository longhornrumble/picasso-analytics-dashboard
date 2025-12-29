/**
 * FormDataManifest Component
 * Displays submitted form fields in a structured, readable format
 *
 * Phase 4: Form Data Manifest
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import { useState, useMemo } from 'react';
import type { LeadWorkspaceData, ParsedFormField } from '../../types/analytics';

interface FormDataManifestProps {
  /** Lead data containing form fields */
  lead: LeadWorkspaceData | null;
  /** Loading state */
  isLoading?: boolean;
}

/** Priority fields that should appear first */
const PRIORITY_FIELDS = ['name', 'full_name', 'first_name', 'email', 'phone', 'mobile'];

/** Fields to hide from display */
const HIDDEN_FIELDS = ['submission_id', 'session_id', 'tenant_id', 'tenant_hash', 'timestamp'];

/**
 * Convert snake_case or camelCase to Title Case
 */
function toTitleCase(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Detect field type from key and value
 */
function detectFieldType(key: string, value: unknown): ParsedFormField['type'] {
  const keyLower = key.toLowerCase();

  if (keyLower.includes('email')) return 'email';
  if (keyLower.includes('phone') || keyLower.includes('mobile') || keyLower.includes('tel')) return 'tel';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) return 'composite';
  return 'text';
}

/**
 * Format value for display based on type
 */
function formatValue(value: unknown, type: ParsedFormField['type']): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'array':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'composite':
      if (typeof value === 'object' && value !== null) {
        // Handle nested objects like { "First Name": "John", "Last Name": "Doe" }
        return Object.entries(value)
          .map(([k, v]) => `${toTitleCase(k)}: ${v}`)
          .join(', ');
      }
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Parse form fields into structured display format
 */
function parseFormFields(lead: LeadWorkspaceData | null): ParsedFormField[] {
  if (!lead?.fields) return [];

  const fields: ParsedFormField[] = [];

  Object.entries(lead.fields).forEach(([key, value]) => {
    // Skip hidden fields
    if (HIDDEN_FIELDS.includes(key.toLowerCase())) return;

    const type = detectFieldType(key, value);
    const formattedValue = formatValue(value, type);

    fields.push({
      label: toTitleCase(key),
      value: formattedValue,
      rawKey: key,
      type,
      isExpandable: formattedValue.length > 100,
    });
  });

  // Sort: priority fields first, then alphabetically
  return fields.sort((a, b) => {
    const aPriority = PRIORITY_FIELDS.findIndex((f) => a.rawKey.toLowerCase().includes(f));
    const bPriority = PRIORITY_FIELDS.findIndex((f) => b.rawKey.toLowerCase().includes(f));

    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Single field row component (light theme)
 */
function FieldRow({ field }: { field: ParsedFormField }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayValue = field.isExpandable && !isExpanded
    ? `${field.value.slice(0, 100)}...`
    : field.value;

  // Determine if this is a clickable link
  const isEmailLink = field.type === 'email' && field.value !== '—';
  const isPhoneLink = field.type === 'tel' && field.value !== '—';

  return (
    <div className="py-3 flex items-center justify-between border-b border-gray-100 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
        {field.label}
      </p>
      <div className="text-right">
        {isEmailLink ? (
          <a
            href={`mailto:${field.value}`}
            className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            {field.value}
          </a>
        ) : isPhoneLink ? (
          <a
            href={`tel:${field.value.replace(/\D/g, '')}`}
            className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            {field.value}
          </a>
        ) : (
          <p className="text-sm text-slate-800 font-medium">
            {displayValue}
          </p>
        )}
        {field.isExpandable && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for form fields (light theme)
 */
function FieldSkeleton() {
  return (
    <div className="py-3 border-b border-gray-100 animate-pulse flex justify-between">
      <div className="h-3 w-20 bg-gray-200 rounded" />
      <div className="h-4 w-24 bg-gray-300 rounded" />
    </div>
  );
}

/**
 * Copy all fields button (light theme)
 */
function CopyAllButton({ fields }: { fields: ParsedFormField[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = fields
      .map((f) => `${f.label}: ${f.value}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
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
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy All
        </>
      )}
    </button>
  );
}

export function FormDataManifest({ lead, isLoading = false }: FormDataManifestProps) {
  const parsedFields = useMemo(() => parseFormFields(lead), [lead]);

  if (isLoading) {
    return (
      <div className="drawer-card">
        <div className="flex items-center justify-between mb-4">
          <p className="label-aviation-muted">FORM DATA</p>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <FieldSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!lead || parsedFields.length === 0) {
    return (
      <div className="drawer-card">
        <p className="label-aviation-muted mb-4">FORM DATA</p>
        <p className="text-sm text-slate-500 text-center py-6">
          No form data available
        </p>
      </div>
    );
  }

  return (
    <div className="drawer-card">
      <div className="flex items-center justify-between mb-4">
        <p className="label-aviation-muted">FORM DATA</p>
        <CopyAllButton fields={parsedFields} />
      </div>

      <div className="divide-y divide-gray-100">
        {parsedFields.map((field) => (
          <FieldRow key={field.rawKey} field={field} />
        ))}
      </div>

      {/* Field count footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-center">
        <p className="text-xs text-slate-500">
          {parsedFields.length} field{parsedFields.length !== 1 ? 's' : ''} submitted
        </p>
      </div>
    </div>
  );
}

/**
 * Notifications Dashboard Page
 * Phase 2a — Notification delivery tracking
 * Phase 2b — Recipients management
 * Phase 2c — Template editing
 *
 * Sub-tabs: Dashboard | Recipients | Templates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import {
  PageHeader,
  FilterDropdown,
  DataTable,
  type Column,
  type TimeRangeValue,
  type SortDirection,
  type DateRange,
} from '../components/shared';
import {
  fetchNotificationEvents,
  fetchNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  updateNotificationTemplate,
  previewTemplate,
  sendTestTemplate,
  fetchNotificationEventDetail,
  fetchTeamMembers,
  fetchAdminTenantEmployees,
} from '../services/analyticsApi';
import type {
  NotificationEvent,
  NotificationSubTab,
  NotificationSettingsResponse,
  FormNotificationSettings,
  TemplatePreviewResponse,
  NotificationEventLifecycle,
  AdminEmployee,
} from '../types/analytics';

// ---------------------------------------------------------------------------
// Mock Data (Demo Mode)
// ---------------------------------------------------------------------------

const DEMO_TENANT_ID = 'MYR384719';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

function shouldUseMock(tenantId?: string): boolean {
  return USE_MOCK && tenantId === DEMO_TENANT_ID;
}

function generateMockEvents(): NotificationEvent[] {
  const recipients = [
    'sarah.johnson@example-nonprofit.org',
    'mike.chen@example-nonprofit.org',
    'director@example-nonprofit.org',
    'volunteer@example-nonprofit.org',
    'info@example-nonprofit.org',
  ];
  const forms = ['volunteer_signup', 'mentor_application', 'contact_form', 'donation_inquiry'];
  const statuses: NotificationEvent['event_type'][] = ['send', 'delivery', 'bounce', 'open', 'click'];
  const events: NotificationEvent[] = [];

  for (let i = 0; i < 50; i++) {
    const minutesAgo = Math.floor(Math.random() * 43200); // up to 30 days in minutes
    const ts = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const eventType = statuses[Math.floor(Math.random() * statuses.length)];
    const msgId = `0100019d${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 14)}`;

    const formId = forms[Math.floor(Math.random() * forms.length)];
    events.push({
      timestamp: ts,
      event_type: eventType,
      channel: 'email',
      recipient: recipients[Math.floor(Math.random() * recipients.length)],
      form_id: formId,
      form_title: formId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: eventType,
      message_id: msgId,
      email_type: Math.random() > 0.5 ? 'internal_notification' : 'applicant_confirmation',
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const MOCK_EVENTS = generateMockEvents();

const MOCK_SETTINGS: NotificationSettingsResponse = {
  forms: {
    volunteer_signup: {
      form_title: 'Volunteer Signup',
      notifications: {
        internal: {
          enabled: true,
          recipients: ['sarah.johnson@example-nonprofit.org', 'director@example-nonprofit.org'],
          subject: 'New Volunteer Signup: {first_name} {last_name}',
          body_template: 'Hi team,\n\nA new volunteer has signed up.\n\n{form_data}\n\nBest,\nMyRecruiter',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: {
          enabled: true,
          subject: 'Welcome, {first_name}! Thanks for signing up',
          body_template: 'Hi {first_name},\n\nThank you for signing up to volunteer with Our Organization! Our team will be in touch soon.\n\nWarm regards,\nOur Organization',
          use_tenant_branding: true,
        },
      },
    },
    mentor_application: {
      form_title: 'Mentor Application',
      notifications: {
        internal: {
          enabled: true,
          recipients: ['mike.chen@example-nonprofit.org'],
          subject: 'New Mentor Application: {first_name} {last_name}',
          body_template: 'Hi team,\n\nA new mentor application has been submitted.\n\n{form_data}\n\nBest,\nMyRecruiter',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: {
          enabled: true,
          subject: 'Thank you for applying, {first_name}!',
          body_template: 'Hi {first_name},\n\nWe received your mentor application. Our team will review and follow up shortly.\n\nWarm regards,\nOur Organization',
          use_tenant_branding: true,
        },
      },
    },
    contact_form: {
      form_title: 'Contact Form',
      notifications: {
        internal: {
          enabled: true,
          recipients: ['info@example-nonprofit.org'],
          subject: 'New Contact Inquiry from {first_name}',
          body_template: 'Hi team,\n\nA new contact inquiry was submitted.\n\n{form_data}\n\nBest,\nMyRecruiter',
          channels: { email: true, sms: false },
        },
        applicant_confirmation: {
          enabled: false,
          subject: '',
          body_template: '',
          use_tenant_branding: true,
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as a human-friendly string.
 * Today → "10:32 AM", Yesterday → "Yesterday 3:15 PM", older → "Apr 8, 2:00 PM"
 */
function friendlyTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso || '—';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (date >= today) return time;
  if (date >= yesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`;
}

/**
 * Group notification events by message_id, returning one row per message
 * with the highest-priority status. Metadata (recipient, form, timestamp)
 * comes from the earliest event (send), status from the most significant.
 *
 * Priority (highest → lowest):
 *   complaint > bounce > reject > click > open > delivery > send
 */
const STATUS_PRIORITY: Record<string, number> = {
  complaint: 7,
  bounce: 6,
  reject: 5,
  click: 4,
  open: 3,
  delivery: 2,
  send: 1,
};

function groupEventsByMessage(events: NotificationEvent[]): NotificationEvent[] {
  const groups = new Map<string, NotificationEvent[]>();

  for (const evt of events) {
    const key = evt.message_id;
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(evt);
    } else {
      groups.set(key, [evt]);
    }
  }

  const grouped: NotificationEvent[] = [];
  for (const [, group] of groups) {
    // Sort by priority descending to find the most significant event
    group.sort((a, b) =>
      (STATUS_PRIORITY[b.event_type] ?? 0) - (STATUS_PRIORITY[a.event_type] ?? 0)
    );
    const highest = group[0];

    // Use the send event for metadata (recipient, form, timestamp) if available
    const sendEvent = group.find(e => e.event_type === 'send');
    const base = sendEvent || group[group.length - 1]; // fallback to earliest

    grouped.push({
      ...base,
      // Override status and event_type with the highest-priority event
      status: highest.event_type,
      event_type: highest.event_type,
      // Merge detail from the highest-priority event (bounce/complaint info)
      detail: highest.detail,
      // Keep send timestamp for "when was this sent"
      timestamp: base.timestamp,
    });
  }

  // Sort by timestamp descending (newest first)
  grouped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return grouped;
}

/** Validate email format */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Colored pill badge for notification event status/type.
 * Accessible: uses sufficient color-contrast pairings from Tailwind palette.
 */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    send: 'bg-blue-100 text-blue-700',
    delivery: 'bg-emerald-100 text-emerald-700',
    bounce: 'bg-red-100 text-red-700',
    complaint: 'bg-orange-100 text-orange-700',
    open: 'bg-purple-100 text-purple-700',
    click: 'bg-indigo-100 text-indigo-700',
    sent: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    suppressed: 'bg-slate-100 text-slate-600',
  };

  const labels: Record<string, string> = {
    send: 'Sent',
    delivery: 'Delivered',
    bounce: 'Bounced',
    complaint: 'Complaint',
    open: 'Opened',
    click: 'Clicked',
    sent: 'Sent',
    failed: 'Failed',
    suppressed: 'Suppressed',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab button
// ---------------------------------------------------------------------------

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-semibold transition-all duration-200
        border-b-2 -mb-px
        ${
          active
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
        }
      `}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline feedback message (success / error)
// ---------------------------------------------------------------------------

function InlineMessage({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}) {
  const styles =
    type === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-red-50 border-red-200 text-red-800';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm font-medium mb-4 ${styles}`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton — generic card skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-pulse" aria-hidden="true">
      <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-slate-100 rounded" />
        <div className="h-3 w-3/4 bg-slate-100 rounded" />
        <div className="h-3 w-1/2 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewModal — renders template HTML preview
// ---------------------------------------------------------------------------

function PreviewModal({
  preview,
  onClose,
}: {
  preview: TemplatePreviewResponse;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus to dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Template Preview</p>
            <h2 id="preview-modal-title" className="text-base font-semibold text-slate-800 truncate">
              {preview.subject}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body — sandboxed iframe for HTML preview */}
        <div className="flex-1 overflow-auto p-6">
          <iframe
            title="Template preview"
            srcDoc={preview.body_html}
            sandbox="allow-same-origin"
            className="w-full min-h-[300px] border border-slate-200 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column definitions for the event log DataTable
// ---------------------------------------------------------------------------

const eventColumns: Column<NotificationEvent>[] = [
  {
    key: 'recipient',
    header: 'Recipient',
    sortable: true,
    sortKey: 'recipient',
    render: (row) => (
      <span className="block text-left text-sm text-slate-700 truncate max-w-[180px]">
        {row.recipient}
      </span>
    ),
  },
  {
    key: 'form_title',
    header: 'Form',
    sortable: true,
    sortKey: 'form_title',
    render: (row) => (
      <span className="block text-left text-sm text-slate-600 truncate max-w-[160px]">
        {row.form_title || '—'}
      </span>
    ),
  },
  {
    key: 'email_type',
    header: 'Type',
    sortable: true,
    sortKey: 'email_type',
    render: (row) => {
      const label = row.email_type === 'internal_notification' ? 'Internal'
        : row.email_type === 'applicant_confirmation' ? 'Inquiry'
        : 'Internal';
      const color = row.email_type === 'applicant_confirmation' ? 'text-purple-600' : 'text-blue-600';
      return (
        <span className={`block text-left text-xs font-medium ${color}`}>
          {label}
        </span>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortKey: 'status',
    render: (row) => <StatusBadge status={row.status || row.event_type} />,
  },
  {
    key: 'detail',
    header: 'Detail',
    sortable: true,
    sortKey: 'event_type',
    render: (row) => {
      const d = (row.detail || {}) as Record<string, string>;
      if (d.bounce_type) {
        const label = `${d.bounce_type}${d.bounce_subtype ? ` — ${d.bounce_subtype}` : ''}`;
        const tip = d.bounce_type === 'Permanent'
          ? 'This address does not exist or permanently rejected the message. It has been hard-bounced and should be removed.'
          : d.bounce_type === 'Transient'
            ? 'Delivery failed temporarily (e.g. mailbox full). The system will retry automatically.'
            : 'The message could not be delivered. Check the recipient address.';
        return (
          <span className="block text-left text-xs text-red-600" title={tip}>
            {label}
          </span>
        );
      }
      if (d.complaint_type) {
        const label = `${d.complaint_type}${d.complaint_sub_type ? ` — ${d.complaint_sub_type}` : ''}`;
        const tip = d.complaint_type === 'abuse'
          ? 'The recipient marked this email as spam. Consider removing them from future notifications.'
          : `The recipient filed a "${d.complaint_type}" complaint. Review whether they should continue receiving emails.`;
        return (
          <span className="block text-left text-xs text-amber-600" title={tip}>
            {label}
          </span>
        );
      }
      // Status-appropriate default
      const et = row.event_type || row.status;
      const defaults: Record<string, string> = {
        send: 'Pending delivery',
        delivery: 'Delivered successfully',
        open: 'Opened by recipient',
        click: 'Link clicked',
        reject: 'Rejected by SES',
      };
      return (
        <span className="block text-left text-xs text-slate-400">
          {defaults[et] || et}
        </span>
      );
    },
  },
  {
    key: 'channel',
    header: 'Channel',
    sortable: true,
    sortKey: 'channel',
    render: (row) => (
      <span className="block text-left text-xs uppercase tracking-wider text-slate-500">
        {row.channel}
        {row.channel === 'sms' && row.segment_count != null && row.segment_count > 0 && (
          <span className="ml-1 normal-case text-slate-400">
            ({row.segment_count} seg{row.segment_count !== 1 ? 's' : ''})
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'timestamp',
    header: 'Time',
    render: (row) => (
      <span
        className="block text-left text-sm text-slate-500"
        title={row.timestamp}
      >
        {friendlyTime(row.timestamp)}
      </span>
    ),
    sortable: true,
    sortKey: 'timestamp',
  },
];

// ---------------------------------------------------------------------------
// NotificationDashboardTab — the primary "Dashboard" sub-tab content
// ---------------------------------------------------------------------------

const CHANNEL_OPTIONS = [
  { id: 'email', name: 'Email' },
  { id: 'sms', name: 'SMS' },
];

const AUDIENCE_OPTIONS = [
  { id: 'internal_notification', name: 'Internal' },
  { id: 'applicant_confirmation', name: 'Form Inquiry' },
];

const STATUS_OPTIONS = [
  { id: 'sent', name: 'Sent' },
  { id: 'delivery', name: 'Delivered' },
  { id: 'bounce', name: 'Bounced' },
  { id: 'open', name: 'Opened' },
  { id: 'click', name: 'Clicked' },
  { id: 'suppressed', name: 'Suppressed' },
];

// ---------------------------------------------------------------------------
// EventDetailModal — shows full lifecycle for a single message
// ---------------------------------------------------------------------------

function EventDetailModal({
  messageId,
  onClose,
}: {
  messageId: string | null;
  onClose: () => void;
}) {
  const [lifecycle, setLifecycle] = useState<NotificationEventLifecycle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!messageId) {
      setLifecycle(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetchNotificationEventDetail(messageId)
      .then(setLifecycle)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load event detail'))
      .finally(() => setIsLoading(false));
  }, [messageId]);

  // Close on Escape
  useEffect(() => {
    if (!messageId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [messageId, onClose]);

  if (!messageId) return null;

  const eventTypeColors: Record<string, string> = {
    send: 'bg-blue-100 text-blue-700',
    delivery: 'bg-green-100 text-green-700',
    bounce: 'bg-red-100 text-red-700',
    complaint: 'bg-amber-100 text-amber-700',
    open: 'bg-purple-100 text-purple-700',
    click: 'bg-indigo-100 text-indigo-700',
  };

  const eventTypeLabels: Record<string, string> = {
    send: 'Sent',
    delivery: 'Delivered',
    bounce: 'Bounced',
    complaint: 'Complaint',
    open: 'Opened',
    click: 'Clicked',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Message Lifecycle</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {isLoading && (
            <p className="text-sm text-slate-500 text-center py-8">Loading...</p>
          )}
          {error && (
            <p className="text-sm text-red-600 text-center py-8">{error}</p>
          )}
          {lifecycle && lifecycle.events.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No events found for this message.</p>
          )}
          {lifecycle && lifecycle.events.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 font-mono truncate flex-1" title={lifecycle.message_id}>
                  ID: {lifecycle.message_id}
                </p>
                {(lifecycle as unknown as Record<string, unknown>).segment_count != null && (
                  <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 ml-2 whitespace-nowrap">
                    {String((lifecycle as unknown as Record<string, unknown>).segment_count)} segment{Number((lifecycle as unknown as Record<string, unknown>).segment_count) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {lifecycle.events.map((evt: NotificationEventLifecycle['events'][number], i: number) => {
                const detail = (evt.detail || {}) as Record<string, string>;
                const colorClass = eventTypeColors[evt.event_type] || 'bg-slate-100 text-slate-700';
                return (
                  <div key={i} className="flex items-start gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        evt.event_type === 'delivery' ? 'bg-green-500' :
                        evt.event_type === 'bounce' ? 'bg-red-500' :
                        evt.event_type === 'complaint' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      {i < lifecycle.events.length - 1 && (
                        <div className="w-px h-6 bg-slate-200 mt-1" />
                      )}
                    </div>
                    {/* Event detail */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
                          {eventTypeLabels[evt.event_type] ?? evt.event_type}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(evt.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      </div>
                      {/* Bounce/complaint detail */}
                      {detail.bounce_type && (
                        <p className="text-xs text-red-600 mt-1">
                          {String(detail.bounce_type)}{detail.bounce_subtype ? ` — ${String(detail.bounce_subtype)}` : ''}
                        </p>
                      )}
                      {detail.complaint_type && (
                        <p className="text-xs text-amber-600 mt-1">{String(detail.complaint_type)}</p>
                      )}
                      {/* Open/click detail */}
                      {detail.user_agent && (
                        <p className="text-xs text-slate-400 mt-1 truncate" title={String(detail.user_agent)}>
                          {String(detail.user_agent)}
                        </p>
                      )}
                      {detail.link && (
                        <p className="text-xs text-indigo-600 mt-1 truncate" title={String(detail.link)}>
                          {String(detail.link)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NotificationDashboardTab() {
  const { user } = useAuth();

  // PageHeader state
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Event log state (grouped by message_id)
  const [allGroupedEvents, setAllGroupedEvents] = useState<NotificationEvent[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Event detail modal state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Filter state
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Derived: search filter + paginate the grouped events client-side
  const searchLower = searchInput.trim().toLowerCase();
  const filteredEvents = searchLower
    ? allGroupedEvents.filter(e =>
        e.recipient.toLowerCase().includes(searchLower) ||
        (e.form_title || '').toLowerCase().includes(searchLower)
      )
    : allGroupedEvents;
  const totalEvents = filteredEvents.length;
  const events = filteredEvents.slice((page - 1) * pageSize, page * pageSize);

  // Loading / error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Build date range options for custom range
    const dateRangeOptions = timeRange === 'custom' && dateRange ? {
      startDate: dateRange.startDate.toISOString().split('T')[0],
      endDate: dateRange.endDate.toISOString().split('T')[0],
    } : undefined;

    try {
      if (shouldUseMock(user?.tenant_id)) {
        // Mock data for demo tenant
        let filtered = [...MOCK_EVENTS];
        if (channelFilter) filtered = filtered.filter(e => e.channel === channelFilter);
        if (statusFilter) filtered = filtered.filter(e => e.event_type === statusFilter);
        const grouped = groupEventsByMessage(filtered);
        // Apply status filter on grouped results (filter by rolled-up status)
        const finalGrouped = statusFilter
          ? grouped.filter(e => e.event_type === statusFilter)
          : grouped;
        setAllGroupedEvents(finalGrouped);
      } else {
        // Fetch all events (paginate through API's 100-item max) so we can
        // group by message_id client-side before displaying.
        const firstPage = await fetchNotificationEvents({
          range: timeRange,
          page: 1,
          limit: 100,
          channel: channelFilter || undefined,
          email_type: audienceFilter || undefined,
          startDate: dateRangeOptions?.startDate,
          endDate: dateRangeOptions?.endDate,
        });

        let allRawEvents = [...firstPage.events];

        // Fetch remaining pages if needed
        if (firstPage.has_more) {
          let apiPage = 2;
          let hasMore = true;
          while (hasMore) {
            const nextPage = await fetchNotificationEvents({
              range: timeRange,
              page: apiPage,
              limit: 100,
              channel: channelFilter || undefined,
              email_type: audienceFilter || undefined,
              startDate: dateRangeOptions?.startDate,
              endDate: dateRangeOptions?.endDate,
            });
            allRawEvents = [...allRawEvents, ...nextPage.events];
            hasMore = nextPage.has_more;
            apiPage++;
          }
        }

        const grouped = groupEventsByMessage(allRawEvents);
        // Apply status filter on grouped results (filter by rolled-up status)
        const finalGrouped = statusFilter
          ? grouped.filter(e => e.event_type === statusFilter)
          : grouped;
        setAllGroupedEvents(finalGrouped);
      }
    } catch (err) {
      console.error('Notifications data load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notification data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, dateRange, channelFilter, statusFilter, audienceFilter, user?.tenant_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when filters or range change
  useEffect(() => {
    setPage(1);
  }, [timeRange, channelFilter, statusFilter, audienceFilter]);

  // Suppress unused user warning — matches Dashboard.tsx pattern (user kept for future tenant context)
  void user;

  // ----- Render -----

  const handleTimeRangeChange = (range: TimeRangeValue) => {
    setTimeRange(range);
    if (range !== 'custom') {
      setDateRange(null);
    }
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setTimeRange('custom');
  };

  if (error) {
    // Friendly empty state for tenants without notifications enabled
    if (error.toLowerCase().includes('feature not available') || error.toLowerCase().includes('not available')) {
      return (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Notifications Coming Soon</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Notifications are enabled automatically when conversational forms are configured for this tenant. Once forms are active, you'll be able to manage delivery settings, recipients, and templates here.
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page header with time range selector */}
      <PageHeader
        title="Notifications"
        sectionLabel="Delivery Analytics"
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        showExport={false}
        showDatePicker={true}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      {/* ---- Stat cards (derived from grouped messages) ---- */}
      {isLoading ? (
        /* Skeleton row */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8" aria-busy="true" aria-label="Loading metrics">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-hero animate-pulse">
              <div className="h-12 w-20 bg-slate-200 rounded mb-4" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (() => {
        const total = allGroupedEvents.length;
        const delivered = allGroupedEvents.filter(e => e.event_type === 'delivery' || e.event_type === 'open' || e.event_type === 'click').length;
        const bounced = allGroupedEvents.filter(e => e.event_type === 'bounce').length;
        const opened = allGroupedEvents.filter(e => e.event_type === 'open' || e.event_type === 'click').length;
        const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0';
        const bounceRate = total > 0 ? ((bounced / total) * 100).toFixed(1) : '0.0';
        const openRate = total > 0 ? ((opened / total) * 100).toFixed(1) : '0.0';

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              tier="hero"
              title="SENT"
              value={total.toLocaleString()}
              subtitle="Total messages"
            />
            <StatCard
              tier="hero"
              title="DELIVERED"
              value={delivered.toLocaleString()}
              subtitle={`${deliveryRate}% delivery rate`}
            />
            <StatCard
              tier="hero"
              title="BOUNCED"
              value={bounced.toLocaleString()}
              subtitle={`${bounceRate}% bounce rate`}
            />
            <StatCard
              tier="hero"
              title="OPENED"
              value={opened.toLocaleString()}
              subtitle={`${openRate}% open rate`}
            />
          </div>
        );
      })()}

      {/* ---- Event log ---- */}
      <section aria-labelledby="notification-events-heading">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2
            id="notification-events-heading"
            className="text-lg font-semibold text-slate-800"
          >
            Event Log
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={channelFilter}
              onChange={(v) => setChannelFilter(v)}
              options={CHANNEL_OPTIONS}
              placeholder="All Channels"
            />
            <FilterDropdown
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
            />
            <FilterDropdown
              value={audienceFilter}
              onChange={(v) => setAudienceFilter(v)}
              options={AUDIENCE_OPTIONS}
              placeholder="All Types"
            />
          </div>
        </div>

        {isLoading ? (
          /* Table skeleton */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-busy="true">
            <div className="animate-pulse p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        ) : allGroupedEvents.length === 0 ? (
          /* Empty state — only when no data exists at all */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">No notification data yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">
              Submit a form to see delivery tracking here.
            </p>
          </div>
        ) : (
          <DataTable
            title="Notification Events"
            rowKey="message_id"
            columns={eventColumns}
            data={
              sortColumn && sortDirection
                ? [...events].sort((a, b) => {
                    const aVal = String((a as unknown as Record<string, unknown>)[sortColumn] ?? '');
                    const bVal = String((b as unknown as Record<string, unknown>)[sortColumn] ?? '');
                    const cmp = aVal.localeCompare(bVal);
                    return sortDirection === 'asc' ? cmp : -cmp;
                  })
                : events
            }
            totalCount={totalEvents}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onRowClick={(row) => setSelectedMessageId(row.message_id)}
            onSearch={(q) => {
              setSearchInput(q);
              setPage(1);
            }}
            searchValue={searchInput}
            emptyMessage="No messages match your search"
            showFilter={false}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir); }}
          />
        )}
      </section>

      {/* Event detail modal */}
      <EventDetailModal
        messageId={selectedMessageId}
        onClose={() => setSelectedMessageId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecipientsTab — Phase 2b
// ---------------------------------------------------------------------------

/** Deep-clone a FormNotificationSettings object to decouple edits from source */
function cloneSettings(s: FormNotificationSettings): FormNotificationSettings {
  return JSON.parse(JSON.stringify(s));
}

function formatPhoneDisplay(e164: string): string {
  // Convert +15125551234 → (512) 555-1234
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}

function RecipientsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [settings, setSettings] = useState<NotificationSettingsResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, FormNotificationSettings>>({});
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingForms, setSavingForms] = useState<Set<string>>(new Set());
  const [testingForms, setTestingForms] = useState<Set<string>>(new Set());
  const [smsProvisioned, setSmsProvisioned] = useState(false);
  // Registry employees for checklist UI (null = legacy fallback mode)
  // Uses AdminEmployee[] to include local_only contacts without Clerk accounts
  const [teamMembers, setTeamMembers] = useState<AdminEmployee[] | null>(null);
  // Legacy text input state (only used in fallback mode)
  const [newEmailInput, setNewEmailInput] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [newPhoneInput, setNewPhoneInput] = useState<Record<string, string>>({});
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tenantId = user?.tenant_id;
      const [settingsResult, employeesResult] = await Promise.allSettled([
        shouldUseMock(tenantId) ? Promise.resolve(MOCK_SETTINGS) : fetchNotificationSettings(),
        tenantId ? fetchAdminTenantEmployees(tenantId) : Promise.reject(new Error('No tenant ID')),
      ]);

      if (settingsResult.status === 'rejected') {
        throw settingsResult.reason;
      }
      const data = settingsResult.value;
      setSettings(data);
      setSmsProvisioned(data.sms_provisioned === true);
      const initialDraft: Record<string, FormNotificationSettings> = {};
      for (const [id, s] of Object.entries(data.forms)) {
        initialDraft[id] = cloneSettings(s);
      }
      setDraft(initialDraft);

      // Registry employees: null signals legacy fallback
      // fetchAdminTenantEmployees returns AdminEmployee[] directly (not wrapped)
      if (employeesResult.status === 'fulfilled' && employeesResult.value.length > 0) {
        setTeamMembers(employeesResult.value);
      } else {
        // Fall back to Clerk team members if registry is unavailable
        try {
          const legacyTeam = await fetchTeamMembers();
          if (legacyTeam.members.length > 0) {
            // Convert TeamMember to AdminEmployee shape for unified rendering
            const converted: AdminEmployee[] = legacyTeam.members.map(m => ({
              tenantId: tenantId || '',
              employeeId: m.employee_id || m.user_id || m.email,
              clerkUserId: m.user_id || undefined,
              email: m.email,
              name: m.name,
              role: m.role,
              type: 'clerk_user' as const,
              status: m.status,
              createdAt: m.joined_at,
              updatedAt: m.joined_at,
              phone: m.phone || undefined,
              notificationPrefs: { email: true, sms: m.sms_opted_in ?? false },
            }));
            setTeamMembers(converted);
          } else {
            setTeamMembers(null);
          }
        } catch {
          setTeamMembers(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenant_id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const markDirty = (formId: string) => {
    setDirtyForms((prev) => new Set(prev).add(formId));
  };

  // --- Internal enabled toggle ---
  const toggleInternalEnabled = (formId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.enabled = !next[formId].notifications.internal.enabled;
      return next;
    });
    markDirty(formId);
  };

  // --- Applicant confirmation enabled toggle ---
  const toggleApplicantEnabled = (formId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.applicant_confirmation.enabled =
        !next[formId].notifications.applicant_confirmation.enabled;
      return next;
    });
    markDirty(formId);
  };

  // --- Applicant branding toggle ---
  const toggleApplicantBranding = (formId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.applicant_confirmation.use_tenant_branding =
        !next[formId].notifications.applicant_confirmation.use_tenant_branding;
      return next;
    });
    markDirty(formId);
  };

  // --- Channel checkbox ---
  const toggleChannel = (formId: string, channel: 'email' | 'sms') => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.channels[channel] =
        !next[formId].notifications.internal.channels[channel];
      return next;
    });
    markDirty(formId);
  };

  // --- Toggle recipient employee (registry checklist mode) ---
  // Writes to recipient_employee_ids (UUID); leaves recipient_user_ids untouched for backward compat
  const toggleRecipientUser = (formId: string, employeeId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      const current = next[formId].notifications.internal.recipient_employee_ids || [];
      next[formId].notifications.internal.recipient_employee_ids = current.includes(employeeId)
        ? current.filter(id => id !== employeeId)
        : [...current, employeeId];
      return next;
    });
    markDirty(formId);
  };

  // --- Remove stale employee_id ---
  const removeStaleUserId = (formId: string, employeeId: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.recipient_employee_ids =
        (next[formId].notifications.internal.recipient_employee_ids || []).filter(id => id !== employeeId);
      return next;
    });
    markDirty(formId);
  };

  // --- Legacy: Add recipient ---
  const addRecipient = (formId: string) => {
    const email = (newEmailInput[formId] ?? '').trim();
    if (!isValidEmail(email)) {
      setEmailErrors((prev) => ({ ...prev, [formId]: 'Enter a valid email address' }));
      return;
    }
    if (draft[formId].notifications.internal.recipients.includes(email)) {
      setEmailErrors((prev) => ({ ...prev, [formId]: 'This email is already in the list' }));
      return;
    }
    setEmailErrors((prev) => ({ ...prev, [formId]: '' }));
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.recipients.push(email);
      return next;
    });
    setNewEmailInput((prev) => ({ ...prev, [formId]: '' }));
    markDirty(formId);
  };

  // --- Legacy: Remove recipient ---
  const removeRecipient = (formId: string, email: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.recipients =
        next[formId].notifications.internal.recipients.filter((r) => r !== email);
      return next;
    });
    markDirty(formId);
  };

  // --- Legacy: Add SMS recipient ---
  const addSmsRecipient = (formId: string) => {
    const raw = (newPhoneInput[formId] ?? '').trim();
    const digits = raw.replace(/[\s\-().]/g, '');
    const phone = digits.startsWith('+') ? digits : digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
    if (!/^\+1\d{10}$/.test(phone)) {
      setPhoneErrors((prev) => ({ ...prev, [formId]: 'Enter a valid US phone number (e.g. 512-555-1234)' }));
      return;
    }
    const smsRecipients = draft[formId].notifications.internal.sms_recipients || [];
    if (smsRecipients.includes(phone)) {
      setPhoneErrors((prev) => ({ ...prev, [formId]: 'This number is already in the list' }));
      return;
    }
    setPhoneErrors((prev) => ({ ...prev, [formId]: '' }));
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      if (!next[formId].notifications.internal.sms_recipients) {
        next[formId].notifications.internal.sms_recipients = [];
      }
      next[formId].notifications.internal.sms_recipients!.push(phone);
      return next;
    });
    setNewPhoneInput((prev) => ({ ...prev, [formId]: '' }));
    markDirty(formId);
  };

  // --- Legacy: Remove SMS recipient ---
  const removeSmsRecipient = (formId: string, phone: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      next[formId] = cloneSettings(next[formId]);
      next[formId].notifications.internal.sms_recipients =
        (next[formId].notifications.internal.sms_recipients || []).filter((p) => p !== phone);
      return next;
    });
    markDirty(formId);
  };

  // --- Save ---
  const handleSave = async (formId: string) => {
    const formDraft = draft[formId];
    const internal = formDraft.notifications.internal;
    const hasEmployeeIds = teamMembers && (internal.recipient_employee_ids || []).length > 0;
    const hasLegacy = internal.recipients.length > 0;
    if (internal.enabled && !hasEmployeeIds && !hasLegacy) {
      setFeedback({ type: 'error', message: 'Select at least one recipient before saving. Internal notifications are enabled but no recipients are configured.' });
      return;
    }
    setSavingForms((prev) => new Set(prev).add(formId));
    setFeedback(null);
    try {
      await updateNotificationSettings(formId, draft[formId].notifications as Record<string, unknown>);
      setDirtyForms((prev) => {
        const next = new Set(prev);
        next.delete(formId);
        return next;
      });
      setFeedback({ type: 'success', message: 'Settings saved successfully.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Save failed. Please try again.',
      });
    } finally {
      setSavingForms((prev) => {
        const next = new Set(prev);
        next.delete(formId);
        return next;
      });
    }
  };

  // --- Send test email ---
  const handleTestSend = async (formId: string) => {
    const internal = draft[formId].notifications.internal;
    const employeeIds = internal.recipient_employee_ids || [];
    const legacyRecipients = internal.recipients;

    // Prefer employee_id if available (registry checklist mode)
    const hasEmployeeIds = teamMembers && employeeIds.length > 0;
    if (!hasEmployeeIds && legacyRecipients.length === 0) {
      setFeedback({ type: 'error', message: 'Add at least one recipient before sending a test.' });
      return;
    }

    setTestingForms((prev) => new Set(prev).add(formId));
    setFeedback(null);
    try {
      if (hasEmployeeIds) {
        const firstEmployeeId = employeeIds[0];
        const emp = teamMembers?.find(e => e.employeeId === firstEmployeeId);
        await sendTestNotification(emp?.email || '', formId, emp?.clerkUserId);
        setFeedback({ type: 'success', message: `Test email sent to ${emp?.name || firstEmployeeId}.` });
      } else {
        await sendTestNotification(legacyRecipients[0], formId);
        setFeedback({ type: 'success', message: `Test email sent to ${legacyRecipients[0]}.` });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Test send failed. Please try again.',
      });
    } finally {
      setTestingForms((prev) => {
        const next = new Set(prev);
        next.delete(formId);
        return next;
      });
    }
  };

  // ----- Render helpers -----

  const renderMemberChecklist = (formId: string, internal: FormNotificationSettings['notifications']['internal']) => {
    // Primary: registry employee UUIDs. Backward compat: also check legacy Clerk user IDs if no employee IDs set yet.
    const selectedIds = internal.recipient_employee_ids || [];
    const employeeIds = new Set(teamMembers!.map(e => e.employeeId));
    const staleIds = selectedIds.filter(id => !employeeIds.has(id));

    return (
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Team Members</p>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {teamMembers!.map((emp) => {
            const isSelected = selectedIds.includes(emp.employeeId);
            const isLocalOnly = emp.type === 'local_only';
            // Generate initials avatar for local_only contacts (no Clerk profile image)
            const initials = emp.name
              .split(' ')
              .map(w => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const smsOptedIn = emp.notificationPrefs?.sms === true;
            return (
              <label
                key={emp.employeeId}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isAdmin ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRecipientUser(formId, emp.employeeId)}
                  disabled={!isAdmin}
                  className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500 shrink-0"
                  aria-label={`Select ${emp.name} as recipient`}
                />
                {/* Avatar: initials for local_only, no image shown (AdminEmployee has no imageUrl) */}
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold select-none"
                  aria-hidden="true"
                  style={{
                    background: isLocalOnly ? '#e2e8f0' : '#d1fae5',
                    color: isLocalOnly ? '#64748b' : '#065f46',
                  }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                    {isLocalOnly && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                        Contact
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">
                    {emp.phone ? formatPhoneDisplay(emp.phone) : '\u2014'}
                  </p>
                  {smsOptedIn ? (
                    <span className="text-[10px] text-emerald-600 font-medium">SMS opted in</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Email only</span>
                  )}
                </div>
              </label>
            );
          })}

          {/* Stale employee_ids — in config but not in current registry */}
          {staleIds.map((employeeId) => (
            <div key={employeeId} className="flex items-center gap-3 px-4 py-3 bg-amber-50">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-800 font-medium">Former team member</p>
                <p className="text-xs text-amber-600 truncate font-mono">{employeeId}</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => removeStaleUserId(formId, employeeId)}
                  className="text-xs text-amber-700 hover:text-red-600 font-medium transition-colors"
                  aria-label={`Remove stale recipient ${employeeId}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedIds.length === 0 && (
          <p className="text-xs text-slate-400 mt-2 italic">No recipients selected. Check the boxes above to add recipients.</p>
        )}
      </div>
    );
  };

  const renderLegacyRecipients = (formId: string, internal: FormNotificationSettings['notifications']['internal']) => {
    const inputEmail = newEmailInput[formId] ?? '';
    const emailError = emailErrors[formId] ?? '';

    return (
      <>
        {/* Email recipients */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Recipients</p>
          {internal.recipients.length === 0 ? (
            <p className="text-sm text-slate-400 italic mb-2">No recipients yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3" role="list" aria-label="Recipient email addresses">
              {internal.recipients.map((email) => (
                <span key={email} role="listitem" className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {email}
                  {isAdmin && <button type="button" onClick={() => removeRecipient(formId, email)} aria-label={`Remove ${email}`} className="ml-0.5 text-primary-500 hover:text-primary-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>}
                </span>
              ))}
            </div>
          )}
          {isAdmin && (
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input type="email" value={inputEmail} onChange={(e) => { setNewEmailInput((prev) => ({ ...prev, [formId]: e.target.value })); if (emailError) setEmailErrors((prev) => ({ ...prev, [formId]: '' })); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(formId); } }} placeholder="email@example.com" aria-label="New recipient email" aria-describedby={emailError ? `email-error-${formId}` : undefined} aria-invalid={!!emailError} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow ${emailError ? 'border-red-400' : 'border-slate-200'}`} />
                {emailError && <p id={`email-error-${formId}`} role="alert" className="text-xs text-red-600 mt-1">{emailError}</p>}
              </div>
              <button type="button" onClick={() => addRecipient(formId)} className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">+ Add</button>
            </div>
          )}
        </div>

        {/* SMS recipients (legacy) */}
        {internal.channels.sms && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">SMS Recipients</p>
            {(internal.sms_recipients || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {(internal.sms_recipients || []).map((phone) => (
                  <span key={phone} className="inline-flex items-center gap-1.5 px-3 py-1 text-sm text-slate-700 bg-slate-100 rounded-full">
                    {formatPhoneDisplay(phone)}
                    {isAdmin && <button type="button" onClick={() => removeSmsRecipient(formId, phone)} className="text-slate-400 hover:text-red-500 transition-colors" aria-label={`Remove ${phone}`}>&times;</button>}
                  </span>
                ))}
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <input type="tel" placeholder="512-555-1234" value={newPhoneInput[formId] ?? ''} onChange={(e) => setNewPhoneInput((prev) => ({ ...prev, [formId]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSmsRecipient(formId); } }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  {phoneErrors[formId] && <p className="text-xs text-red-500 mt-1">{phoneErrors[formId]}</p>}
                </div>
                <button type="button" onClick={() => addSmsRecipient(formId)} className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors">+ Add</button>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // ----- Render -----

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading recipient settings">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 font-medium mb-3">{error}</p>
        <button
          type="button"
          onClick={loadSettings}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!settings || Object.keys(draft).length === 0) {
    return (
      <div className="text-center py-16 text-slate-500 text-sm">
        No notification settings found.
      </div>
    );
  }

  const formEntries = Object.entries(draft);
  const anyDirty = dirtyForms.size > 0;
  const useChecklist = teamMembers !== null;

  return (
    <section aria-labelledby="recipients-heading">
      <h2 id="recipients-heading" className="sr-only">
        Notification Recipients
      </h2>

      {feedback && (
        <InlineMessage
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="space-y-6">
        {formEntries.map(([formId, formSettings]) => {
          const internal = formSettings.notifications.internal;
          const applicant = formSettings.notifications.applicant_confirmation;
          const isDirty = dirtyForms.has(formId);
          const isSaving = savingForms.has(formId);
          const isTesting = testingForms.has(formId);
          const hasRecipients = useChecklist
            ? (internal.recipient_employee_ids || []).length > 0
            : internal.recipients.length > 0;

          return (
            <div
              key={formId}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Form
                  </p>
                  <h3 className="text-base font-semibold text-slate-800">
                    {formSettings.form_title || formId}
                  </h3>
                </div>
                {isDirty && (
                  <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                    Unsaved changes
                  </span>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Internal Notifications section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Internal Notifications
                    </p>
                    <label className="relative inline-flex items-center cursor-pointer" htmlFor={`internal-toggle-${formId}`}>
                      <span className="sr-only">Enable internal notifications</span>
                      <input
                        type="checkbox"
                        id={`internal-toggle-${formId}`}
                        className="sr-only peer"
                        checked={internal.enabled}
                        onChange={() => toggleInternalEnabled(formId)}
                        disabled={!isAdmin}
                      />
                      <div
                        className={`w-10 h-5 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-1 ${
                          internal.enabled ? 'bg-primary-500' : 'bg-slate-200'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                            internal.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  {internal.enabled && (
                    <div className="space-y-4">
                      {/* Recipients: member checklist or legacy text inputs */}
                      {useChecklist
                        ? renderMemberChecklist(formId, internal)
                        : renderLegacyRecipients(formId, internal)
                      }

                      {/* Legacy recipients shown read-only in checklist mode (mixed-mode) */}
                      {useChecklist && internal.recipients.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs font-medium text-slate-500 mb-1.5">Legacy email recipients (direct)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {internal.recipients.map(email => (
                              <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-xs">
                                {email}
                                {isAdmin && (
                                  <button type="button" onClick={() => removeRecipient(formId, email)} className="text-slate-400 hover:text-red-500" aria-label={`Remove ${email}`}>&times;</button>
                                )}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">These will be sent alongside team member notifications.</p>
                        </div>
                      )}

                      {/* Channels */}
                      <fieldset>
                        <legend className="text-xs font-medium text-slate-600 mb-2">Channels</legend>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                            <input type="checkbox" checked={internal.channels.email} onChange={() => toggleChannel(formId, 'email')} disabled={!isAdmin} className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500" />
                            Email
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                            <input type="checkbox" checked={smsProvisioned && internal.channels.sms} onChange={() => toggleChannel(formId, 'sms')} disabled={!isAdmin || !smsProvisioned} className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500 disabled:opacity-40" />
                            SMS {!smsProvisioned && <span className="text-xs text-slate-400 ml-1">(Contact us to enable)</span>}
                          </label>
                        </div>
                      </fieldset>

                      {/* Test email (admin only) */}
                      {isAdmin && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleTestSend(formId)}
                            disabled={isTesting || !hasRecipients}
                            className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isTesting ? 'Sending...' : 'Send Test Email'}
                          </button>
                          {!hasRecipients && (
                            <p className="text-xs text-slate-400 mt-1">
                              {useChecklist ? 'Select a team member first.' : 'Add a recipient first.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <hr className="border-slate-100" />

                {/* Applicant Confirmation section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Applicant Confirmation
                    </p>
                    <label className="relative inline-flex items-center cursor-pointer" htmlFor={`applicant-toggle-${formId}`}>
                      <span className="sr-only">Enable applicant confirmation</span>
                      <input
                        type="checkbox"
                        id={`applicant-toggle-${formId}`}
                        className="sr-only peer"
                        checked={applicant.enabled}
                        onChange={() => toggleApplicantEnabled(formId)}
                        disabled={!isAdmin}
                      />
                      <div
                        className={`w-10 h-5 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-1 ${
                          applicant.enabled ? 'bg-primary-500' : 'bg-slate-200'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                            applicant.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  {applicant.enabled && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={applicant.use_tenant_branding}
                          onChange={() => toggleApplicantBranding(formId)}
                          disabled={!isAdmin}
                          className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                        />
                        Use tenant branding
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={smsProvisioned && (applicant.sms?.enabled ?? false)}
                          onChange={() => {
                            setDraft((prev) => {
                              const next = { ...prev };
                              next[formId] = cloneSettings(next[formId]);
                              const ac = next[formId].notifications.applicant_confirmation;
                              ac.sms = {
                                enabled: !(ac.sms?.enabled ?? false),
                                template: ac.sms?.template ?? '',
                              };
                              return next;
                            });
                            markDirty(formId);
                          }}
                          disabled={!isAdmin || !smsProvisioned}
                          className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500 disabled:opacity-40"
                        />
                        Send SMS confirmation {!smsProvisioned && <span className="text-xs text-slate-400 ml-1">(Contact us to enable)</span>}
                      </label>
                    </div>
                  )}
                </div>

                {/* Save row (admin only) */}
                {isAdmin && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {internal.enabled && !hasRecipients && isDirty && (
                      <p className="text-xs text-red-600">Select at least one recipient.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(formId)}
                      disabled={!isDirty || isSaving || (internal.enabled && !hasRecipients)}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {anyDirty && (
        <p className="text-xs text-amber-600 text-right mt-3">
          Save each form individually to apply changes.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// TemplatesTab — Phase 2c
// ---------------------------------------------------------------------------

const TEMPLATE_VARIABLES = [
  '{first_name}',
  '{last_name}',
  '{email}',
  '{phone}',
  '{organization_name}',
  '{form_title}',
  '{form_data}',
];

function TemplatesTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [templates, setTemplates] = useState<NotificationSettingsResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, FormNotificationSettings>>({});
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [previewData, setPreviewData] = useState<TemplatePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [smsProvisioned, setSmsProvisioned] = useState(false);

  // Track last-focused template field for variable chip insertion
  const lastFocusedRef = useRef<{ section: 'internal' | 'applicant_confirmation'; field: 'subject' | 'body_template'; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const insertVariable = (variable: string) => {
    const target = lastFocusedRef.current;
    if (!target || !target.el) return;
    const { section, field, el } = target;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end);
    updateField(section, field, newValue);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = shouldUseMock(user?.tenant_id) ? MOCK_SETTINGS : await fetchNotificationSettings();
      setTemplates(data);
      setSmsProvisioned(data.sms_provisioned === true);
      const initialDraft: Record<string, FormNotificationSettings> = {};
      for (const [id, s] of Object.entries(data.forms)) {
        initialDraft[id] = cloneSettings(s);
      }
      setDraft(initialDraft);
      // Auto-select first form
      const firstId = Object.keys(data.forms)[0] ?? '';
      setSelectedFormId(firstId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const markDirty = () => {
    if (selectedFormId) {
      setDirtyForms((prev) => new Set(prev).add(selectedFormId));
    }
  };

  const updateField = (
    section: 'internal' | 'applicant_confirmation',
    field: 'subject' | 'body_template',
    value: string
  ) => {
    if (!selectedFormId) return;
    setDraft((prev) => {
      const next = { ...prev };
      next[selectedFormId] = cloneSettings(next[selectedFormId]);
      // TypeScript narrowing: both sections share subject and body_template
      (next[selectedFormId].notifications[section] as Record<string, unknown>)[field] = value;
      return next;
    });
    markDirty();
  };

  const handlePreview = async (templateType: 'internal' | 'applicant_confirmation') => {
    if (!selectedFormId) return;
    setPreviewLoading(templateType);
    setFeedback(null);
    try {
      const data = await previewTemplate(selectedFormId, templateType);
      setPreviewData(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Preview failed.',
      });
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleSave = async () => {
    if (!selectedFormId) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await updateNotificationTemplate(
        selectedFormId,
        draft[selectedFormId].notifications as Record<string, unknown>
      );
      setDirtyForms((prev) => {
        const next = new Set(prev);
        next.delete(selectedFormId);
        return next;
      });
      setFeedback({ type: 'success', message: 'Templates saved successfully.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Save failed. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedFormId) return;
    setIsSendingTest(true);
    setFeedback(null);
    try {
      const sends: Promise<unknown>[] = [sendTestTemplate(selectedFormId, 'internal')];
      const formDraft = draft[selectedFormId];
      if (formDraft?.notifications?.applicant_confirmation?.enabled) {
        sends.push(sendTestTemplate(selectedFormId, 'applicant_confirmation'));
      }
      await Promise.all(sends);
      const types = sends.length > 1 ? 'Internal + applicant confirmation emails' : 'Internal notification email';
      setFeedback({ type: 'success', message: `${types} sent to your account email.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Test send failed.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // ----- Render -----

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading templates">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 font-medium mb-3">{error}</p>
        <button
          type="button"
          onClick={loadTemplates}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!templates || Object.keys(draft).length === 0) {
    return (
      <div className="text-center py-16 text-slate-500 text-sm">
        No templates found.
      </div>
    );
  }

  const formEntries = Object.entries(draft);
  const currentForm = selectedFormId ? draft[selectedFormId] : null;
  const isDirty = dirtyForms.has(selectedFormId);

  return (
    <section aria-labelledby="templates-heading">
      <h2 id="templates-heading" className="sr-only">
        Notification Templates
      </h2>

      {feedback && (
        <InlineMessage
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Form selector */}
      {formEntries.length > 1 && (
        <div className="mb-6">
          <label htmlFor="template-form-select" className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
            Select Form
          </label>
          <select
            id="template-form-select"
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            {formEntries.map(([id, s]) => (
              <option key={id} value={id}>
                {s.form_title || id}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                Templates
              </p>
              <h3 className="text-base font-semibold text-slate-800">
                {currentForm.form_title || selectedFormId}
              </h3>
            </div>
            {isDirty && (
              <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="p-6 space-y-8">
            {/* Internal Notification template */}
            <div>
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Internal Notification
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor={`internal-subject-${selectedFormId}`} className="text-xs font-medium text-slate-600 block mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    id={`internal-subject-${selectedFormId}`}
                    value={currentForm.notifications.internal.subject}
                    onChange={(e) => updateField('internal', 'subject', e.target.value)}
                    onFocus={(e) => { lastFocusedRef.current = { section: 'internal', field: 'subject', el: e.target }; }}
                    readOnly={!isAdmin}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="New submission: {first_name} {last_name}"
                  />
                </div>

                <div>
                  <label htmlFor={`internal-body-${selectedFormId}`} className="text-xs font-medium text-slate-600 block mb-1.5">
                    Body
                  </label>
                  <textarea
                    id={`internal-body-${selectedFormId}`}
                    value={currentForm.notifications.internal.body_template}
                    onChange={(e) => updateField('internal', 'body_template', e.target.value)}
                    onFocus={(e) => { lastFocusedRef.current = { section: 'internal', field: 'body_template', el: e.target }; }}
                    readOnly={!isAdmin}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-h-[120px] resize-y"
                    placeholder="Hi Team,&#10;&#10;{form_data}&#10;&#10;Best, MyRecruiter AI"
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Available variables</p>
                  <div className="flex flex-wrap gap-1.5" role="list" aria-label="Available template variables">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        type="button"
                        key={v}
                        role="listitem"
                        onClick={() => insertVariable(v)}
                        className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 cursor-pointer transition-colors"
                        title={`Insert ${v} at cursor`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handlePreview('internal')}
                    disabled={previewLoading === 'internal'}
                    className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previewLoading === 'internal' ? 'Loading...' : 'Preview'}
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-slate-100" />

            {/* Applicant Confirmation template */}
            <div>
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Applicant Confirmation
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor={`applicant-subject-${selectedFormId}`} className="text-xs font-medium text-slate-600 block mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    id={`applicant-subject-${selectedFormId}`}
                    value={currentForm.notifications.applicant_confirmation.subject}
                    onChange={(e) => updateField('applicant_confirmation', 'subject', e.target.value)}
                    onFocus={(e) => { lastFocusedRef.current = { section: 'applicant_confirmation', field: 'subject', el: e.target }; }}
                    readOnly={!isAdmin}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Thanks for applying, {first_name}!"
                  />
                </div>

                <div>
                  <label htmlFor={`applicant-body-${selectedFormId}`} className="text-xs font-medium text-slate-600 block mb-1.5">
                    Body
                  </label>
                  <textarea
                    id={`applicant-body-${selectedFormId}`}
                    value={currentForm.notifications.applicant_confirmation.body_template}
                    onChange={(e) => updateField('applicant_confirmation', 'body_template', e.target.value)}
                    onFocus={(e) => { lastFocusedRef.current = { section: 'applicant_confirmation', field: 'body_template', el: e.target }; }}
                    readOnly={!isAdmin}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-h-[120px] resize-y"
                    placeholder="Hi {first_name},&#10;&#10;Thank you for your submission!&#10;&#10;Best regards"
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Available variables</p>
                  <div className="flex flex-wrap gap-1.5" role="list" aria-label="Available template variables">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        type="button"
                        key={v}
                        role="listitem"
                        onClick={() => insertVariable(v)}
                        className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 cursor-pointer transition-colors"
                        title={`Insert ${v} at cursor`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={currentForm.notifications.applicant_confirmation.use_tenant_branding}
                      onChange={() => {
                        setDraft((prev) => {
                          const next = { ...prev };
                          next[selectedFormId] = cloneSettings(next[selectedFormId]);
                          next[selectedFormId].notifications.applicant_confirmation.use_tenant_branding =
                            !next[selectedFormId].notifications.applicant_confirmation.use_tenant_branding;
                          return next;
                        });
                        markDirty();
                      }}
                      className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                    />
                    Use tenant branding
                  </label>

                  <button
                    type="button"
                    onClick={() => handlePreview('applicant_confirmation')}
                    disabled={previewLoading === 'applicant_confirmation'}
                    className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {previewLoading === 'applicant_confirmation' ? 'Loading...' : 'Preview'}
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-slate-100" />

            {/* Applicant SMS Template */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Applicant SMS Confirmation
                </p>
                {smsProvisioned ? (
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={currentForm.notifications.applicant_confirmation.sms?.enabled ?? false}
                      onChange={() => {
                        setDraft((prev) => {
                          const next = { ...prev };
                          next[selectedFormId] = cloneSettings(next[selectedFormId]);
                          const ac = next[selectedFormId].notifications.applicant_confirmation;
                          ac.sms = {
                            enabled: !(ac.sms?.enabled ?? false),
                            template: ac.sms?.template ?? '',
                          };
                          return next;
                        });
                        markDirty();
                      }}
                      disabled={!isAdmin}
                      className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                    />
                    Enabled
                  </label>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                    Contact us to enable SMS
                  </span>
                )}
              </div>

              {smsProvisioned && (currentForm.notifications.applicant_confirmation.sms?.enabled ?? false) && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor={`applicant-sms-${selectedFormId}`} className="text-xs font-medium text-slate-600">
                        SMS Body
                      </label>
                      {(() => {
                        const text = currentForm.notifications.applicant_confirmation.sms?.template ?? '';
                        const len = text.length;
                        const segments = len === 0 ? 0 : len <= 160 ? 1 : Math.ceil(len / 153);
                        const isLong = segments > 1;
                        return (
                          <span className={`text-xs font-mono ${isLong ? 'text-amber-600' : 'text-slate-400'}`}>
                            {len} chars · {segments} segment{segments !== 1 ? 's' : ''}
                          </span>
                        );
                      })()}
                    </div>
                    <textarea
                      id={`applicant-sms-${selectedFormId}`}
                      value={currentForm.notifications.applicant_confirmation.sms?.template ?? ''}
                      onChange={(e) => {
                        setDraft((prev) => {
                          const next = { ...prev };
                          next[selectedFormId] = cloneSettings(next[selectedFormId]);
                          const ac = next[selectedFormId].notifications.applicant_confirmation;
                          ac.sms = {
                            enabled: ac.sms?.enabled ?? false,
                            template: e.target.value,
                          };
                          return next;
                        });
                        markDirty();
                      }}
                      readOnly={!isAdmin}
                      maxLength={306}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-h-[80px] resize-y font-mono"
                      placeholder="{organization_name}: We received your submission! Check your email for details. Reply HELP for assistance."
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Keep under 160 characters for a single SMS segment. Variables: {'{first_name}'}, {'{organization_name}'}, {'{submission_id}'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action row (admin only) */}
            {isAdmin && (
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingTest ? 'Sending...' : 'Send Test'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Template preview modal */}
      {previewData && (
        <PreviewModal
          preview={previewData}
          onClose={() => setPreviewData(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// NotificationsDashboard — top-level export with sub-tab bar
// ---------------------------------------------------------------------------

export function NotificationsDashboard() {
  const [subTab, setSubTab] = useState<NotificationSubTab>('dashboard');
  const { user } = useAuth();
  const features = user?.features;

  const isSuperAdmin = user?.role === 'super_admin';

  // Non-super-admin users without notifications: show empty state (no sub-tabs)
  if (!isSuperAdmin && features && !features.dashboard_notifications) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Notifications</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Notifications are enabled when conversational forms are configured for your organization. Once forms are active, you'll be able to manage delivery settings, recipients, and templates here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Sub-tab bar */}
      <div
        className="flex gap-1 mb-6 border-b border-slate-200"
        role="tablist"
        aria-label="Notifications sections"
      >
        <SubTabButton
          active={subTab === 'dashboard'}
          onClick={() => setSubTab('dashboard')}
        >
          Dashboard
        </SubTabButton>
        <SubTabButton
          active={subTab === 'recipients'}
          onClick={() => setSubTab('recipients')}
        >
          Recipients
        </SubTabButton>
        <SubTabButton
          active={subTab === 'templates'}
          onClick={() => setSubTab('templates')}
        >
          Templates
        </SubTabButton>
      </div>

      {/* Sub-tab content panels */}
      <div role="tabpanel" aria-label={subTab}>
        {subTab === 'dashboard' && <NotificationDashboardTab />}
        {subTab === 'recipients' && <RecipientsTab />}
        {subTab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
}

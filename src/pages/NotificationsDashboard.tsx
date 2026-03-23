/**
 * Notifications Dashboard Page
 * Phase 2a — Notification delivery tracking
 *
 * Sub-tabs: Dashboard | Recipients | Templates
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import {
  PageHeader,
  FilterDropdown,
  DataTable,
  type Column,
  type TimeRangeValue,
} from '../components/shared';
import {
  fetchNotificationSummary,
  fetchNotificationEvents,
} from '../services/analyticsApi';
import type {
  NotificationSummary,
  NotificationEvent,
  NotificationSubTab,
} from '../types/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as a human-readable relative time string.
 * Returns strings like "2m ago", "1h ago", "3d ago".
 */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {status}
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
// Placeholder tab for future sub-tabs
// ---------------------------------------------------------------------------

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-slate-600 font-medium text-base">Coming Soon</p>
      <p className="text-slate-400 text-sm mt-1 max-w-sm">
        {label} management will be available here in a future release.
      </p>
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
    render: (row) => (
      <span className="block text-left text-sm text-slate-700 truncate max-w-[180px]">
        {row.recipient}
      </span>
    ),
  },
  {
    key: 'form_id',
    header: 'Form',
    render: (row) => (
      <span className="block text-left text-sm text-slate-600">
        {row.form_id || '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status || row.event_type} />,
  },
  {
    key: 'channel',
    header: 'Channel',
    render: (row) => (
      <span className="block text-left text-xs uppercase tracking-wider text-slate-500">
        {row.channel}
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
        {relativeTime(row.timestamp)}
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

const STATUS_OPTIONS = [
  { id: 'sent', name: 'Sent' },
  { id: 'delivery', name: 'Delivered' },
  { id: 'bounce', name: 'Bounced' },
  { id: 'open', name: 'Opened' },
  { id: 'click', name: 'Clicked' },
];

function NotificationDashboardTab() {
  const { user } = useAuth();

  // PageHeader state
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('7d');

  // Summary and event log state
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filter state
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Loading / error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [summaryData, eventsData] = await Promise.all([
        fetchNotificationSummary(timeRange),
        fetchNotificationEvents({
          range: timeRange,
          page,
          limit: pageSize,
          channel: channelFilter || undefined,
          status: statusFilter || undefined,
        }),
      ]);

      setSummary(summaryData);
      setEvents(eventsData.events);
      setTotalEvents(eventsData.total);
    } catch (err) {
      console.error('Notifications data load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notification data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, page, channelFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when filters or range change
  useEffect(() => {
    setPage(1);
  }, [timeRange, channelFilter, statusFilter]);

  // Suppress unused user warning — matches Dashboard.tsx pattern (user kept for future tenant context)
  void user;

  // ----- Render -----

  const handleTimeRangeChange = (range: TimeRangeValue) => {
    setTimeRange(range);
  };

  if (error) {
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
        showDatePicker={false}
      />

      {/* ---- Stat cards ---- */}
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
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            tier="hero"
            title="SENT"
            value={summary.sent.toLocaleString()}
            subtitle={`${summary.period} period`}
          />
          <StatCard
            tier="hero"
            title="DELIVERED"
            value={summary.delivered.toLocaleString()}
            subtitle={`${summary.delivery_rate}% delivery rate`}
          />
          <StatCard
            tier="hero"
            title="BOUNCED"
            value={summary.bounced.toLocaleString()}
            subtitle={`${summary.bounce_rate}% bounce rate`}
          />
          <StatCard
            tier="hero"
            title="OPENED"
            value={summary.opened.toLocaleString()}
            subtitle={`${summary.open_rate}% open rate`}
          />
        </div>
      ) : null}

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
        ) : events.length === 0 ? (
          /* Empty state */
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
            data={events}
            totalCount={totalEvents}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationsDashboard — top-level export with sub-tab bar
// ---------------------------------------------------------------------------

export function NotificationsDashboard() {
  const [subTab, setSubTab] = useState<NotificationSubTab>('dashboard');

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
        {subTab === 'recipients' && <PlaceholderTab label="Recipients" />}
        {subTab === 'templates' && <PlaceholderTab label="Templates" />}
      </div>
    </div>
  );
}

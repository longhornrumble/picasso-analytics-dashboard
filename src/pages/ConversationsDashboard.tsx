/**
 * Conversations Dashboard Page
 * Shows conversation analytics: heat map, top questions, recent Q&A
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { ConversationHeatMap } from '../components/ConversationHeatMap';
import { TopQuestions } from '../components/TopQuestions';
import { RecentConversations } from '../components/RecentConversations';
import { SessionsList, SessionTimeline } from '../components/sessions';
import { generateConversationsPDF } from '../components/export';
import {
  PageHeader,
  SimpleTrendChart,
  ExportDropdown,
  type TimeRangeValue,
  type ExportFormat,
  type DateRange,
} from '../components/shared';
import {
  fetchConversationSummary,
  fetchConversationHeatmap,
  fetchTopQuestions,
  fetchRecentConversations,
  fetchConversationTrend,
  exportConversationsData,
} from '../services/analyticsApi';
import type {
  ConversationSummaryMetrics,
  HeatmapRow,
  HeatmapPeak,
  TopQuestion,
  RecentConversation,
  ConversationTrendPoint,
  TimeRange,
  SessionSummary,
  SessionDetailResponse,
} from '../types/analytics';

/**
 * MOCK DATA SWITCH (Demo Mode)
 * ============================
 * Mock data is ONLY shown when BOTH conditions are met:
 * 1. VITE_USE_MOCK_DATA=true (environment variable)
 * 2. Tenant ID is MYR384719 (demo tenant)
 *
 * This prevents mock data from accidentally appearing for real tenants.
 * Used only for sales demos and presentations.
 */
const DEMO_TENANT_ID = 'MYR384719';
const MOCK_DATA_ENV_ENABLED = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Check if mock data should be used for a given tenant
 * @param tenantId - The current tenant's ID
 * @returns true only if env var is enabled AND tenant is the demo tenant
 */
function shouldUseMockData(tenantId: string | undefined): boolean {
  return MOCK_DATA_ENV_ENABLED && tenantId === DEMO_TENANT_ID;
}

// Feature flag: Use new SessionsList component instead of legacy RecentConversations
// Both use DynamoDB backend, but SessionsList has richer session timeline support
const USE_SESSIONS_API = import.meta.env.VITE_USE_SESSIONS_API === 'true';

// Mock data for development
const mockSummary: ConversationSummaryMetrics = {
  total_conversations: 276,
  total_messages: 285,
  avg_response_time_seconds: 2.1,
  after_hours_percentage: 49.5,
};

const mockHeatmap: HeatmapRow[] = [
  { hour_block: '12AM', data: [{ day: 'Mon', value: 2 }, { day: 'Tue', value: 0 }, { day: 'Wed', value: 1 }, { day: 'Thu', value: 0 }, { day: 'Fri', value: 1 }, { day: 'Sat', value: 0 }, { day: 'Sun', value: 1 }] },
  { hour_block: '3AM', data: [{ day: 'Mon', value: 0 }, { day: 'Tue', value: 0 }, { day: 'Wed', value: 0 }, { day: 'Thu', value: 0 }, { day: 'Fri', value: 0 }, { day: 'Sat', value: 0 }, { day: 'Sun', value: 0 }] },
  { hour_block: '6AM', data: [{ day: 'Mon', value: 3 }, { day: 'Tue', value: 2 }, { day: 'Wed', value: 4 }, { day: 'Thu', value: 3 }, { day: 'Fri', value: 2 }, { day: 'Sat', value: 1 }, { day: 'Sun', value: 0 }] },
  { hour_block: '9AM', data: [{ day: 'Mon', value: 9 }, { day: 'Tue', value: 10 }, { day: 'Wed', value: 12 }, { day: 'Thu', value: 8 }, { day: 'Fri', value: 9 }, { day: 'Sat', value: 10 }, { day: 'Sun', value: 5 }] },
  { hour_block: '12PM', data: [{ day: 'Mon', value: 15 }, { day: 'Tue', value: 18 }, { day: 'Wed', value: 20 }, { day: 'Thu', value: 25 }, { day: 'Fri', value: 16 }, { day: 'Sat', value: 12 }, { day: 'Sun', value: 8 }] },
  { hour_block: '3PM', data: [{ day: 'Mon', value: 12 }, { day: 'Tue', value: 14 }, { day: 'Wed', value: 16 }, { day: 'Thu', value: 18 }, { day: 'Fri', value: 14 }, { day: 'Sat', value: 10 }, { day: 'Sun', value: 6 }] },
  { hour_block: '6PM', data: [{ day: 'Mon', value: 8 }, { day: 'Tue', value: 10 }, { day: 'Wed', value: 9 }, { day: 'Thu', value: 11 }, { day: 'Fri', value: 8 }, { day: 'Sat', value: 14 }, { day: 'Sun', value: 10 }] },
  { hour_block: '9PM', data: [{ day: 'Mon', value: 4 }, { day: 'Tue', value: 3 }, { day: 'Wed', value: 5 }, { day: 'Thu', value: 4 }, { day: 'Fri', value: 6 }, { day: 'Sat', value: 8 }, { day: 'Sun', value: 5 }] },
];

const mockPeak: HeatmapPeak = { day: 'Thu', hour_block: '12PM', count: 25 };

const mockQuestions: TopQuestion[] = [
  { question_text: 'How can I donate to your organization?', count: 71, percentage: 24.9 },
  { question_text: 'How can I request supplies?', count: 49, percentage: 17.2 },
  { question_text: 'Tell me about your events and gatherings.', count: 48, percentage: 16.8 },
  { question_text: 'What volunteer opportunities are available?', count: 35, percentage: 12.3 },
  { question_text: 'What services do you offer?', count: 30, percentage: 10.5 },
];

const mockRecentConversations: RecentConversation[] = [
  {
    session_id: 'sess_001',
    started_at: '2025-12-01T17:34:00Z',
    topic: 'Volunteer',
    first_question: 'What volunteer opportunities are available?',
    first_answer: 'We offer several meaningful volunteer opportunities for those passionate about supporting children and families in the foster care system. You can help with mentoring, event support, or supply drives.',
    response_time_seconds: 1.9,
    message_count: 4,
    outcome: 'form_started',
  },
  {
    session_id: 'sess_002',
    started_at: '2025-12-01T16:01:00Z',
    topic: 'Volunteer',
    first_question: 'Volunteer',
    first_answer: 'At our organization we offer a variety of meaningful volunteer opportunities to support children and families in the foster care system.',
    response_time_seconds: 1.4,
    message_count: 2,
    outcome: null,
  },
  {
    session_id: 'sess_003',
    started_at: '2025-12-01T14:22:00Z',
    topic: 'Donation',
    first_question: 'How can I make a donation?',
    first_answer: 'Thank you for your interest in supporting our mission! You can make a donation through our secure online portal or by contacting our office directly.',
    response_time_seconds: 2.1,
    message_count: 3,
    outcome: 'link_clicked',
  },
];

const mockTrend: ConversationTrendPoint[] = [
  { period: '12am', value: 5 },
  { period: '2am', value: 3 },
  { period: '4am', value: 2 },
  { period: '6am', value: 8 },
  { period: '8am', value: 12 },
  { period: '10am', value: 15 },
  { period: '12pm', value: 18 },
  { period: '2pm', value: 22 },
  { period: '4pm', value: 25 },
  { period: '6pm', value: 28 },
  { period: '8pm', value: 20 },
  { period: '10pm', value: 12 },
];

// Mock sessions for SessionsList component
const mockSessions: SessionSummary[] = [
  {
    session_id: 'sess_mock_001',
    started_at: '2025-12-01T17:34:00Z',
    ended_at: '2025-12-01T17:42:00Z',
    duration_seconds: 480,
    outcome: 'form_completed',
    message_count: 8,
    user_message_count: 4,
    bot_message_count: 4,
    first_question: 'What volunteer opportunities are available?',
    form_id: 'volunteer_application',
  },
  {
    session_id: 'sess_mock_002',
    started_at: '2025-12-01T16:01:00Z',
    ended_at: '2025-12-01T16:08:00Z',
    duration_seconds: 420,
    outcome: 'cta_clicked',
    message_count: 5,
    user_message_count: 2,
    bot_message_count: 3,
    first_question: 'How can I donate to your organization?',
  },
  {
    session_id: 'sess_mock_003',
    started_at: '2025-12-01T14:22:00Z',
    ended_at: '2025-12-01T14:30:00Z',
    duration_seconds: 480,
    outcome: 'link_clicked',
    message_count: 6,
    user_message_count: 3,
    bot_message_count: 3,
    first_question: 'How can I make a donation?',
  },
  {
    session_id: 'sess_mock_004',
    started_at: '2025-12-01T12:15:00Z',
    ended_at: '2025-12-01T12:18:00Z',
    duration_seconds: 180,
    outcome: 'browsing',
    message_count: 3,
    user_message_count: 1,
    bot_message_count: 2,
    first_question: 'What services do you offer?',
  },
  {
    session_id: 'sess_mock_005',
    started_at: '2025-12-01T10:45:00Z',
    ended_at: '2025-12-01T10:47:00Z',
    duration_seconds: 120,
    outcome: 'abandoned',
    message_count: 2,
    user_message_count: 1,
    bot_message_count: 1,
    first_question: 'Hello',
  },
];

// Mock session detail for SessionTimeline modal
const mockSessionDetails: Record<string, SessionDetailResponse> = {
  'sess_mock_001': {
    session_id: 'sess_mock_001',
    tenant_id: 'MYR384719',
    started_at: '2025-12-01T17:34:00Z',
    ended_at: '2025-12-01T17:42:00Z',
    duration_seconds: 480,
    event_count: 10,
    summary: {
      message_count: 8,
      user_message_count: 4,
      bot_message_count: 4,
      outcome: 'form_completed',
      first_question: 'What volunteer opportunities are available?',
      form_id: 'volunteer_application',
    },
    events: [
      { step_number: 1, event_type: 'WIDGET_OPENED', timestamp: '2025-12-01T17:34:00Z', payload: { type: 'WIDGET_OPENED', trigger: 'button' } },
      { step_number: 2, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T17:34:15Z', payload: { type: 'MESSAGE_SENT', content_preview: 'What volunteer opportunities are available?', content_length: 42 } },
      { step_number: 3, event_type: 'MESSAGE_RECEIVED', timestamp: '2025-12-01T17:34:17Z', payload: { type: 'MESSAGE_RECEIVED', content_preview: 'We offer several meaningful volunteer opportunities for those passionate about supporting...', content_length: 245 } },
      { step_number: 4, event_type: 'CTA_CLICKED', timestamp: '2025-12-01T17:35:30Z', payload: { type: 'CTA_CLICKED', cta_id: 'volunteer_apply', cta_label: 'Apply to Volunteer', cta_action: 'form', triggers_form: true } },
      { step_number: 5, event_type: 'FORM_STARTED', timestamp: '2025-12-01T17:35:32Z', payload: { type: 'FORM_STARTED', form_id: 'volunteer_application', form_label: 'Volunteer Application' } },
      { step_number: 6, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T17:38:00Z', payload: { type: 'MESSAGE_SENT', content_preview: 'Sarah Jenkins', content_length: 13 } },
      { step_number: 7, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T17:39:00Z', payload: { type: 'MESSAGE_SENT', content_preview: 'sarah.j@email.com', content_length: 18 } },
      { step_number: 8, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T17:40:00Z', payload: { type: 'MESSAGE_SENT', content_preview: '512-555-1234', content_length: 12 } },
      { step_number: 9, event_type: 'FORM_COMPLETED', timestamp: '2025-12-01T17:41:30Z', payload: { type: 'FORM_COMPLETED', form_id: 'volunteer_application', form_label: 'Volunteer Application', duration_seconds: 358, fields_completed: 5 } },
    ],
  },
  'sess_mock_002': {
    session_id: 'sess_mock_002',
    tenant_id: 'MYR384719',
    started_at: '2025-12-01T16:01:00Z',
    ended_at: '2025-12-01T16:08:00Z',
    duration_seconds: 420,
    event_count: 6,
    summary: {
      message_count: 5,
      user_message_count: 2,
      bot_message_count: 3,
      outcome: 'cta_clicked',
      first_question: 'How can I donate to your organization?',
    },
    events: [
      { step_number: 1, event_type: 'WIDGET_OPENED', timestamp: '2025-12-01T16:01:00Z', payload: { type: 'WIDGET_OPENED', trigger: 'button' } },
      { step_number: 2, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T16:01:30Z', payload: { type: 'MESSAGE_SENT', content_preview: 'How can I donate to your organization?', content_length: 39 } },
      { step_number: 3, event_type: 'MESSAGE_RECEIVED', timestamp: '2025-12-01T16:01:32Z', payload: { type: 'MESSAGE_RECEIVED', content_preview: 'Thank you for your interest in supporting our mission! You can donate online...', content_length: 180 } },
      { step_number: 4, event_type: 'CTA_CLICKED', timestamp: '2025-12-01T16:03:00Z', payload: { type: 'CTA_CLICKED', cta_id: 'donate_now', cta_label: 'Donate Now', cta_action: 'link' } },
      { step_number: 5, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T16:07:00Z', payload: { type: 'MESSAGE_SENT', content_preview: 'Thank you!', content_length: 10 } },
    ],
  },
  'sess_mock_003': {
    session_id: 'sess_mock_003',
    tenant_id: 'MYR384719',
    started_at: '2025-12-01T14:22:00Z',
    ended_at: '2025-12-01T14:30:00Z',
    duration_seconds: 480,
    event_count: 7,
    summary: {
      message_count: 6,
      user_message_count: 3,
      bot_message_count: 3,
      outcome: 'link_clicked',
      first_question: 'How can I make a donation?',
    },
    events: [
      { step_number: 1, event_type: 'WIDGET_OPENED', timestamp: '2025-12-01T14:22:00Z', payload: { type: 'WIDGET_OPENED', trigger: 'auto' } },
      { step_number: 2, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T14:22:30Z', payload: { type: 'MESSAGE_SENT', content_preview: 'How can I make a donation?', content_length: 26 } },
      { step_number: 3, event_type: 'MESSAGE_RECEIVED', timestamp: '2025-12-01T14:22:32Z', payload: { type: 'MESSAGE_RECEIVED', content_preview: 'Thank you for wanting to support our cause! You can make a donation...', content_length: 200 } },
      { step_number: 4, event_type: 'MESSAGE_SENT', timestamp: '2025-12-01T14:25:00Z', payload: { type: 'MESSAGE_SENT', content_preview: 'What payment methods do you accept?', content_length: 35 } },
      { step_number: 5, event_type: 'MESSAGE_RECEIVED', timestamp: '2025-12-01T14:25:02Z', payload: { type: 'MESSAGE_RECEIVED', content_preview: 'We accept credit cards, debit cards, PayPal, and bank transfers...', content_length: 150 } },
      { step_number: 6, event_type: 'LINK_CLICKED', timestamp: '2025-12-01T14:28:00Z', payload: { type: 'LINK_CLICKED', url: 'https://donate.example.org', link_text: 'Online Donation Portal', link_domain: 'donate.example.org', category: 'web' } },
    ],
  },
};

export function ConversationsDashboard() {
  const { user } = useAuth();

  // Mock data is ONLY enabled for demo tenant MYR384719
  const useMockData = shouldUseMockData(user?.tenant_id);

  // State
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle time range change - clear custom date range when switching to preset
  const handleTimeRangeChange = (range: TimeRangeValue) => {
    setTimeRange(range);
    if (range !== 'custom') {
      setDateRange(null);
    }
  };

  // Session timeline state (for new Sessions API)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Data state (only used when USE_SESSIONS_API is false)
  const [summary, setSummary] = useState<ConversationSummaryMetrics | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [peak, setPeak] = useState<HeatmapPeak | null>(null);
  const [totalConversations, setTotalConversations] = useState(0);
  const [questions, setQuestions] = useState<TopQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationsHasMore, setConversationsHasMore] = useState(false);
  const [trend, setTrend] = useState<ConversationTrendPoint[]>([]);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch data from DynamoDB (all endpoints now use fast DynamoDB queries)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Build date range options for custom range
    const dateRangeOptions = timeRange === 'custom' && dateRange ? {
      startDate: dateRange.startDate.toISOString().split('T')[0],
      endDate: dateRange.endDate.toISOString().split('T')[0],
    } : undefined;

    try {
      const [summaryData, heatmapData, questionsData, conversationsData, trendData] = await Promise.all([
        fetchConversationSummary(timeRange, dateRangeOptions),
        fetchConversationHeatmap(timeRange, dateRangeOptions),
        fetchTopQuestions(timeRange, 5, dateRangeOptions),
        fetchRecentConversations(timeRange, 1, 5, dateRangeOptions),
        fetchConversationTrend(timeRange, timeRange === '1d' ? 'hour' : 'day', dateRangeOptions),
      ]);

      setSummary(summaryData.metrics);
      setHeatmap(heatmapData.heatmap);
      setPeak(heatmapData.peak);
      setTotalConversations(heatmapData.total_conversations);
      setQuestions(questionsData.questions);
      setTotalQuestions(questionsData.total_questions);
      setConversations(conversationsData.conversations);
      setConversationsTotal(conversationsData.pagination.total_count);
      setConversationsHasMore(conversationsData.pagination.has_next);
      setTrend(trendData.trend);
      setConversationsPage(1);
    } catch (err) {
      console.error('Conversations dashboard load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load more conversations
  const handleLoadMoreConversations = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = conversationsPage + 1;
      const data = await fetchRecentConversations(timeRange, nextPage, 5);
      setConversations(prev => [...prev, ...data.conversations]);
      setConversationsPage(nextPage);
      setConversationsHasMore(data.pagination.has_next);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Format response time
  const formatResponseTime = (seconds: number): string => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(1)} sec`;
  };

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setExportToast({ type, message });
    setTimeout(() => setExportToast(null), 4000);
  };

  // Export handler
  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setExportingFormat(format);
    try {
      if (format === 'csv') {
        // CSV export - sessions list
        const blob = await exportConversationsData(timeRange);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversations-sessions-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', 'Sessions exported as CSV');
      } else if (format === 'pdf') {
        // PDF export - summary report
        const pdfSummary = useMockData ? mockSummary : summary;
        const pdfQuestions = useMockData ? mockQuestions : questions;
        const pdfHeatmap = useMockData ? mockHeatmap : heatmap;
        const pdfPeak = useMockData ? mockPeak : peak;
        const pdfTrend = useMockData ? mockTrend : trend;

        if (pdfSummary) {
          await generateConversationsPDF({
            summary: pdfSummary,
            topQuestions: pdfQuestions,
            heatmap: pdfHeatmap,
            peak: pdfPeak,
            trend: pdfTrend,
            timeRange,
            tenantName: 'MyRecruiter',
          });
          showToast('success', 'Summary report exported as PDF');
        } else {
          showToast('error', 'No data available to export');
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast('error', 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4 border-4 border-primary-200"
            style={{
              borderTopColor: 'var(--color-primary-500)',
            }}
          />
          <p className="text-slate-500 font-medium">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm max-w-md border border-slate-100">
          <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Failed to load data</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-xl font-semibold transition-all duration-200 hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Export Toast Notification */}
      {exportToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            exportToast.type === 'success'
              ? 'bg-primary-50 border border-primary-200 text-primary-800'
              : 'bg-danger-50 border border-danger-200 text-danger-800'
          }`}
        >
          {exportToast.type === 'success' ? (
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="text-sm font-medium">{exportToast.message}</span>
          <button
            onClick={() => setExportToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeader
          sectionLabel="MISSION INTELLIGENCE"
          title="Conversation Flow"
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          showExport={false}
          showDatePicker={true}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          actions={
            <ExportDropdown
              onExport={handleExport}
              isExporting={isExporting}
              exportingFormat={exportingFormat}
            />
          }
        />

        {/* Stats Cards - Hero Tier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Conversations"
            value={(useMockData ? mockSummary.total_conversations : (summary?.total_conversations ?? 0)).toLocaleString()}
            subtitle="Unique chat sessions"
            variant="primary"
            tier="hero"
          />
          <StatCard
            title="Total Messages"
            value={(useMockData ? mockSummary.total_messages : (summary?.total_messages ?? 0)).toLocaleString()}
            subtitle="User + bot messages"
            tier="hero"
          />
          <StatCard
            title="Response Time"
            value={formatResponseTime(useMockData ? mockSummary.avg_response_time_seconds : (summary?.avg_response_time_seconds ?? 0))}
            subtitle="Average bot response"
            variant="success"
            tier="hero"
          />
          <StatCard
            title="After Hours"
            value={`${(useMockData ? mockSummary.after_hours_percentage : (summary?.after_hours_percentage ?? 0)).toFixed(1)}%`}
            subtitle="Outside 9am-5pm"
            variant="info"
            tier="hero"
          />
        </div>

        {/* Heat Map and Top Questions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ConversationHeatMap
            data={useMockData ? mockHeatmap : heatmap}
            peak={useMockData ? mockPeak : peak}
            totalConversations={useMockData ? 276 : totalConversations}
          />
          <TopQuestions
            questions={useMockData ? mockQuestions : questions}
            totalQuestions={useMockData ? 276 : totalQuestions}
          />
        </div>

        {/* Trend Chart */}
        <div className="mb-8">
          <SimpleTrendChart
            title="Conversations Trend"
            subtitle="Questions per hour"
            data={(useMockData ? mockTrend : trend).map(t => ({ label: t.period, value: t.value }))}
            color="primary"
            height={200}
            showArea
          />
        </div>

        {/* Recent Conversations / Sessions List */}
        {USE_SESSIONS_API ? (
          <>
            <SessionsList
              timeRange={timeRange as TimeRange}
              onSessionClick={setSelectedSessionId}
              mockSessions={useMockData ? mockSessions : undefined}
            />
            <SessionTimeline
              sessionId={selectedSessionId}
              onClose={() => setSelectedSessionId(null)}
              mockSessionDetail={useMockData && selectedSessionId ? mockSessionDetails[selectedSessionId] : undefined}
            />
          </>
        ) : (
          <RecentConversations
            conversations={useMockData ? mockRecentConversations : conversations}
            totalCount={useMockData ? 50 : conversationsTotal}
            loading={loadingMore}
            hasMore={useMockData ? true : conversationsHasMore}
            onLoadMore={handleLoadMoreConversations}
          />
        )}

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-slate-100 flex items-center justify-center gap-2">
          <span className="text-sm text-slate-400">Mission Intelligence Platform powered by</span>
          <img src="/myrecruiter-logo.png" alt="MyRecruiter" className="h-6 w-auto" />
        </footer>
      </div>
    </div>
  );
}

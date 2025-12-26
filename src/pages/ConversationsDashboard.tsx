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
import {
  PageHeader,
  SimpleTrendChart,
  type TimeRangeValue,
} from '../components/shared';
import {
  fetchConversationSummary,
  fetchConversationHeatmap,
  fetchTopQuestions,
  fetchRecentConversations,
  fetchConversationTrend,
} from '../services/analyticsApi';
import type {
  ConversationSummaryMetrics,
  HeatmapRow,
  HeatmapPeak,
  TopQuestion,
  RecentConversation,
  ConversationTrendPoint,
  TimeRange,
} from '../types/analytics';

// Dev mode: use mock data when explicitly enabled (VITE_DEV_MODE=true)
// Note: Setting VITE_DEV_MODE=false allows testing real API in dev server
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Feature flag for new Sessions API (User Journey Analytics)
// When enabled, replaces RecentConversations with SessionsList + SessionTimeline
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

export function ConversationsDashboard() {
  const { logout } = useAuth();

  // State
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session timeline state (for new Sessions API)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Data state
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

  // Fetch data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [summaryData, heatmapData, questionsData, conversationsData, trendData] = await Promise.all([
        fetchConversationSummary(timeRange),
        fetchConversationHeatmap(timeRange),
        fetchTopQuestions(timeRange, 5),
        fetchRecentConversations(timeRange, 1, 5),
        fetchConversationTrend(timeRange, timeRange === '1d' ? 'hour' : 'day'),
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

      // In dev mode, fall back to mock data
      if (DEV_MODE) {
        console.log('📊 Using mock conversation data (dev mode)');
        setSummary(mockSummary);
        setHeatmap(mockHeatmap);
        setPeak(mockPeak);
        setTotalConversations(276);
        setQuestions(mockQuestions);
        setTotalQuestions(276);
        setConversations(mockRecentConversations);
        setConversationsTotal(50);
        setConversationsHasMore(true);
        setTrend(mockTrend);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm max-w-md">
          <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeader
          title="Conversation Overview"
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onSignOut={logout}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Conversations"
            value={(summary?.total_conversations ?? 0).toLocaleString()}
            subtitle="Unique chat sessions"
            variant="primary"
          />
          <StatCard
            title="Total Messages"
            value={(summary?.total_messages ?? 0).toLocaleString()}
            subtitle="User + bot messages"
          />
          <StatCard
            title="Response Time"
            value={formatResponseTime(summary?.avg_response_time_seconds ?? 0)}
            subtitle="Average bot response"
            variant="success"
          />
          <StatCard
            title="After Hours"
            value={`${(summary?.after_hours_percentage ?? 0).toFixed(1)}%`}
            subtitle="Outside 9am-5pm"
            variant="info"
          />
        </div>

        {/* Heat Map and Top Questions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ConversationHeatMap
            data={heatmap}
            peak={peak}
            totalConversations={totalConversations}
          />
          <TopQuestions
            questions={questions}
            totalQuestions={totalQuestions}
          />
        </div>

        {/* Trend Chart */}
        <div className="mb-8">
          <SimpleTrendChart
            title="Conversations Trend"
            subtitle={timeRange === '1d' ? 'Questions per hour' : 'Questions per day'}
            data={trend.map(t => ({ label: t.period, value: t.value }))}
            color="green"
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
            />
            <SessionTimeline
              sessionId={selectedSessionId}
              onClose={() => setSelectedSessionId(null)}
            />
          </>
        ) : (
          <RecentConversations
            conversations={conversations}
            totalCount={conversationsTotal}
            loading={loadingMore}
            hasMore={conversationsHasMore}
            onLoadMore={handleLoadMoreConversations}
          />
        )}

        {/* Footer */}
        <footer className="mt-12 text-center py-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Mission Intelligence Platform powered by{' '}
            <span className="font-semibold text-gray-700">MyRecruiter</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

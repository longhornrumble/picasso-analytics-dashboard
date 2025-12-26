/**
 * Analytics API Service
 * Communicates with the Analytics_Dashboard_API Lambda
 */

import type {
  SummaryResponse,
  SessionsResponse,
  EventsResponse,
  FunnelResponse,
  BottlenecksResponse,
  SubmissionsResponse,
  TopPerformersResponse,
  FormSummaryResponse,
  ConversationSummaryResponse,
  HeatmapResponse,
  TopQuestionsResponse,
  RecentConversationsResponse,
  ConversationTrendResponse,
  TimeRange,
} from '../types/analytics';

// API endpoint - configurable via environment variable
const API_BASE_URL = import.meta.env.VITE_ANALYTICS_API_URL ||
  'https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws';

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('analytics_token');
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch summary metrics
 */
export async function fetchSummary(range: TimeRange = '30d'): Promise<SummaryResponse> {
  return apiRequest<SummaryResponse>('/analytics/summary', { range });
}

/**
 * Fetch session data over time
 */
export async function fetchSessions(
  range: TimeRange = '30d',
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<SessionsResponse> {
  return apiRequest<SessionsResponse>('/analytics/sessions', { range, granularity });
}

/**
 * Fetch event breakdown
 */
export async function fetchEvents(
  range: TimeRange = '30d',
  eventType?: string
): Promise<EventsResponse> {
  const params: Record<string, string> = { range };
  if (eventType) {
    params.type = eventType;
  }
  return apiRequest<EventsResponse>('/analytics/events', params);
}

/**
 * Fetch funnel data
 */
export async function fetchFunnel(range: TimeRange = '30d'): Promise<FunnelResponse> {
  return apiRequest<FunnelResponse>('/analytics/funnel', { range });
}

// =============================================================================
// Forms API Functions
// =============================================================================

/**
 * Fetch form-specific summary metrics
 * This returns metrics specific to forms (views, starts, completions, abandons)
 * as opposed to fetchSummary which returns general widget analytics
 */
export async function fetchFormSummary(
  range: TimeRange = '30d',
  formId?: string
): Promise<FormSummaryResponse> {
  const params: Record<string, string> = { range };
  if (formId) {
    params.form_id = formId;
  }
  return apiRequest<FormSummaryResponse>('/forms/summary', params);
}

/**
 * Fetch field bottleneck analysis
 */
export async function fetchBottlenecks(
  range: TimeRange = '30d',
  formId?: string,
  limit: number = 5
): Promise<BottlenecksResponse> {
  const params: Record<string, string> = { range, limit: String(limit) };
  if (formId) {
    params.form_id = formId;
  }
  return apiRequest<BottlenecksResponse>('/forms/bottlenecks', params);
}

/**
 * Fetch form submissions with pagination
 */
export async function fetchSubmissions(
  range: TimeRange = '30d',
  page: number = 1,
  limit: number = 25,
  formId?: string,
  search?: string
): Promise<SubmissionsResponse> {
  const params: Record<string, string> = {
    range,
    page: String(page),
    limit: String(limit),
  };
  if (formId) {
    params.form_id = formId;
  }
  if (search) {
    params.search = search;
  }
  return apiRequest<SubmissionsResponse>('/forms/submissions', params);
}

/**
 * Fetch top performing forms
 */
export async function fetchTopPerformers(
  range: TimeRange = '30d',
  limit: number = 5,
  sortBy: 'conversion_rate' | 'completions' | 'avg_time' = 'conversion_rate'
): Promise<TopPerformersResponse> {
  return apiRequest<TopPerformersResponse>('/forms/top-performers', {
    range,
    limit: String(limit),
    sort_by: sortBy,
  });
}

// =============================================================================
// Conversations API Functions
// =============================================================================

/**
 * Fetch conversation summary metrics
 * Returns total conversations, messages, response time, after-hours %
 */
export async function fetchConversationSummary(
  range: TimeRange = '30d'
): Promise<ConversationSummaryResponse> {
  return apiRequest<ConversationSummaryResponse>('/conversations/summary', { range });
}

/**
 * Fetch conversation heatmap data
 * Returns day x hour grid with conversation counts
 * Automatically passes the user's timezone for correct local time display
 */
export async function fetchConversationHeatmap(
  range: TimeRange = '30d'
): Promise<HeatmapResponse> {
  // Get user's timezone (e.g., "America/Chicago")
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiRequest<HeatmapResponse>('/conversations/heatmap', { range, timezone });
}

/**
 * Fetch top questions
 * Returns most frequently asked questions with counts
 */
export async function fetchTopQuestions(
  range: TimeRange = '30d',
  limit: number = 5
): Promise<TopQuestionsResponse> {
  return apiRequest<TopQuestionsResponse>('/conversations/top-questions', {
    range,
    limit: String(limit),
  });
}

/**
 * Fetch recent conversations
 * Returns recent Q&A pairs with details
 */
export async function fetchRecentConversations(
  range: TimeRange = '30d',
  page: number = 1,
  limit: number = 10
): Promise<RecentConversationsResponse> {
  return apiRequest<RecentConversationsResponse>('/conversations/recent', {
    range,
    page: String(page),
    limit: String(limit),
  });
}

/**
 * Fetch conversation trend data
 * Returns conversation counts over time for line chart
 */
export async function fetchConversationTrend(
  range: TimeRange = '30d',
  granularity: 'hour' | 'day' = 'hour'
): Promise<ConversationTrendResponse> {
  return apiRequest<ConversationTrendResponse>('/conversations/trend', {
    range,
    granularity,
  });
}

/**
 * Export analytics data as CSV
 */
export async function exportData(range: TimeRange = '30d'): Promise<Blob> {
  const [summary, sessions, events, funnel] = await Promise.all([
    fetchSummary(range),
    fetchSessions(range),
    fetchEvents(range),
    fetchFunnel(range),
  ]);

  // Build CSV content
  const csvRows: string[] = [];

  // Summary section
  csvRows.push('SUMMARY METRICS');
  csvRows.push('Metric,Value');
  csvRows.push(`Total Sessions,${summary.metrics.total_sessions}`);
  csvRows.push(`Total Events,${summary.metrics.total_events}`);
  csvRows.push(`Widget Opens,${summary.metrics.widget_opens}`);
  csvRows.push(`Forms Started,${summary.metrics.forms_started}`);
  csvRows.push(`Forms Completed,${summary.metrics.forms_completed}`);
  csvRows.push(`Conversion Rate,${summary.metrics.conversion_rate}%`);
  csvRows.push('');

  // Sessions section
  csvRows.push('SESSIONS OVER TIME');
  csvRows.push('Period,Sessions,Events');
  sessions.data.forEach(d => {
    csvRows.push(`${d.period},${d.sessions},${d.events}`);
  });
  csvRows.push('');

  // Events section
  csvRows.push('EVENT BREAKDOWN');
  csvRows.push('Event Type,Count,Unique Sessions');
  events.events.forEach(e => {
    csvRows.push(`${e.type},${e.count},${e.unique_sessions}`);
  });
  csvRows.push('');

  // Funnel section
  csvRows.push('CONVERSION FUNNEL');
  csvRows.push('Stage,Count,Rate');
  funnel.funnel.forEach(f => {
    csvRows.push(`${f.stage},${f.count},${f.rate}%`);
  });

  return new Blob([csvRows.join('\n')], { type: 'text/csv' });
}

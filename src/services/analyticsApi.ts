/**
 * Analytics API Service
 * Communicates with the Analytics_Dashboard_API Lambda
 */

import Papa from 'papaparse';
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
  SessionsListResponse,
  SessionDetailResponse,
  SessionOutcome,
  FeaturesResponse,
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

// Options for custom date range queries
interface DateRangeOptions {
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string;   // ISO date string (YYYY-MM-DD)
}

/**
 * Fetch form-specific summary metrics
 * This returns metrics specific to forms (views, starts, completions, abandons)
 * as opposed to fetchSummary which returns general widget analytics
 */
export async function fetchFormSummary(
  range: TimeRange = '30d',
  formId?: string,
  dateRangeOptions?: DateRangeOptions
): Promise<FormSummaryResponse> {
  const params: Record<string, string> = { range };
  if (formId) {
    params.form_id = formId;
  }
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<FormSummaryResponse>('/forms/summary', params);
}

/**
 * Fetch field bottleneck analysis
 */
export async function fetchBottlenecks(
  range: TimeRange = '30d',
  formId?: string,
  limit: number = 5,
  dateRangeOptions?: DateRangeOptions
): Promise<BottlenecksResponse> {
  const params: Record<string, string> = { range, limit: String(limit) };
  if (formId) {
    params.form_id = formId;
  }
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
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
  search?: string,
  dateRangeOptions?: DateRangeOptions
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
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<SubmissionsResponse>('/forms/submissions', params);
}

/**
 * Fetch top performing forms
 */
export async function fetchTopPerformers(
  range: TimeRange = '30d',
  limit: number = 5,
  sortBy: 'conversion_rate' | 'completions' | 'avg_time' = 'conversion_rate',
  dateRangeOptions?: DateRangeOptions
): Promise<TopPerformersResponse> {
  const params: Record<string, string> = {
    range,
    limit: String(limit),
    sort_by: sortBy,
  };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<TopPerformersResponse>('/forms/top-performers', params);
}

// =============================================================================
// Conversations API Functions
// =============================================================================

/**
 * Fetch conversation summary metrics
 * Returns total conversations, messages, response time, after-hours %
 */
export async function fetchConversationSummary(
  range: TimeRange = '30d',
  dateRangeOptions?: DateRangeOptions
): Promise<ConversationSummaryResponse> {
  const params: Record<string, string> = { range };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<ConversationSummaryResponse>('/conversations/summary', params);
}

/**
 * Fetch conversation heatmap data
 * Returns day x hour grid with conversation counts
 * Automatically passes the user's timezone for correct local time display
 */
export async function fetchConversationHeatmap(
  range: TimeRange = '30d',
  dateRangeOptions?: DateRangeOptions
): Promise<HeatmapResponse> {
  // Get user's timezone (e.g., "America/Chicago")
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const params: Record<string, string> = { range, timezone };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<HeatmapResponse>('/conversations/heatmap', params);
}

/**
 * Fetch top questions
 * Returns most frequently asked questions with counts
 */
export async function fetchTopQuestions(
  range: TimeRange = '30d',
  limit: number = 5,
  dateRangeOptions?: DateRangeOptions
): Promise<TopQuestionsResponse> {
  const params: Record<string, string> = {
    range,
    limit: String(limit),
  };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<TopQuestionsResponse>('/conversations/top-questions', params);
}

/**
 * Fetch recent conversations
 * Returns recent Q&A pairs with details
 */
export async function fetchRecentConversations(
  range: TimeRange = '30d',
  page: number = 1,
  limit: number = 10,
  dateRangeOptions?: DateRangeOptions
): Promise<RecentConversationsResponse> {
  const params: Record<string, string> = {
    range,
    page: String(page),
    limit: String(limit),
  };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<RecentConversationsResponse>('/conversations/recent', params);
}

/**
 * Fetch conversation trend data
 * Returns conversation counts over time for line chart
 */
export async function fetchConversationTrend(
  range: TimeRange = '30d',
  granularity: 'hour' | 'day' = 'hour',
  dateRangeOptions?: DateRangeOptions
): Promise<ConversationTrendResponse> {
  const params: Record<string, string> = {
    range,
    granularity,
  };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<ConversationTrendResponse>('/conversations/trend', params);
}

// =============================================================================
// Sessions API Functions (User Journey Analytics)
// =============================================================================

/**
 * Fetch paginated list of sessions with optional outcome filter
 * Uses cursor-based pagination for infinite scroll
 *
 * @param range - Time range filter (1d, 7d, 30d, 90d)
 * @param limit - Number of sessions per page (1-100, default 25)
 * @param cursor - Base64-encoded cursor for next page
 * @param outcome - Filter by session outcome
 */
export async function fetchSessionsList(
  range: TimeRange = '30d',
  limit: number = 25,
  cursor?: string,
  outcome?: SessionOutcome
): Promise<SessionsListResponse> {
  const params: Record<string, string> = {
    range,
    limit: String(Math.min(Math.max(limit, 1), 100)), // Clamp to 1-100
  };

  if (cursor) {
    params.cursor = cursor;
  }

  if (outcome) {
    params.outcome = outcome;
  }

  return apiRequest<SessionsListResponse>('/sessions/list', params);
}

/**
 * Fetch full session detail with event timeline
 * Returns all events in chronological order by step_number
 *
 * @param sessionId - The session ID to fetch
 */
export async function fetchSessionDetail(
  sessionId: string
): Promise<SessionDetailResponse> {
  // Validate session ID format (alphanumeric, underscores, hyphens)
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error('Invalid session ID format');
  }

  return apiRequest<SessionDetailResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Export analytics data as CSV (legacy - generic widget analytics)
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

/**
 * Export form submissions data as CSV
 * Exports the Recent Submissions table data with name, email, form type, etc.
 */
export async function exportFormSubmissionsData(
  range: TimeRange = '30d',
  formId?: string
): Promise<Blob> {
  // Fetch all submissions for the date range (up to 1000)
  const submissionsResponse = await fetchSubmissions(range, 1, 1000, formId);
  const submissions = submissionsResponse.submissions || [];

  // Transform submissions data for CSV export
  const csvData = submissions.map(submission => ({
    'Submission ID': submission.submission_id,
    'Name': submission.fields?.name || submission.fields?.full_name || 'Anonymous',
    'Email': submission.fields?.email || '',
    'Form': submission.form_label || submission.form_id,
    'Comments': submission.fields?.comments || submission.fields?.message || '',
    'Submitted Date': submission.submitted_date,
    'Submitted At': submission.submitted_at,
    'Session ID': submission.session_id || '',
    'Status': submission.status || '',
  }));

  // Use papaparse for proper CSV generation with UTF-8 BOM for Excel
  const csv = Papa.unparse(csvData, {
    header: true,
    quotes: true, // Quote all fields for safety
  });

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  return new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export conversations data as CSV using papaparse
 * Exports full sessions list for the date range
 */
export async function exportConversationsData(range: TimeRange = '30d'): Promise<Blob> {
  // Fetch all sessions (up to 1000) for export
  const sessionsResponse = await fetchSessionsList(range, 100);
  const sessions = sessionsResponse.sessions || [];

  // Transform sessions data for CSV export
  const csvData = sessions.map(session => ({
    'Session ID': session.session_id,
    'Started At': session.started_at,
    'Ended At': session.ended_at || '',
    'Duration (sec)': session.duration_seconds || 0,
    'First Question': session.first_question || '',
    'Message Count': session.message_count || 0,
    'User Messages': session.user_message_count || 0,
    'Bot Messages': session.bot_message_count || 0,
    'Outcome': session.outcome || '',
    'Form ID': session.form_id || '',
  }));

  // Use papaparse for proper CSV generation with UTF-8 BOM for Excel
  const csv = Papa.unparse(csvData, {
    header: true,
    quotes: true, // Quote all fields for safety
  });

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  return new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export conversations summary data as CSV (legacy format)
 * Includes summary metrics, top questions, heatmap, and recent conversations
 */
export async function exportConversationsSummaryData(range: TimeRange = '30d'): Promise<Blob> {
  const [summary, heatmap, topQuestions, recent] = await Promise.all([
    fetchConversationSummary(range),
    fetchConversationHeatmap(range),
    fetchTopQuestions(range),
    fetchRecentConversations(range),
  ]);

  // Build CSV content
  const csvRows: string[] = [];

  // Summary section (metrics are nested under 'metrics' property)
  const metrics = summary?.metrics;
  csvRows.push('CONVERSATION SUMMARY');
  csvRows.push('Metric,Value');
  csvRows.push(`Total Conversations,${metrics?.total_conversations ?? 0}`);
  csvRows.push(`Total Messages,${metrics?.total_messages ?? 0}`);
  csvRows.push(`Avg Response Time (sec),${(metrics?.avg_response_time_seconds ?? 0).toFixed(2)}`);
  csvRows.push(`After Hours %,${(metrics?.after_hours_percentage ?? 0).toFixed(1)}%`);
  csvRows.push('');

  // Top Questions section
  csvRows.push('TOP QUESTIONS');
  csvRows.push('Question,Count,Percentage');
  (topQuestions?.questions ?? []).forEach(q => {
    // Escape quotes in question text for CSV
    const escapedQuestion = (q.question_text ?? '').replace(/"/g, '""');
    csvRows.push(`"${escapedQuestion}",${q.count ?? 0},${(q.percentage ?? 0).toFixed(1)}%`);
  });
  csvRows.push('');

  // Heatmap section
  csvRows.push('ACTIVITY HEATMAP');
  csvRows.push('Hour,Mon,Tue,Wed,Thu,Fri,Sat,Sun');
  (heatmap?.heatmap ?? []).forEach((row: { hour_block: string; data: Array<{ value: number }> }) => {
    const values = (row.data ?? []).map((d: { value: number }) => d.value ?? 0);
    csvRows.push(`${row.hour_block},${values.join(',')}`);
  });
  csvRows.push('');

  // Recent Conversations section
  csvRows.push('RECENT CONVERSATIONS');
  csvRows.push('Session ID,Started At,Topic,First Question,Messages,Response Time,Outcome');
  (recent?.conversations ?? []).forEach(c => {
    const escapedQuestion = (c.first_question ?? '').replace(/"/g, '""');
    csvRows.push(`${c.session_id},"${c.started_at}",${c.topic || ''},"${escapedQuestion}",${c.message_count ?? 0},${(c.response_time_seconds ?? 0).toFixed(2)},${c.outcome || ''}`);
  });

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  return new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
}

/**
 * Fetch dashboard feature flags for the authenticated tenant
 */
export async function fetchFeatures(): Promise<FeaturesResponse> {
  return apiRequest<FeaturesResponse>('/features');
}

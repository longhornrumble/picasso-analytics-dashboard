/**
 * Analytics API Service
 * Communicates with the Analytics_Dashboard_API Lambda
 */

import Papa from 'papaparse';
import type {
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
  TenantOption,
  // Lead Workspace types
  PipelineStatus,
  LeadDetailResponse,
  StatusUpdateResponse,
  NotesUpdateResponse,
  LeadQueueResponse,
  ReactivateLeadResponse,
  // Notifications types
  NotificationSummary,
  NotificationEvent,
  NotificationSettingsResponse,
  TemplatePreviewResponse,
  NotificationEventLifecycle,
  // Team Management types (Phase 3)
  TeamMembersResponse,
  TeamInvitationsResponse,
  TeamMemberRole,
  // Notification Preferences types (Phase 4)
  NotificationPreferences,
  PreferencesResponse,
  // Super Admin Portal types
  AdminTenant,
  AdminEmployee,
  StripeBillingEvent,
} from '../types/analytics';

// API endpoint - configurable via environment variable
const API_BASE_URL = import.meta.env.VITE_ANALYTICS_API_URL ||
  'https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws';

// Tenant override for super admin tenant switching
let _tenantOverride: string | null = null;

/**
 * Set tenant override for super admin viewing other tenants
 * Pass null to clear and use JWT tenant
 */
export function setTenantOverride(tenantId: string | null): void {
  _tenantOverride = tenantId;
}

/**
 * Get current tenant override
 */
export function getTenantOverride(): string | null {
  return _tenantOverride;
}

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('analytics_token');
}

/**
 * Build headers for API requests, including tenant override if set
 */
function buildHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (_tenantOverride) {
    headers['X-Tenant-Override'] = _tenantOverride;
  }

  return headers;
}

/**
 * Build headers for admin API requests — deliberately omits X-Tenant-Override
 * so a super admin's active tenant override never bleeds into admin endpoints.
 */
function buildAdminHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Deliberately omit X-Tenant-Override for admin endpoints
  return headers;
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
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Make authenticated POST request
 */
async function apiPost<T>(
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Make authenticated PATCH request
 */
async function apiPatch<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}


async function apiDelete<T>(endpoint: string): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
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
 * @param range - Time range filter (1d, 7d, 30d, 90d, custom)
 * @param limit - Number of sessions per page (1-100, default 25)
 * @param cursor - Base64-encoded cursor for next page
 * @param outcome - Filter by session outcome
 * @param dateRangeOptions - Custom date range options
 */
export async function fetchSessionsList(
  range: TimeRange = '30d',
  limit: number = 25,
  cursor?: string,
  outcome?: SessionOutcome,
  dateRangeOptions?: DateRangeOptions
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

  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
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

/**
 * Fetch list of tenants for super_admin tenant switching
 * Only returns data for users with super_admin role.
 * Maps camelCase AdminTenant response to legacy TenantOption shape for the tenant switcher.
 */
export async function fetchTenantList(): Promise<TenantOption[]> {
  const response = await apiRequest<{ tenants: AdminTenant[] }>('/admin/tenants');
  return response.tenants.map(t => ({
    tenant_id: t.tenantId,
    tenant_hash: t.tenantHash,
    name: t.companyName,
  }));
}

// =============================================================================
// Admin Panel (Super Admin)
// =============================================================================

export async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const url = `${API_BASE_URL}/admin/tenants`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch admin tenants: ${response.status}`);
  }
  const data = await response.json();
  return data.tenants;
}

export async function fetchAdminTenantDetail(tenantId: string): Promise<AdminTenant> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch tenant detail: ${response.status}`);
  }
  return response.json();
}

export async function updateAdminTenant(
  tenantId: string,
  fields: Partial<Pick<AdminTenant, 'status' | 'subscriptionTier' | 'networkId' | 'networkName'>>
): Promise<AdminTenant> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildAdminHeaders(),
    body: JSON.stringify(fields),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to update tenant: ${response.status}`);
  }
  return response.json();
}

export async function fetchAdminTenantBilling(tenantId: string): Promise<StripeBillingEvent[]> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}/billing`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch billing: ${response.status}`);
  }
  const data = await response.json();
  return data.events;
}

export async function fetchAdminTenantEmployees(tenantId: string): Promise<AdminEmployee[]> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}/employees`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch employees: ${response.status}`);
  }
  const data = await response.json();
  return data.employees;
}

export async function fetchAdminEmployees(params?: { tenant_id?: string; search?: string }): Promise<{ employees: AdminEmployee[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.tenant_id) searchParams.set('tenant_id', params.tenant_id);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  const url = `${API_BASE_URL}/admin/employees${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch employees: ${response.status}`);
  }
  return response.json();
}

export async function inviteAdminEmployee(tenantId: string, email: string, role: string): Promise<{ invitation_id: string; email: string; role: string; status: string }> {
  const url = `${API_BASE_URL}/admin/employees/invite`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ tenant_id: tenantId, email, role }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to invite employee: ${response.status}`);
  }
  return response.json();
}

export async function updateAdminEmployee(tenantId: string, employeeId: string, fields: { role?: string; status?: string }): Promise<unknown> {
  const url = `${API_BASE_URL}/admin/employees/${tenantId}/${employeeId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildAdminHeaders(),
    body: JSON.stringify(fields),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to update employee: ${response.status}`);
  }
  return response.json();
}

export async function addAdminEmployee(tenantId: string, data: { name: string; email: string; role: string; phone?: string; notificationPrefs?: AdminEmployee['notificationPrefs'] }): Promise<{ employee_id: string; email: string; name: string; type: string }> {
  const url = `${API_BASE_URL}/admin/employees/add`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ tenant_id: tenantId, ...data }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to add contact: ${response.status}`);
  }
  return response.json();
}

export async function addTeamContact(data: { name: string; email: string; role?: string; phone?: string; notificationPrefs?: AdminEmployee['notificationPrefs'] }): Promise<{ employee_id: string; email: string; name: string; type: string }> {
  return apiPost<{ employee_id: string; email: string; name: string; type: string }>('/team/contacts', data);
}

export async function fetchAdminTenantInvitations(tenantId: string): Promise<{ invitation_id: string; email: string; role: string; status: string; created_at: string; tenant_id: string }[]> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}/invitations`;
  const response = await fetch(url, { headers: buildAdminHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to fetch invitations: ${response.status}`);
  }
  const data = await response.json();
  return data.invitations;
}

export async function revokeAdminTenantInvitation(tenantId: string, invitationId: string): Promise<void> {
  const url = `${API_BASE_URL}/admin/tenants/${tenantId}/invitations/${invitationId}/revoke`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildAdminHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to revoke invitation: ${response.status}`);
  }
}

// =============================================================================
// Lead Workspace API Functions (High-Velocity Lead Processing)
// =============================================================================

/**
 * Fetch full lead details for the Lead Workspace drawer
 * Returns all form fields, pipeline status, and internal notes
 *
 * @param submissionId - The submission ID (e.g., "volunteer_apply_1704067200000")
 */
export async function fetchLeadDetail(
  submissionId: string
): Promise<LeadDetailResponse> {
  // Validate submission ID format
  if (!submissionId || !/^[a-zA-Z0-9_-]+$/.test(submissionId)) {
    throw new Error('Invalid submission ID format');
  }

  return apiRequest<LeadDetailResponse>(`/leads/${encodeURIComponent(submissionId)}`);
}

/**
 * Update lead pipeline status
 * Automatically sets contacted_at when status → 'contacted'
 * Automatically sets archived_at when status → 'archived'
 *
 * @param submissionId - The submission ID to update
 * @param pipelineStatus - New pipeline status
 */
export async function updateLeadStatus(
  submissionId: string,
  pipelineStatus: PipelineStatus
): Promise<StatusUpdateResponse> {
  if (!submissionId || !/^[a-zA-Z0-9_-]+$/.test(submissionId)) {
    throw new Error('Invalid submission ID format');
  }

  return apiPatch<StatusUpdateResponse>(
    `/leads/${encodeURIComponent(submissionId)}/status`,
    { pipeline_status: pipelineStatus }
  );
}

/**
 * Update lead internal notes
 * Supports incremental updates with debounced autosave
 *
 * @param submissionId - The submission ID to update
 * @param internalNotes - New internal notes content
 */
export async function updateLeadNotes(
  submissionId: string,
  internalNotes: string
): Promise<NotesUpdateResponse> {
  if (!submissionId || !/^[a-zA-Z0-9_-]+$/.test(submissionId)) {
    throw new Error('Invalid submission ID format');
  }

  return apiPatch<NotesUpdateResponse>(
    `/leads/${encodeURIComponent(submissionId)}/notes`,
    { internal_notes: internalNotes }
  );
}

/**
 * Reactivate an archived lead
 * Restores lead from archive to 'new' status with system audit note
 *
 * Per PRD: Emerald Lead Reactivation Engine v4.2.1
 * - Idempotency: Returns success with reactivated=false if already active
 * - Audit Trail: Backend prepends [System] restoration note
 *
 * @param submissionId - The submission ID to reactivate
 */
export async function reactivateLead(
  submissionId: string
): Promise<ReactivateLeadResponse> {
  if (!submissionId || !/^[a-zA-Z0-9_-]+$/.test(submissionId)) {
    throw new Error('Invalid submission ID format');
  }

  return apiPatch<ReactivateLeadResponse>(
    `/leads/${encodeURIComponent(submissionId)}/reactivate`,
    {}
  );
}

/**
 * Fetch lead queue for navigation
 * Returns the next lead ID for "Next Lead" button
 *
 * @param status - Optional filter by pipeline status (default: 'new')
 * @param currentId - Current lead ID to find next after
 */
export async function fetchLeadQueue(
  status?: PipelineStatus,
  currentId?: string
): Promise<LeadQueueResponse> {
  const params: Record<string, string> = {};

  if (status) {
    params.status = status;
  }

  if (currentId) {
    params.current_id = currentId;
  }

  return apiRequest<LeadQueueResponse>('/leads/queue', params);
}

// =============================================================================
// Notifications API Functions
// =============================================================================

/**
 * Fetch notification summary metrics for the given time range
 * Returns aggregated delivery stats: sent, delivered, bounced, opened, etc.
 *
 * @param range - Time range filter (1d, 7d, 30d, 90d)
 */
export async function fetchNotificationSummary(
  range: string = '7d',
  dateRangeOptions?: DateRangeOptions
): Promise<NotificationSummary> {
  const params: Record<string, string> = { range };
  if (dateRangeOptions?.startDate) {
    params.start_date = dateRangeOptions.startDate;
  }
  if (dateRangeOptions?.endDate) {
    params.end_date = dateRangeOptions.endDate;
  }
  return apiRequest<NotificationSummary>('/notifications/summary', params);
}

/**
 * Fetch paginated notification events with optional filters
 *
 * @param params.range   - Time range (default '7d')
 * @param params.page    - Page number (default 1)
 * @param params.limit   - Items per page (default 25)
 * @param params.channel - Filter by channel (email, sms)
 * @param params.status  - Filter by event type / status
 * @param params.search  - Search by recipient address
 */
export async function fetchNotificationEvents(params: {
  range?: string;
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  email_type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ events: NotificationEvent[]; total: number; page: number; has_more: boolean }> {
  const queryParams: Record<string, string> = {
    range: params.range ?? '7d',
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 25),
  };

  if (params.channel) {
    queryParams.channel = params.channel;
  }
  if (params.status) {
    queryParams.status = params.status;
  }
  if (params.email_type) {
    queryParams.email_type = params.email_type;
  }
  if (params.search) {
    queryParams.search = params.search;
  }
  if (params.startDate) {
    queryParams.start_date = params.startDate;
  }
  if (params.endDate) {
    queryParams.end_date = params.endDate;
  }

  return apiRequest<{ events: NotificationEvent[]; total: number; page: number; has_more: boolean }>(
    '/notifications/events',
    queryParams
  );
}

// =============================================================================
// Notification Settings & Templates API Functions (Phase 2b/2c)
// =============================================================================

/**
 * Fetch all form notification settings (recipients, channels, enabled flags)
 */
export async function fetchNotificationSettings(): Promise<NotificationSettingsResponse> {
  return apiRequest<NotificationSettingsResponse>('/settings/notifications');
}

/**
 * Update notification settings for a single form
 *
 * @param formId - The form ID to update
 * @param notifications - Partial notifications object (internal / applicant_confirmation)
 */
export async function updateNotificationSettings(
  formId: string,
  notifications: Record<string, unknown>
): Promise<unknown> {
  return apiPatch<unknown>('/settings/notifications', { form_id: formId, notifications });
}

/**
 * Send a test notification email to the given address for the given form
 *
 * @param email   - Recipient email address
 * @param formId  - Form ID to use as context for the test
 */
export async function sendTestNotification(email: string, formId: string, userId?: string): Promise<unknown> {
  return apiPost<unknown>('/settings/notifications/recipients/test-send', {
    ...(userId ? { user_id: userId } : { email }),
    form_id: formId,
  });
}

/**
 * Fetch all form notification templates (subject + body for each form)
 */
export async function fetchNotificationTemplates(): Promise<NotificationSettingsResponse> {
  return apiRequest<NotificationSettingsResponse>('/settings/notifications/templates');
}

/**
 * Update notification templates for a single form
 *
 * @param formId    - The form ID whose templates to update
 * @param templates - Partial template fields (subject, body_template, etc.)
 */
export async function updateNotificationTemplate(
  formId: string,
  templates: Record<string, unknown>
): Promise<unknown> {
  return apiPatch<unknown>(`/settings/notifications/templates/${encodeURIComponent(formId)}`, templates);
}

/**
 * Preview a rendered notification template (returns HTML)
 *
 * @param formId       - The form ID
 * @param templateType - 'internal' | 'applicant_confirmation'
 */
export async function previewTemplate(
  formId: string,
  templateType: string
): Promise<TemplatePreviewResponse> {
  return apiPost<TemplatePreviewResponse>(
    `/settings/notifications/templates/${encodeURIComponent(formId)}/preview`,
    { template_type: templateType }
  );
}

/**
 * Send a test email using the current templates for the given form
 * Sends to the authenticated user's email address
 *
 * @param formId - The form ID whose templates to test
 */
export async function sendTestTemplate(formId: string, templateType: string = 'internal'): Promise<unknown> {
  return apiPost<unknown>(
    `/settings/notifications/templates/${encodeURIComponent(formId)}/test-send`,
    { template_type: templateType }
  );
}

// ---------------------------------------------------------------------------
// Notification event detail (lifecycle for a single message)
// ---------------------------------------------------------------------------

export async function fetchNotificationEventDetail(messageId: string): Promise<NotificationEventLifecycle> {
  return apiRequest<NotificationEventLifecycle>(`/notifications/events/${encodeURIComponent(messageId)}`);
}

// =============================================================================
// Team Management API Functions (Phase 3)
// =============================================================================

export async function fetchTeamMembers(): Promise<TeamMembersResponse> {
  return apiRequest<TeamMembersResponse>('/team/members');
}

export async function inviteTeamMember(email: string, role: TeamMemberRole): Promise<{ invitation_id: string; email: string; role: string; status: string }> {
  return apiPost<{ invitation_id: string; email: string; role: string; status: string }>('/team/invite', { email, role });
}

export async function fetchTeamInvitations(): Promise<TeamInvitationsResponse> {
  return apiRequest<TeamInvitationsResponse>('/team/invitations');
}

export async function revokeTeamInvitation(invitationId: string): Promise<{ invitation_id: string; revoked: boolean }> {
  return apiPost<{ invitation_id: string; revoked: boolean }>(`/team/invitations/${encodeURIComponent(invitationId)}/revoke`, {});
}

export async function updateTeamMemberRole(membershipId: string, role: TeamMemberRole): Promise<{ membership_id: string; role: string; updated: boolean }> {
  return apiPatch<{ membership_id: string; role: string; updated: boolean }>(`/team/members/${encodeURIComponent(membershipId)}`, { role });
}

export async function removeTeamMember(membershipId: string): Promise<{ membership_id: string; removed: boolean }> {
  return apiDelete<{ membership_id: string; removed: boolean }>(`/team/members/${encodeURIComponent(membershipId)}`);
}

// Profile management handled by Clerk's UserButton modal — no portal API needed

// =============================================================================
// Notification Preferences API Functions (Phase 4)
// =============================================================================

export async function fetchPreferences(): Promise<PreferencesResponse> {
  return apiRequest<PreferencesResponse>('/preferences');
}

export async function updatePreferences(
  prefs: Partial<NotificationPreferences>
): Promise<PreferencesResponse> {
  return apiPatch<PreferencesResponse>('/preferences', prefs as Record<string, unknown>);
}

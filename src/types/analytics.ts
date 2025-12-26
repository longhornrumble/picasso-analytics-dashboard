/**
 * Analytics Dashboard Types
 * Matches the Analytics_Dashboard_API Lambda responses
 */

// Time range options
export type TimeRange = '1d' | '7d' | '30d' | '90d';

// API Response Types
export interface SummaryMetrics {
  total_sessions: number;
  total_events: number;
  widget_opens: number;
  forms_started: number;
  forms_completed: number;
  chip_clicks: number;
  cta_clicks: number;
  conversion_rate: number;
}

export interface SummaryResponse {
  tenant_id: string;
  range: string;
  metrics: SummaryMetrics;
}

export interface SessionDataPoint {
  period: string;
  sessions: number;
  events: number;
}

export interface SessionsResponse {
  tenant_id: string;
  range: string;
  granularity: string;
  data: SessionDataPoint[];
}

export interface EventBreakdown {
  type: string;
  count: number;
  unique_sessions: number;
}

export interface EventsResponse {
  tenant_id: string;
  range: string;
  events: EventBreakdown[];
}

export interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}

export interface FunnelResponse {
  tenant_id: string;
  range: string;
  funnel: FunnelStage[];
  overall_conversion: number;
}

// =============================================================================
// Forms API Response Types
// =============================================================================

export interface FormSummaryMetrics {
  form_views: number;
  forms_started: number;
  forms_completed: number;
  forms_abandoned: number;
  completion_rate: number;
  abandon_rate: number;
  avg_completion_time_seconds: number;
}

export interface FormSummaryResponse {
  tenant_id: string;
  range: string;
  metrics: FormSummaryMetrics;
}

export interface FieldBottleneckAPI {
  field_id: string;
  field_label: string;
  form_id: string | null;
  abandon_count: number;
  abandon_percentage: number;
  insight: string;
  recommendation: string;
}

export interface BottlenecksResponse {
  tenant_id: string;
  range: string;
  bottlenecks: FieldBottleneckAPI[];
  total_abandonments: number;
}

export interface FormSubmissionAPI {
  submission_id: string;
  session_id: string;
  form_id: string;
  form_label: string;
  submitted_at: string;
  submitted_date: string;
  duration_seconds: number;
  fields_completed: number;
  fields: Record<string, string>;
}

export interface SubmissionsResponse {
  tenant_id: string;
  range: string;
  submissions: FormSubmissionAPI[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
}

export interface FormPerformerAPI {
  form_id: string;
  form_label: string;
  views: number;
  started: number;
  completions: number;
  conversion_rate: number;
  abandon_rate: number;
  avg_completion_time_seconds: number;
  trend: 'trending' | 'stable' | 'low';
}

export interface TopPerformersResponse {
  tenant_id: string;
  range: string;
  forms: FormPerformerAPI[];
  total_completions: number;
}

// =============================================================================
// Dashboard-specific types (UI enriched / legacy)
// =============================================================================

export interface FormStats {
  id: string;
  name: string;
  submissions: number;
  conversionRate: number;
  trend: 'trending' | 'stable' | 'low';
}

export interface FieldBottleneck {
  fieldName: string;
  abandonRate: number;
  insight?: string;
  recommendation?: string;
}

export interface FormSubmission {
  id: string;
  name: string;
  email: string;
  formType: string;
  comments: string;
  date: string;
}

// Auth types
export interface User {
  tenant_id: string;
  tenant_hash: string;
  email?: string;
  name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Filter state
export interface FilterState {
  timeRange: TimeRange;
  formId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

// =============================================================================
// Conversations API Response Types
// =============================================================================

export interface ConversationSummaryMetrics {
  total_conversations: number;
  total_messages: number;
  avg_response_time_seconds: number;
  after_hours_percentage: number;
}

export interface ConversationSummaryResponse {
  tenant_id: string;
  range: string;
  metrics: ConversationSummaryMetrics;
  date_range: {
    start: string;
    end: string;
  };
}

export interface HeatmapCell {
  day: string;  // "Mon", "Tue", etc.
  value: number;
}

export interface HeatmapRow {
  hour_block: string;  // "12AM", "3AM", "6AM", etc.
  data: HeatmapCell[];
}

export interface HeatmapPeak {
  day: string;
  hour_block: string;
  count: number;
}

export interface HeatmapResponse {
  tenant_id: string;
  range: string;
  heatmap: HeatmapRow[];
  peak: HeatmapPeak | null;
  total_conversations: number;
}

export interface TopQuestion {
  question_text: string;
  count: number;
  percentage: number;
}

export interface TopQuestionsResponse {
  tenant_id: string;
  range: string;
  questions: TopQuestion[];
  total_questions: number;
}

export interface RecentConversation {
  session_id: string;
  started_at: string;
  topic: string;
  first_question: string;
  first_answer: string;
  response_time_seconds: number;
  message_count: number;
  outcome: string | null;
}

export interface RecentConversationsResponse {
  tenant_id: string;
  range: string;
  conversations: RecentConversation[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    has_next: boolean;
  };
}

export interface ConversationTrendPoint {
  period: string;  // "12am", "2am", etc. or "Dec 1", "Dec 2"
  value: number;
}

export interface ConversationTrendResponse {
  tenant_id: string;
  range: string;
  trend: ConversationTrendPoint[];
  legend: string;
}

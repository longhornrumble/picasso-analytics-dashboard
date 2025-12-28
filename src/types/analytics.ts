/**
 * Analytics Dashboard Types
 * Matches the Analytics_Dashboard_API Lambda responses
 */

// Time range options
export type TimeRange = '1d' | '7d' | '30d' | '90d' | 'custom';

// Custom date range for 'custom' time range
export interface CustomDateRange {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
}

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
  status?: string;  // Optional - e.g., 'pending_fulfillment', 'completed'
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
  phone?: string;
  formType: string;
  comments: string;
  date: string;
}

// Dashboard feature flags
export interface DashboardFeatures {
  dashboard_conversations: boolean;
  dashboard_forms: boolean;
  dashboard_attribution: boolean;
}

// Features API response
export interface FeaturesResponse {
  tenant_id: string;
  features: DashboardFeatures;
}

// Auth types
export interface User {
  tenant_id: string;
  tenant_hash: string;
  email?: string;
  name?: string;
  features?: DashboardFeatures;
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

// =============================================================================
// Session Timeline API Response Types (User Journey Analytics)
// =============================================================================

/** Valid session outcome values */
export type SessionOutcome =
  | 'form_completed'
  | 'cta_clicked'
  | 'link_clicked'
  | 'browsing'
  | 'abandoned';

/**
 * Discriminated union for session event payloads.
 * Each event type has specific payload fields for type-safe access.
 */
export type SessionEventPayload =
  | { type: 'WIDGET_OPENED'; trigger?: 'button' | 'auto' }
  | { type: 'MESSAGE_SENT'; content_preview: string; content_length?: number }
  | { type: 'MESSAGE_RECEIVED'; content_preview?: string; content_length?: number }
  | { type: 'CTA_CLICKED'; cta_id: string; cta_label: string; cta_action: string; triggers_form?: boolean }
  | { type: 'LINK_CLICKED'; url: string; link_text: string; link_domain: string; category: 'email' | 'phone' | 'web' }
  | { type: 'ACTION_CHIP_CLICKED'; chip_label: string; chip_value: string }
  | { type: 'FORM_STARTED'; form_id: string; form_label: string }
  | { type: 'FORM_COMPLETED'; form_id: string; form_label: string; duration_seconds: number; fields_completed: number }
  | { type: 'FORM_ABANDONED'; form_id: string; form_label?: string; last_field?: string; reason: string; fields_completed: number };

/** Supported session event types */
export type SessionEventType = SessionEventPayload['type'];

/** A single event in a session timeline */
export interface SessionEvent {
  step_number: number;
  event_type: SessionEventType;
  timestamp: string;
  payload: SessionEventPayload | null;
}

/** Session summary for list view */
export interface SessionSummary {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  outcome: SessionOutcome;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
  first_question: string | null;
  form_id?: string;
}

/** Pagination info for sessions list */
export interface SessionsPagination {
  limit: number;
  count: number;
  next_cursor: string | null;
  has_more: boolean;
}

/** API response for GET /sessions/list */
export interface SessionsListResponse {
  tenant_id: string;
  range: string;
  sessions: SessionSummary[];
  pagination: SessionsPagination;
  filters?: {
    outcome?: SessionOutcome;
  };
}

/** Session detail summary (computed from events) */
export interface SessionDetailSummary {
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
  outcome: SessionOutcome;
  first_question: string | null;
  form_id?: string;
}

/** API response for GET /sessions/{session_id} */
export interface SessionDetailResponse {
  session_id: string;
  tenant_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  summary: SessionDetailSummary;
  events: SessionEvent[];
  event_count: number;
}

// =============================================================================
// Lead Workspace Types (High-Velocity Lead Processing)
// =============================================================================

/** Pipeline status values for lead processing */
export type PipelineStatus = 'new' | 'reviewing' | 'contacted' | 'archived';

/** Submission type for badge coloring */
export type SubmissionType = 'volunteer' | 'donor' | 'general';

/** Extended form submission with pipeline data */
export interface LeadWorkspaceData extends FormSubmissionAPI {
  pipeline_status: PipelineStatus;
  internal_notes?: string;
  processed_by?: string;
  contacted_at?: string;
  archived_at?: string;
  submission_type: SubmissionType;
  /** Tenant name for email subject lines */
  tenant_name?: string;
  /** Program ID extracted from form */
  program_id?: string;
  /** Zip code extracted from form */
  zip_code?: string;
}

/** Parsed form field for display */
export interface ParsedFormField {
  label: string;          // Title Case converted
  value: string;          // Formatted value
  rawKey: string;         // Original snake_case key
  type: 'text' | 'email' | 'tel' | 'boolean' | 'array' | 'composite';
  isExpandable: boolean;  // For truncated values
}

/** API response for lead detail */
export interface LeadDetailResponse {
  lead: LeadWorkspaceData;
  tenant_name: string;    // For email subject
}

/** API response for status update */
export interface StatusUpdateResponse {
  ref_id: string;
  pipeline_status: PipelineStatus;
  updated_at: string;
}

/** API response for notes update */
export interface NotesUpdateResponse {
  ref_id: string;
  internal_notes: string;
  updated_at: string;
}

/** Lead queue for Next Lead navigation */
export interface LeadQueueResponse {
  next_lead_id: string | null;
  queue_count: number;
}

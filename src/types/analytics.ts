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

// Dashboard-specific types (UI enriched)
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

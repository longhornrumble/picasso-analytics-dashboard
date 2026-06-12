/**
 * Attribution API Types — C6 verbatim (FROZEN_CONTRACTS.md §C6, locked 2026-06-12)
 *
 * All fields are optional-tolerant: old/missing aggregate rows MUST NOT crash
 * any reader. Use ?? defaults everywhere (Schema Discipline rule).
 */

// ---------------------------------------------------------------------------
// Channel type (C2 canonical closed enum)
// ---------------------------------------------------------------------------
export type AttributionChannel = 'website' | 'messenger' | 'standalone' | 'campaign';

// ---------------------------------------------------------------------------
// C6 /attribution/summary response
// ---------------------------------------------------------------------------

export interface AttributionChannelEcosystem {
  channel: AttributionChannel;
  share_pct?: number | null;
  conversations?: number | null;
  leads?: number | null;
  rate?: number | null;
  /** true = n < 50, rate suppressed (C7 confidence floor) */
  rate_held?: boolean | null;
}

export interface AttributionEcosystem {
  total_conversations?: number | null;
  after_hours_pct?: number | null;
  channels?: AttributionChannelEcosystem[] | null;
}

export interface AttributionFunnel {
  reached?: number | null;
  conversations?: number | null;
  engaged?: number | null;
  applications?: number | null;
  leads?: number | null;
  rate?: number | null;
}

export interface AttributionTime {
  after_hours_conversations?: number | null;
  staff_hours?: number | null;
  work_weeks?: number | null;
  self_booked_pct?: number | null;
  median_first_response_minutes?: number | null;
}

export interface AttributionDelta {
  abs?: number | null;
  pct?: number | null;
}

export interface AttributionInsight {
  text?: string | null;
  rule_id?: string | null;
  held?: boolean | null;
}

export interface AttributionSummaryResponse {
  tenant_id?: string;
  month?: string;
  source?: string;
  ecosystem?: AttributionEcosystem | null;
  funnel?: AttributionFunnel | null;
  time?: AttributionTime | null;
  deltas?: Record<string, AttributionDelta> | null;
  insight?: AttributionInsight | null;
}

// ---------------------------------------------------------------------------
// C6 /attribution/channels/{channel} response
// ---------------------------------------------------------------------------

export interface AttributionEntryPoint {
  entry_point_id?: string | null;
  label?: string | null;
  campaign?: string | null;
  placement?: string | null;
  created_at?: string | null;
  short_link?: string | null;
  scans?: number | null;
  clicks?: number | null;
  conversations?: number | null;
  leads?: number | null;
  rate?: number | null;
  /** true = n < 50, rate suppressed (C7 confidence floor) */
  rate_held?: boolean | null;
  /** true = minted in the current month */
  is_new?: boolean | null;
}

export interface AttributionTopicCount {
  topic?: string | null;
  count?: number | null;
}

export interface AttributionResourceClick {
  url?: string | null;
  clicks?: number | null;
}

export interface AttributionTrendPoint {
  month?: string | null;
  conversations?: number | null;
  leads?: number | null;
}

export interface AttributionAdviceBox {
  text?: string | null;
  rule_id?: string | null;
  tier?: 'double_down' | 'worth_a_look' | 'too_early' | string | null;
}

export interface AttributionChannelResponse {
  tenant_id?: string;
  month?: string;
  source?: string;
  funnel?: AttributionFunnel | null;
  entry_points?: AttributionEntryPoint[] | null;
  topics?: AttributionTopicCount[] | null;
  resources?: AttributionResourceClick[] | null;
  trend?: AttributionTrendPoint[] | null;
  read?: AttributionAdviceBox | null;
  suggested_move?: AttributionAdviceBox | null;
}

// ---------------------------------------------------------------------------
// C6 /attribution/entry-points (C3 registry records)
// ---------------------------------------------------------------------------

export interface AttributionRegistryRecord {
  tenant_id?: string | null;
  entry_point_id?: string | null;
  label?: string | null;
  channel?: string | null;
  campaign?: string | null;
  placement?: string | null;
  target_type?: string | null;
  destination_url?: string | null;
  dub_link_id?: string | null;
  dub_short_link?: string | null;
  dub_key?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface AttributionEntryPointsResponse {
  entry_points?: AttributionRegistryRecord[] | null;
}

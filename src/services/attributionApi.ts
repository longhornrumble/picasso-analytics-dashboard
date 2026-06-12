/**
 * Attribution API Service
 * Routes: GET /attribution/summary, GET /attribution/channels/{channel},
 *         GET /attribution/entry-points
 *
 * Mirrors auth/base/error conventions of analyticsApi.ts exactly.
 * Ref: FROZEN_CONTRACTS.md §C6 (locked 2026-06-12).
 */

import type {
  AttributionSummaryResponse,
  AttributionChannelResponse,
  AttributionEntryPointsResponse,
  AttributionChannel,
} from '../types/attribution';

// Reuse the same base URL as analyticsApi.ts (CloudFront same-origin /api).
const API_BASE_URL = import.meta.env.VITE_ANALYTICS_API_URL || '/api';

// ---------------------------------------------------------------------------
// Auth helpers — mirrors analyticsApi.ts patterns exactly
// ---------------------------------------------------------------------------

function getAuthToken(): string | null {
  return localStorage.getItem('analytics_token');
}

function buildHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function attributionGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
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
    throw new Error((errorData as { error?: string }).error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * GET /attribution/summary?month=YYYY-MM
 * Returns ecosystem donut data, funnel, time/money band, deltas, insight.
 * Server returns 403 when dashboard_attribution flag is off (C6 lock).
 */
export async function getAttributionSummary(month: string): Promise<AttributionSummaryResponse> {
  return attributionGet<AttributionSummaryResponse>('/attribution/summary', { month });
}

/**
 * GET /attribution/channels/{channel}?month=YYYY-MM
 * Returns channel-scoped funnel, entry points, topics, resources, trend, advice.
 */
export async function getAttributionChannel(
  channel: AttributionChannel,
  month: string,
): Promise<AttributionChannelResponse> {
  return attributionGet<AttributionChannelResponse>(
    `/attribution/channels/${encodeURIComponent(channel)}`,
    { month },
  );
}

/**
 * GET /attribution/entry-points
 * Returns the full C3 registry record list for the authenticated tenant.
 */
export async function getEntryPoints(): Promise<AttributionEntryPointsResponse> {
  return attributionGet<AttributionEntryPointsResponse>('/attribution/entry-points');
}

/**
 * Shared Components Index
 *
 * Generic, reusable components for all Picasso dashboards:
 * - Forms Dashboard
 * - Conversations Dashboard
 * - Attribution Dashboard
 *
 * These components use CSS variables from @picasso/shared-styles
 * for consistent branding across all dashboards.
 */

// Page header with time range, filters, export
export { PageHeader, FilterDropdown } from './PageHeader';
export type { TimeRangeValue, TimeRangeOption } from './PageHeader';

// Funnel visualization
export { Funnel } from './Funnel';
export type { FunnelStage, FunnelStat } from './Funnel';

// Data table with pagination
export { DataTable, BadgeCell, TwoLineCell, TruncatedCell } from './DataTable';
export type { Column } from './DataTable';

// Ranked items grid
export { RankedCards, mapTrend } from './RankedCards';
export type { RankedItem, TrendType } from './RankedCards';

// Trend chart (time-series)
export { TrendChart, SimpleTrendChart } from './TrendChart';
export type { DataPoint, TrendLine } from './TrendChart';

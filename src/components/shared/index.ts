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
export type { Column, SortDirection } from './DataTable';

// Ranked items grid
export { RankedCards } from './RankedCards';
export type { RankedItem, TrendType } from './RankedCards';
export { mapTrend } from './rankedCardsHelpers';

// Trend chart (time-series)
export { TrendChart, SimpleTrendChart } from './TrendChart';
export type { DataPoint, TrendLine } from './TrendChart';

// Export dropdown for PDF/CSV downloads
export { ExportDropdown } from './ExportDropdown';
export type { ExportFormat, ExportOption } from './ExportDropdown';

// Date range picker
export { DateRangePicker } from './DateRangePicker';
export type { DateRange } from './DateRangePicker';

// Custom dropdown (styled replacement for native select)
export { Dropdown } from './Dropdown';
export type { DropdownOption } from './Dropdown';

// Date filter dropdown
export { DateFilter } from './DateFilter';
export type { DateFilterValue, DateFilterRange } from './DateFilter';

// Confirmation dialog (portal-based, reusable across pages)
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

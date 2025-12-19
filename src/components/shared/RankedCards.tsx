/**
 * RankedCards Component (Generic)
 * Reusable grid of ranked/performance cards with trends
 *
 * Used by: Forms Dashboard (Top Forms), Conversations Dashboard (Top Intents),
 *          Attribution Dashboard (Top Sources)
 */

import React from 'react';

export type TrendType = 'up' | 'stable' | 'down';

export interface RankedItem {
  id: string;
  name: string;
  /** Primary metric value (e.g., conversion rate, count) */
  primaryValue: number | string;
  /** Label for primary metric (e.g., "Conv.", "Sessions") */
  primaryLabel: string;
  /** Secondary metric (e.g., submission count) */
  secondaryValue?: number | string;
  /** Label for secondary metric */
  secondaryLabel?: string;
  /** Trend direction */
  trend?: TrendType;
}

interface RankedCardsProps<T extends RankedItem> {
  /** Title displayed in header */
  title: string;
  /** Summary stat in header (e.g., "521 Total Submissions") */
  summaryValue?: number | string;
  /** Label for summary stat */
  summaryLabel?: string;
  /** Items to display */
  items: T[];
  /** Grid columns (responsive) */
  columns?: 1 | 2 | 3 | 4;
  /** Card click handler */
  onCardClick?: (item: T) => void;
  /** Show "View All" card */
  showViewAll?: boolean;
  /** View All click handler */
  onViewAll?: () => void;
  /** View All label */
  viewAllLabel?: string;
  /** View All sublabel */
  viewAllSublabel?: string;
  /** Custom card renderer (overrides default) */
  renderCard?: (item: T) => React.ReactNode;
  /** Trend labels */
  trendLabels?: {
    up?: string;
    stable?: string;
    down?: string;
  };
}

const defaultTrendLabels = {
  up: 'Trending',
  stable: 'Stable',
  down: 'Low activity',
};

export function RankedCards<T extends RankedItem>({
  title,
  summaryValue,
  summaryLabel,
  items,
  columns = 3,
  onCardClick,
  showViewAll = true,
  onViewAll,
  viewAllLabel = 'View All',
  viewAllSublabel,
  renderCard,
  trendLabels = defaultTrendLabels,
}: RankedCardsProps<T>) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const getTrendIcon = (trend?: TrendType) => {
    switch (trend) {
      case 'up':
        return (
          <span className="text-green-500 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {trendLabels.up}
          </span>
        );
      case 'stable':
        return (
          <span className="text-gray-400 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            {trendLabels.stable}
          </span>
        );
      case 'down':
        return (
          <span className="text-red-400 flex items-center gap-1 text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {trendLabels.down}
          </span>
        );
      default:
        return null;
    }
  };

  const defaultCardRender = (item: T) => (
    <div
      key={item.id}
      className={`border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-sm transition-all ${
        onCardClick ? 'cursor-pointer' : ''
      }`}
      onClick={() => onCardClick?.(item)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm truncate flex-1">
          {item.name}
        </h4>
        <span className="text-sm font-semibold text-gray-700 ml-2">
          {item.primaryValue}
          {item.primaryLabel && ` ${item.primaryLabel}`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        {item.secondaryValue !== undefined && (
          <span className="text-xs text-gray-500">
            {item.secondaryValue} {item.secondaryLabel}
          </span>
        )}
        {getTrendIcon(item.trend)}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {summaryValue !== undefined && (
          <span className="text-sm text-green-500 font-medium">
            {typeof summaryValue === 'number' ? summaryValue.toLocaleString() : summaryValue}{' '}
            {summaryLabel}
          </span>
        )}
      </div>

      {/* Cards grid */}
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {items.map((item) => (
          renderCard ? (
            <React.Fragment key={item.id}>{renderCard(item)}</React.Fragment>
          ) : (
            defaultCardRender(item)
          )
        ))}

        {/* View All card */}
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50 transition-all flex flex-col items-center justify-center min-h-[80px]"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">{viewAllLabel}</span>
            {viewAllSublabel && (
              <span className="text-xs text-green-500">{viewAllSublabel}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Helper: Convert FormStats trend to generic TrendType
 */
export function mapTrend(trend: 'trending' | 'stable' | 'low'): TrendType {
  switch (trend) {
    case 'trending':
      return 'up';
    case 'low':
      return 'down';
    default:
      return 'stable';
  }
}

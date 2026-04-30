/**
 * RankedCards helpers — pure utility functions extracted out of
 * RankedCards.tsx so the component file only exports components
 * (satisfies react-refresh/only-export-components).
 */

import type { TrendType } from './RankedCards';

/**
 * Convert FormStats trend ('trending' | 'stable' | 'low') to the generic
 * RankedCards TrendType ('up' | 'stable' | 'down').
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

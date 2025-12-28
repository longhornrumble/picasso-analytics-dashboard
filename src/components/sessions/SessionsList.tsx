/**
 * SessionsList Component
 * Displays paginated list of sessions with infinite scroll and outcome filtering
 * Uses Intersection Observer for cursor-based pagination
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TimeRange, SessionSummary, SessionOutcome, SessionsListResponse } from '../../types/analytics';
import { fetchSessionsList } from '../../services/analyticsApi';
import { SessionCard, SessionCardSkeleton } from './SessionCard';
import { Dropdown } from '../shared';

interface SessionsListProps {
  timeRange: TimeRange;
  onSessionClick: (sessionId: string) => void;
  /** Optional mock data - when provided, API calls are skipped */
  mockSessions?: SessionSummary[];
}

/** Valid outcome filter values */
const OUTCOME_OPTIONS: { value: SessionOutcome | 'all'; label: string }[] = [
  { value: 'all', label: 'All Outcomes' },
  { value: 'form_completed', label: 'Form Completed' },
  { value: 'cta_clicked', label: 'CTA Clicked' },
  { value: 'link_clicked', label: 'Link Clicked' },
  { value: 'browsing', label: 'Browsing' },
  { value: 'abandoned', label: 'Abandoned' },
];

/** Number of sessions to fetch per page */
const PAGE_SIZE = 25;

export function SessionsList({ timeRange, onSessionClick, mockSessions }: SessionsListProps) {
  // Check if using mock data
  const useMockData = !!mockSessions;

  // State
  const [sessions, setSessions] = useState<SessionSummary[]>(mockSessions || []);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(!useMockData);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(!useMockData);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<SessionOutcome | 'all'>('all');

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load sessions from API
   */
  const loadSessions = useCallback(async (cursor?: string, reset = false) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const outcome = outcomeFilter === 'all' ? undefined : outcomeFilter;
      const response: SessionsListResponse = await fetchSessionsList(
        timeRange,
        PAGE_SIZE,
        cursor,
        outcome
      );

      if (reset) {
        setSessions(response.sessions);
      } else {
        setSessions(prev => [...prev, ...response.sessions]);
      }

      setNextCursor(response.pagination.next_cursor);
      setHasMore(response.pagination.has_more);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [timeRange, outcomeFilter]);

  /**
   * Reset and reload when filters change
   */
  useEffect(() => {
    // Skip API calls when using mock data
    if (useMockData) {
      // Apply outcome filter to mock data
      if (outcomeFilter === 'all') {
        setSessions(mockSessions || []);
      } else {
        setSessions((mockSessions || []).filter(s => s.outcome === outcomeFilter));
      }
      return;
    }

    setIsInitialLoad(true);
    setSessions([]);
    setNextCursor(null);
    setHasMore(true);
    loadSessions(undefined, true);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [timeRange, outcomeFilter, loadSessions, useMockData, mockSessions]);

  /**
   * Intersection Observer for infinite scroll
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && nextCursor) {
          loadSessions(nextCursor, false);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0,
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, nextCursor, loadSessions]);

  /**
   * Handle outcome filter change
   */
  const handleOutcomeChange = (value: string) => {
    setOutcomeFilter(value as SessionOutcome | 'all');
  };

  // Render loading skeletons for initial load
  if (isInitialLoad && isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
          <div className="w-40 h-9 bg-gray-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SessionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Render error state
  if (error && sessions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
          <Dropdown
            value={outcomeFilter}
            onChange={handleOutcomeChange}
            options={OUTCOME_OPTIONS}
          />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800 font-medium">Failed to load sessions</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => loadSessions(undefined, true)}
            className="mt-3 text-sm text-red-700 underline hover:text-red-900"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!isLoading && sessions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
          <Dropdown
            value={outcomeFilter}
            onChange={handleOutcomeChange}
            options={OUTCOME_OPTIONS}
          />
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-600 font-medium">No sessions found</p>
          <p className="text-gray-500 text-sm mt-1">
            {outcomeFilter !== 'all'
              ? `No sessions with "${outcomeFilter.replace('_', ' ')}" outcome in this time range.`
              : 'No chat sessions recorded in this time range.'}
          </p>
          {outcomeFilter !== 'all' && (
            <button
              onClick={() => setOutcomeFilter('all')}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Sessions
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({sessions.length}{hasMore ? '+' : ''})
          </span>
        </h3>
        <Dropdown
          value={outcomeFilter}
          onChange={handleOutcomeChange}
          options={OUTCOME_OPTIONS}
        />
      </div>

      {/* Sessions grid */}
      <div className="space-y-3">
        {sessions.map(session => (
          <SessionCard
            key={session.session_id}
            session={session}
            onClick={onSessionClick}
          />
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoading && !isInitialLoad && (
        <div className="space-y-3">
          <SessionCardSkeleton />
          <SessionCardSkeleton />
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* End of list indicator */}
      {!hasMore && sessions.length > 0 && (
        <p className="text-center text-sm text-gray-500 py-4">
          No more sessions to load
        </p>
      )}

      {/* Error during pagination */}
      {error && sessions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-red-700 text-sm">
            Error loading more sessions: {error}
          </p>
          <button
            onClick={() => loadSessions(nextCursor || undefined, false)}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SessionTimeline Component
 * Modal dialog displaying full session timeline with all events
 * Uses native <dialog> element for accessibility
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { SessionDetailResponse } from '../../types/analytics';
import { fetchSessionDetail } from '../../services/analyticsApi';
import { OutcomeBadge } from './OutcomeBadge';
import { SessionTimelineEvent } from './SessionTimelineEvent';

interface SessionTimelineProps {
  sessionId: string | null;
  onClose: () => void;
  /** Optional mock session detail - when provided, API calls are skipped */
  mockSessionDetail?: SessionDetailResponse | null;
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format ISO timestamp to readable date/time
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Skeleton loading state for timeline
 */
function TimelineSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-8 w-32 bg-gray-200 rounded-full" />
      </div>

      {/* Stats skeleton */}
      <div className="flex gap-6 mb-6">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>

      {/* Events skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionTimeline({ sessionId, onClose, mockSessionDetail }: SessionTimelineProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if using mock data
  const useMockData = mockSessionDetail !== undefined;

  /**
   * Load session detail when sessionId changes
   */
  const loadSession = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    setSession(null);

    try {
      const data = await fetchSessionDetail(id);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Open/close dialog when sessionId changes
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (sessionId) {
      dialog.showModal();
      // Use mock data if provided, otherwise fetch from API
      if (useMockData && mockSessionDetail) {
        setSession(mockSessionDetail);
        setIsLoading(false);
        setError(null);
      } else if (!useMockData) {
        loadSession(sessionId);
      }
    } else {
      dialog.close();
    }
  }, [sessionId, loadSession, useMockData, mockSessionDetail]);

  /**
   * Handle dialog close (ESC key or backdrop click)
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    const handleClick = (e: MouseEvent) => {
      // Close on backdrop click
      if (e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sessionId) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl p-0 backdrop:bg-black/50"
      aria-labelledby="session-timeline-title"
    >
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white rounded-t-xl">
          <h2 id="session-timeline-title" className="text-lg font-semibold text-gray-900">
            Session Timeline
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && <TimelineSkeleton />}

          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 text-center">
              <p className="text-danger-800 font-medium">Failed to load session</p>
              <p className="text-danger-600 text-sm mt-1">{error}</p>
              <button
                onClick={() => sessionId && loadSession(sessionId)}
                className="mt-3 text-sm text-danger-700 underline hover:text-danger-900"
              >
                Try again
              </button>
            </div>
          )}

          {session && !isLoading && (
            <>
              {/* Session summary header */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-500 font-mono mb-1">
                      {session.session_id}
                    </p>
                    <p className="text-sm text-gray-600">
                      Started: {formatDateTime(session.started_at)}
                    </p>
                  </div>
                  <OutcomeBadge outcome={session.summary.outcome} />
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-3">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Duration: <strong>{formatDuration(session.duration_seconds)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>
                      <strong>{session.summary.message_count}</strong> messages
                      <span className="text-gray-400 ml-1">
                        ({session.summary.user_message_count} user, {session.summary.bot_message_count} bot)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span><strong>{session.event_count}</strong> events</span>
                  </div>
                </div>

                {/* First question */}
                {session.summary.first_question && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">First Question</p>
                    <p className="text-sm text-gray-700">"{session.summary.first_question}"</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                {session.events.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No events recorded</p>
                ) : (
                  session.events.map((event, index) => (
                    <SessionTimelineEvent
                      key={`${event.step_number}-${event.event_type}`}
                      event={event}
                      isFirst={index === 0}
                      isLast={index === session.events.length - 1}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

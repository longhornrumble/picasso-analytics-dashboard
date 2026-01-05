/**
 * SessionCard Component
 * Displays a single session summary in a clickable card format
 */

import type { SessionSummary } from '../../types/analytics';
import { OutcomeBadge } from './OutcomeBadge';

interface SessionCardProps {
  session: SessionSummary;
  onClick: (sessionId: string) => void;
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format ISO timestamp to local time string
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format ISO timestamp to local date string
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const handleClick = () => {
    onClick(session.session_id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(session.session_id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      {/* Header row: Outcome badge + Time */}
      <div className="flex items-center justify-between mb-3">
        <OutcomeBadge outcome={session.outcome} size="sm" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{formatDate(session.started_at)}</span>
          <span className="text-gray-300">|</span>
          <span>{formatTime(session.started_at)}</span>
        </div>
      </div>

      {/* First question preview */}
      {session.first_question && (
        <p className="text-gray-700 text-sm mb-3 line-clamp-2">
          "{truncateText(session.first_question, 100)}"
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {/* Duration */}
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatDuration(session.duration_seconds)}</span>
        </div>

        {/* Message count */}
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>{session.message_count} messages</span>
        </div>

        {/* User vs Bot breakdown */}
        <div className="flex items-center gap-1 text-gray-400">
          <span>({session.user_message_count} user, {session.bot_message_count} bot)</span>
        </div>

        {/* Event count */}
        {session.event_count !== undefined && session.event_count > 0 && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>{session.event_count} events</span>
          </div>
        )}
      </div>

      {/* Session ID (for debugging/support) */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400 font-mono">
          {truncateText(session.session_id, 24)}
        </span>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for SessionCard
 */
export function SessionCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-6 w-28 bg-gray-200 rounded-full" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>

      {/* Question preview */}
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="h-4 w-12 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </div>

      {/* Session ID */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="h-3 w-32 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

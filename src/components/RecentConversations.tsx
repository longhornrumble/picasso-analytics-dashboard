/**
 * RecentConversations Component
 *
 * Displays recent Q&A pairs as expandable cards.
 * Shows timestamp, topic badge, question/answer preview, and response time.
 *
 * Based on Bubble mockup with conversation cards.
 */

import { useState } from 'react';
import type { RecentConversation } from '../types/analytics';

interface RecentConversationsProps {
  /** List of recent conversations */
  conversations: RecentConversation[];
  /** Total count for header */
  totalCount: number;
  /** Loading state */
  loading?: boolean;
  /** Called when user requests more */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Get badge color based on topic
 */
function getTopicColor(topic: string): string {
  const colors: Record<string, string> = {
    Volunteer: 'bg-primary-100 text-primary-700',
    Donation: 'bg-info-100 text-info-700',
    Events: 'bg-warning-100 text-warning-700',
    Services: 'bg-purple-100 text-purple-700',
    Supplies: 'bg-orange-100 text-orange-700',
    General: 'bg-gray-100 text-gray-700',
  };
  return colors[topic] || colors.General;
}

interface ConversationCardProps {
  conversation: RecentConversation;
}

function ConversationCard({ conversation }: ConversationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const answerPreview = conversation.first_answer.length > 150
    ? conversation.first_answer.slice(0, 150) + '...'
    : conversation.first_answer;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-primary-200 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
          {/* Timestamp */}
          <span className="text-xs text-gray-500">
            {formatTimestamp(conversation.started_at)}
          </span>
        </div>
        {/* Topic badge */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTopicColor(conversation.topic)}`}>
          {conversation.topic}
        </span>
      </div>

      {/* Question */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-900">
          {conversation.first_question}
        </p>
      </div>

      {/* Answer */}
      <div className="mb-3">
        <p className="text-sm text-gray-600">
          {expanded ? conversation.first_answer : answerPreview}
        </p>
        {conversation.first_answer.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary-600 hover:text-primary-700 mt-1 font-medium"
          >
            {expanded ? 'Show less' : 'Show full answer'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {conversation.response_time_seconds.toFixed(1)}s response
        </span>
        <span>{conversation.message_count} messages</span>
      </div>
    </div>
  );
}

export function RecentConversations({
  conversations,
  totalCount,
  loading = false,
  onLoadMore,
  hasMore = false,
}: RecentConversationsProps) {
  if (loading && conversations.length === 0) {
    return (
      <div className="card-analytical">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="card-analytical">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Conversations</h3>
        <div className="flex items-center justify-center h-48 text-gray-400">
          No recent conversations
        </div>
      </div>
    );
  }

  return (
    <div className="card-analytical">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Conversations</h3>
        <span className="text-sm text-gray-600 font-medium">
          {totalCount.toLocaleString()} Q&A pairs
        </span>
      </div>

      {/* Conversation Cards */}
      <div className="space-y-3">
        {conversations.map((conversation) => (
          <ConversationCard key={conversation.session_id} conversation={conversation} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more conversations'}
          </button>
        </div>
      )}
    </div>
  );
}

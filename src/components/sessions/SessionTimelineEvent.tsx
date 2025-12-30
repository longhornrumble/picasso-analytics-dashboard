/**
 * SessionTimelineEvent Component
 * Displays a single event in the session timeline with icon, timestamp, and payload details
 */

import type { ReactNode } from 'react';
import type { SessionEvent } from '../../types/analytics';

interface SessionTimelineEventProps {
  event: SessionEvent;
  isFirst?: boolean;
  isLast?: boolean;
}

/**
 * AI Sparkles icon for bot responses (3 four-pointed stars)
 */
const AISparklesIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#7c3aed">
    {/* Large center sparkle */}
    <path d="M12 3L13.5 9.5L20 12L13.5 14.5L12 21L10.5 14.5L4 12L10.5 9.5L12 3Z" />
    {/* Top-right small sparkle */}
    <path d="M19 2L19.75 5L22 6L19.75 7L19 10L18.25 7L16 6L18.25 5L19 2Z" opacity="0.6" />
    {/* Bottom-left small sparkle */}
    <path d="M6 14L6.75 17L9 18L6.75 19L6 22L5.25 19L3 18L5.25 17L6 14Z" opacity="0.6" />
  </svg>
);

/**
 * Event type configuration with icons and colors
 */
const EVENT_CONFIG: Record<string, {
  icon: string | ReactNode;
  label: string;
  bgClass: string;
  borderClass: string;
}> = {
  WIDGET_OPENED: {
    icon: '\uD83D\uDCAC', // 💬
    label: 'Widget Opened',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-300',
  },
  MESSAGE_SENT: {
    icon: '\uD83D\uDC64', // 👤
    label: 'User Message',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-300',
  },
  MESSAGE_RECEIVED: {
    icon: <AISparklesIcon />,
    label: 'AI Response',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-300',
  },
  CTA_CLICKED: {
    icon: '\uD83D\uDD18', // 🔘
    label: 'CTA Clicked',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-400',
  },
  LINK_CLICKED: {
    icon: '\uD83D\uDD17', // 🔗
    label: 'Link Clicked',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-400',
  },
  ACTION_CHIP_CLICKED: {
    icon: '\uD83C\uDFF7\uFE0F', // 🏷️
    label: 'Action Chip',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-300',
  },
  FORM_STARTED: {
    icon: '\uD83D\uDCDD', // 📝
    label: 'Form Started',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-400',
  },
  FORM_COMPLETED: {
    icon: '\u2705', // ✅
    label: 'Form Completed',
    bgClass: 'bg-primary-100',
    borderClass: 'border-primary-400',
  },
  FORM_ABANDONED: {
    icon: '\u274C', // ❌
    label: 'Form Abandoned',
    bgClass: 'bg-danger-50',
    borderClass: 'border-danger-300',
  },
};

/**
 * Format timestamp to local time
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format duration in seconds
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

/**
 * Render payload details based on event type
 */
function PayloadDetails({ eventType, payload }: { eventType: string; payload: Record<string, unknown> | null }) {
  if (!payload) return null;

  switch (eventType) {
    case 'WIDGET_OPENED':
      return payload.trigger ? (
        <div className="text-xs text-gray-500">
          Trigger: <span className="font-medium">{String(payload.trigger)}</span>
        </div>
      ) : null;

    case 'MESSAGE_SENT':
      return payload.content_preview ? (
        <div className="mt-1">
          <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2 border-l-2 border-blue-400 max-h-32 overflow-y-auto">
            "{String(payload.content_preview)}"
          </p>
          {typeof payload.content_length === 'number' && payload.content_length > 100 && (
            <span className="text-xs text-gray-400 mt-1">
              ({payload.content_length} chars)
            </span>
          )}
        </div>
      ) : null;

    case 'MESSAGE_RECEIVED':
      return payload.content_preview ? (
        <div className="mt-1">
          <p className="text-sm text-gray-700 bg-purple-50 rounded-lg px-3 py-2 border-l-2 border-purple-400 max-h-32 overflow-y-auto">
            "{String(payload.content_preview)}"
          </p>
          {typeof payload.response_time_ms === 'number' && (
            <span className="text-xs text-gray-400 mt-1 block">
              Response time: {payload.response_time_ms}ms
            </span>
          )}
        </div>
      ) : null;

    case 'CTA_CLICKED':
      return (
        <div className="mt-1 space-y-1">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Button:</span>{' '}
            <span className="text-blue-600">"{String(payload.cta_label || '')}"</span>
          </div>
          <div className="text-xs text-gray-500">
            <span>Action: {String(payload.cta_action || '')}</span>
            {!!payload.triggers_form && (
              <span className="ml-2 text-yellow-600">→ Opens form</span>
            )}
          </div>
        </div>
      );

    case 'LINK_CLICKED':
      return (
        <div className="mt-1 space-y-1">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Link:</span>{' '}
            <span className="text-purple-600">"{String(payload.link_text || '')}"</span>
          </div>
          <div className="text-xs text-gray-500 break-all">
            <span>URL: {String(payload.url || '')}</span>
          </div>
          {!!payload.category && (
            <div className="text-xs">
              <span className="inline-flex items-center gap-1">
                {payload.category === 'email' && <span>📧</span>}
                {payload.category === 'phone' && <span>📞</span>}
                {payload.category === 'web' && <span>🌐</span>}
                <span className="text-gray-500">{String(payload.category)}</span>
              </span>
            </div>
          )}
        </div>
      );

    case 'ACTION_CHIP_CLICKED':
      return (
        <div className="mt-1">
          <span className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
            {String(payload.chip_label || '')}
          </span>
        </div>
      );

    case 'FORM_STARTED':
      return (
        <div className="mt-1 text-sm">
          <span className="font-medium text-gray-700">Form:</span>{' '}
          <span className="text-yellow-700">{String(payload.form_label || payload.form_id || '')}</span>
          {!!payload.form_id && (
            <span className="text-xs text-gray-400 ml-2">
              ({String(payload.form_id)})
            </span>
          )}
        </div>
      );

    case 'FORM_COMPLETED':
      return (
        <div className="mt-1 space-y-1">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Form:</span>{' '}
            <span className="text-primary-700">{String(payload.form_label || '')}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-3">
            {typeof payload.duration_seconds === 'number' && (
              <span>Duration: {formatDuration(payload.duration_seconds)}</span>
            )}
            {typeof payload.fields_completed === 'number' && (
              <span>Fields: {payload.fields_completed}</span>
            )}
          </div>
        </div>
      );

    case 'FORM_ABANDONED':
      return (
        <div className="mt-1 space-y-1">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Form:</span>{' '}
            <span className="text-danger-700">{String(payload.form_label || payload.form_id || '')}</span>
          </div>
          <div className="text-xs text-gray-500">
            {!!payload.last_field && (
              <span>Last field: {String(payload.last_field)} | </span>
            )}
            {!!payload.reason && <span>Reason: {String(payload.reason)} </span>}
            {typeof payload.fields_completed === 'number' && (
              <span>({payload.fields_completed} fields completed)</span>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function SessionTimelineEvent({
  event,
  isFirst = false,
  isLast = false,
}: SessionTimelineEventProps) {
  const config = EVENT_CONFIG[event.event_type] || {
    icon: '•',
    label: event.event_type,
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-300',
  };

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector line */}
      <div className="flex flex-col items-center">
        {/* Top line (hidden for first item) */}
        {!isFirst && (
          <div className="w-0.5 h-4 bg-gray-200" />
        )}
        {isFirst && <div className="h-4" />}

        {/* Event icon */}
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${config.bgClass} ${config.borderClass} text-lg`}
          title={config.label}
        >
          {config.icon}
        </div>

        {/* Bottom line (hidden for last item) */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 min-h-[1rem]" />
        )}
      </div>

      {/* Event content */}
      <div className={`flex-1 pb-4 ${isLast ? '' : 'border-b border-gray-100'}`}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900 text-sm">
            {config.label}
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(event.timestamp)}
          </span>
        </div>

        {/* Step number */}
        <div className="text-xs text-gray-400 mt-0.5">
          Step {event.step_number}
        </div>

        {/* Payload details */}
        <PayloadDetails eventType={event.event_type} payload={event.payload as Record<string, unknown> | null} />
      </div>
    </div>
  );
}

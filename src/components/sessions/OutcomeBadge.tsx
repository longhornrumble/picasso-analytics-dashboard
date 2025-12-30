/**
 * OutcomeBadge Component
 * Displays a color-coded badge for session outcome types
 */

import type { SessionOutcome } from '../../types/analytics';

interface OutcomeBadgeProps {
  outcome: SessionOutcome;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Outcome configuration with colors and labels
 */
const OUTCOME_CONFIG: Record<SessionOutcome, {
  label: string;
  bgClass: string;
  textClass: string;
  icon: string;
}> = {
  form_completed: {
    label: 'Form Completed',
    bgClass: 'bg-primary-100',
    textClass: 'text-primary-800',
    icon: '\u2705', // ✅
  },
  cta_clicked: {
    label: 'CTA Clicked',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    icon: '\uD83D\uDD18', // 🔘
  },
  link_clicked: {
    label: 'Link Clicked',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    icon: '\uD83D\uDD17', // 🔗
  },
  conversation: {
    label: 'Conversation',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
    icon: '\uD83D\uDCAC', // 💬
  },
  abandoned: {
    label: 'Abandoned',
    bgClass: 'bg-danger-100',
    textClass: 'text-danger-800',
    icon: '\u274C', // ❌
  },
};

/**
 * Size variants for the badge
 */
const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function OutcomeBadge({ outcome, size = 'md' }: OutcomeBadgeProps) {
  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.conversation;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgClass} ${config.textClass} ${sizeClass}`}
      title={config.label}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Compact version showing only the icon (for tight spaces)
 */
export function OutcomeBadgeIcon({ outcome }: { outcome: SessionOutcome }) {
  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.conversation;

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.bgClass}`}
      title={config.label}
    >
      <span aria-hidden="true">{config.icon}</span>
    </span>
  );
}

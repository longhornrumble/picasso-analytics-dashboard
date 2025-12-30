/**
 * useAnnounce - Screen reader announcements via ARIA live regions
 *
 * WCAG 4.1.3: Status Messages - Status updates must be announced
 * without receiving focus to inform assistive technology users.
 */

import { useCallback, useEffect, useRef } from 'react';

type Politeness = 'polite' | 'assertive';

interface AnnounceOptions {
  /** How urgently the message should be announced */
  politeness?: Politeness;
  /** Clear after this many ms (0 = never clear) */
  clearAfter?: number;
}

// Singleton container for live region
let liveRegionContainer: HTMLDivElement | null = null;

function ensureLiveRegion(): HTMLDivElement {
  if (!liveRegionContainer) {
    liveRegionContainer = document.createElement('div');
    liveRegionContainer.id = 'sr-announcements';
    liveRegionContainer.setAttribute('aria-live', 'polite');
    liveRegionContainer.setAttribute('aria-atomic', 'true');
    liveRegionContainer.setAttribute('role', 'status');
    // Visually hidden but accessible to screen readers
    Object.assign(liveRegionContainer.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      padding: '0',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(liveRegionContainer);
  }
  return liveRegionContainer;
}

/**
 * Hook that provides a function to announce messages to screen readers
 *
 * @example
 * ```tsx
 * const announce = useAnnounce();
 *
 * const handleSave = () => {
 *   announce('Changes saved successfully', { politeness: 'polite' });
 * };
 * ```
 */
export function useAnnounce() {
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const announce = useCallback(
    (message: string, options: AnnounceOptions = {}) => {
      const { politeness = 'polite', clearAfter = 5000 } = options;

      const region = ensureLiveRegion();

      // Update politeness if needed
      region.setAttribute('aria-live', politeness);

      // Clear any pending clear timeout
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }

      // Clear first, then set (forces re-announcement of same message)
      region.textContent = '';

      // Use requestAnimationFrame to ensure the clear is processed
      requestAnimationFrame(() => {
        region.textContent = message;

        // Clear after specified time
        if (clearAfter > 0) {
          clearTimeoutRef.current = setTimeout(() => {
            region.textContent = '';
          }, clearAfter);
        }
      });
    },
    []
  );

  return announce;
}

/**
 * Pre-built announcement messages for common actions
 */
export const announcements = {
  statusChanged: (newStatus: string) => `Pipeline status updated to ${newStatus}`,
  notesSaving: () => 'Saving notes...',
  notesSaved: () => 'Notes saved',
  leadArchived: () => 'Lead archived successfully',
  leadReactivated: () => 'Lead reactivated and returned to pipeline',
  drawerOpened: (leadName: string) => `Lead workspace opened for ${leadName}`,
  drawerClosed: () => 'Lead workspace closed',
  nextLeadLoaded: (leadName: string) => `Now viewing ${leadName}`,
  noMoreLeads: () => 'No more leads in queue',
} as const;

export default useAnnounce;

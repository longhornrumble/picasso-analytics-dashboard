/**
 * useFocusTrap - Traps focus within a container element
 *
 * WCAG 2.4.3: Focus Order - Focus must remain within modal dialogs
 * Uses centralized tokens from @picasso/shared-styles (see /picasso-shared-styles/README.md)
 */

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Element to focus when trap activates (defaults to first focusable) */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Element to return focus to when trap deactivates */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Callback when ESC is pressed */
  onEscape?: () => void;
}

/**
 * Hook that traps focus within a container element
 *
 * @example
 * ```tsx
 * const containerRef = useFocusTrap({
 *   isActive: isOpen,
 *   onEscape: handleClose,
 * });
 *
 * return <div ref={containerRef}>...</div>;
 * ```
 */
export function useFocusTrap({
  isActive,
  initialFocusRef,
  returnFocusRef,
  onEscape,
}: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => el.offsetParent !== null); // Filter out hidden elements
  }, []);

  // Handle Tab key to trap focus
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || !containerRef.current) return;

      // ESC key
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      // Tab key
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        // Shift+Tab from first element -> focus last
        if (e.shiftKey && activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab from last element -> focus first
        if (!e.shiftKey && activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
          return;
        }

        // If focus is outside container, bring it back
        if (!containerRef.current.contains(activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isActive, getFocusableElements, onEscape]
  );

  // Set up focus trap
  useEffect(() => {
    if (isActive) {
      // Store current active element for restoration
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus initial element or first focusable
      const timer = setTimeout(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else {
          const focusableElements = getFocusableElements();
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          }
        }
      }, 50); // Small delay to ensure DOM is ready

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      // Restore focus when trap deactivates
      const elementToFocus = returnFocusRef?.current || previousActiveElement.current;
      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        // Delay to ensure element is visible
        setTimeout(() => elementToFocus.focus(), 50);
      }
    }
  }, [isActive, initialFocusRef, returnFocusRef, handleKeyDown, getFocusableElements]);

  return containerRef;
}

export default useFocusTrap;

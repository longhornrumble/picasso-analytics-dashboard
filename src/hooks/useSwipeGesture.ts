/**
 * useSwipeGesture - Touch gesture detection for mobile interactions
 *
 * Supports swipe-to-close for drawers and other dismissible elements.
 * See PRD: Mobile responsive - swipe gestures
 */

import { useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  /** Whether gesture detection is active */
  isActive: boolean;
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  threshold?: number;
  /** Direction to detect: 'left', 'right', 'up', 'down' */
  direction: 'left' | 'right' | 'up' | 'down';
  /** Callback when swipe is detected */
  onSwipe: () => void;
  /** Optional callback during swipe with progress (0-1) */
  onSwipeProgress?: (progress: number) => void;
  /** Maximum swipe distance for progress calculation (default: 200) */
  maxSwipeDistance?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  swiping: boolean;
}

/**
 * Hook that detects swipe gestures on a container element
 *
 * @example
 * ```tsx
 * const containerRef = useSwipeGesture({
 *   isActive: isOpen,
 *   direction: 'right',
 *   onSwipe: handleClose,
 *   onSwipeProgress: (progress) => {
 *     // Optional: animate based on progress
 *     setTransform(`translateX(${progress * 100}%)`);
 *   },
 * });
 *
 * return <div ref={containerRef}>...</div>;
 * ```
 */
export function useSwipeGesture({
  isActive,
  threshold = 50,
  direction,
  onSwipe,
  onSwipeProgress,
  maxSwipeDistance = 200,
}: SwipeGestureOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    swiping: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      swiping: true,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchState.current.swiping) return;

      const touch = e.touches[0];
      touchState.current.currentX = touch.clientX;
      touchState.current.currentY = touch.clientY;

      const deltaX = touchState.current.currentX - touchState.current.startX;
      const deltaY = touchState.current.currentY - touchState.current.startY;

      // Calculate progress based on direction
      let progress = 0;
      switch (direction) {
        case 'right':
          progress = Math.max(0, Math.min(1, deltaX / maxSwipeDistance));
          break;
        case 'left':
          progress = Math.max(0, Math.min(1, -deltaX / maxSwipeDistance));
          break;
        case 'down':
          progress = Math.max(0, Math.min(1, deltaY / maxSwipeDistance));
          break;
        case 'up':
          progress = Math.max(0, Math.min(1, -deltaY / maxSwipeDistance));
          break;
      }

      // Call progress callback if provided
      if (onSwipeProgress && progress > 0) {
        onSwipeProgress(progress);
      }
    },
    [direction, maxSwipeDistance, onSwipeProgress]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchState.current.swiping) return;

    const deltaX = touchState.current.currentX - touchState.current.startX;
    const deltaY = touchState.current.currentY - touchState.current.startY;

    // Check if swipe meets threshold
    let triggered = false;
    switch (direction) {
      case 'right':
        triggered = deltaX > threshold;
        break;
      case 'left':
        triggered = deltaX < -threshold;
        break;
      case 'down':
        triggered = deltaY > threshold;
        break;
      case 'up':
        triggered = deltaY < -threshold;
        break;
    }

    if (triggered) {
      onSwipe();
    } else if (onSwipeProgress) {
      // Reset progress if swipe not completed
      onSwipeProgress(0);
    }

    touchState.current.swiping = false;
  }, [direction, threshold, onSwipe, onSwipeProgress]);

  const handleTouchCancel = useCallback(() => {
    touchState.current.swiping = false;
    if (onSwipeProgress) {
      onSwipeProgress(0);
    }
  }, [onSwipeProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isActive, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return containerRef;
}

export default useSwipeGesture;

/**
 * ToastProvider — positioning + lifecycle for the 'toast' placement of <Alert>.
 *
 * There is NO separate Toast component. A toast is just <Alert placement="toast">
 * rendered in a corner stack. The provider owns ONLY positioning + lifecycle
 * (auto-dismiss timer, hover/focus pause, enter/exit motion, the progress bar,
 * and the visible-stack cap); severity tokens, icons, title-always-with-icon and
 * the surface styling are all inherited from <Alert>. The context + useToast hook
 * live in ./useToast.
 *
 *   const toast = useToast();
 *   toast.success('Team saved');
 *   toast.error("Couldn't save team", { description: '…', action: { label: 'Retry', onClick } });
 *   toast(<Alert … />);            // escape hatch for full control
 *   const id = toast.info('…'); toast.dismiss(id);
 *
 * Mount <ToastProvider> ONCE at the app root (see App.tsx).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from './Alert';
import { ALERT_ACCENT } from './alertTokens';
import { ToastContext, type ToastApi, type ToastEntry, type ToastOptions } from './useToast';

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 3;
const EXIT_MS = 200; // must match the .toast-exit animation duration in index.css

export interface ToastProviderProps {
  children: ReactNode;
  /** @default 'bottom-right' */
  position?: 'bottom-right' | 'top-right';
}

export function ToastProvider({ children, position = 'bottom-right' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const add = (entry: Omit<ToastEntry, 'id'>): number => {
      const id = (idRef.current += 1);
      setToasts((list) => {
        const next = [...list, { ...entry, id }];
        // Cap the visible stack — drop the oldest when over the cap.
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
      return id;
    };
    const fn = ((node: ReactNode, opts: ToastOptions = {}) => add({ node, ...opts })) as ToastApi;
    fn.success = (title, opts) => add({ severity: 'success', title, ...opts });
    fn.error = (title, opts) => add({ severity: 'error', title, ...opts });
    fn.warning = (title, opts) => add({ severity: 'warning', title, ...opts });
    fn.info = (title, opts) => add({ severity: 'info', title, ...opts });
    fn.dismiss = dismiss;
    return fn;
  }, [dismiss]);

  const top = position === 'top-right';

  const stack = (
    <div
      className="fixed z-[9999] flex w-fit flex-col-reverse gap-[10px]"
      style={{ right: 20, [top ? 'top' : 'bottom']: 20 }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} entry={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' ? createPortal(stack, document.body) : null}
    </ToastContext.Provider>
  );
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const duration = entry.duration ?? DEFAULT_DURATION;
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);

  const exitingRef = useRef(false);
  const remainingRef = useRef(duration);
  const startRef = useRef(0);

  const beginExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    window.setTimeout(onDismiss, EXIT_MS);
  }, [onDismiss]);

  // Auto-dismiss timer. Pauses on hover/focus (banks remaining time), resumes on
  // leave/blur. Skipped entirely when duration <= 0 (sticky toast).
  useEffect(() => {
    if (duration <= 0 || paused || exiting) return;
    startRef.current = Date.now();
    const timer = window.setTimeout(beginExit, remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      if (!exitingRef.current) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
      }
    };
  }, [duration, paused, exiting, beginExit]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);
  const accent = ALERT_ACCENT[entry.severity ?? 'info'];

  return (
    <div
      className={`pointer-events-auto relative ${exiting ? 'toast-exit' : 'toast-enter'}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {entry.node ?? (
        <Alert
          placement="toast"
          severity={entry.severity ?? 'info'}
          title={entry.title ?? ''}
          description={entry.description}
          action={entry.action}
          dismissible={entry.dismissible ?? true}
          onDismiss={beginExit}
        />
      )}
      {duration > 0 && (
        <span
          className="toast-progress-bar absolute bottom-0 left-0 h-[2px] w-full rounded-b-[12px]"
          style={{ background: accent, animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

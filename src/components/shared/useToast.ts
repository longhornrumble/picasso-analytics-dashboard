/**
 * useToast — consumer hook + context for the toast placement of <Alert>.
 *
 * Lives in its own file (separate from <ToastProvider> in ToastProvider.tsx) so
 * Vite/React-Refresh can hot-reload the provider component without tripping
 * react-refresh/only-export-components (mirrors the AuthContext/useAuth split).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { AlertAction, AlertSeverity } from './Alert';

export interface ToastOptions {
  description?: ReactNode;
  action?: AlertAction;
  /** ms before auto-dismiss; default 4000; 0 = sticky (no auto-dismiss). */
  duration?: number;
  /** @default true */
  dismissible?: boolean;
}

export interface ToastApi {
  /** Escape hatch — render any node as a toast. */
  (node: ReactNode, opts?: ToastOptions): number;
  success: (title: string, opts?: ToastOptions) => number;
  error: (title: string, opts?: ToastOptions) => number;
  warning: (title: string, opts?: ToastOptions) => number;
  info: (title: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

/** A single live toast (severity/title form, or an escape-hatch custom node). */
export interface ToastEntry extends ToastOptions {
  id: number;
  severity?: AlertSeverity;
  title?: string;
  node?: ReactNode;
}

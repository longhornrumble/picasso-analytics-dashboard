/**
 * Alert — the single alert / notification primitive for the app.
 *
 * TWO ORTHOGONAL AXES (keep them orthogonal — do NOT fork a component per error):
 *   - severity ('error' | 'warning' | 'success' | 'info') → color + default icon
 *   - placement ('banner' | 'inline' | 'toast')           → layout / weight / motion
 * Any severity renders as any placement. The severity→token mapping lives in ONE
 * place (the SEVERITY record in alertTokens), so adding a severity is a single
 * edit and every Alert stays consistent. Color is NEVER the only signal — every
 * Alert renders an icon AND a text title (colorblind-safe; the design system's
 * disposition rule).
 *
 * DECISION GUIDE — which placement?
 *   - banner → page / account-wide failure, persistent until resolved (expired
 *              calendar token, billing, outage). Lives ABOVE page sections; can stick.
 *   - inline → field / section-scoped error or notice, persistent. Sits IN the card,
 *              right where it applies. A trailing <code> in `description` renders as a
 *              muted mono technical detail.
 *   - toast  → transient confirmation / non-blocking result ("Team saved"). Render via
 *              useToast() (see ToastProvider), not directly — the provider owns the
 *              timer, hover-pause, stacking and progress bar.
 */
import type { ReactNode } from 'react';
import { SEVERITY, type AlertSeverity, type SeverityTokens } from './alertTokens';

export type { AlertSeverity } from './alertTokens';
export type AlertPlacement = 'banner' | 'inline' | 'toast';

export interface AlertAction {
  label: string;
  onClick: () => void;
  /** Replaces `label` while `busy` is true (e.g. "Reconnecting…"). */
  busyLabel?: string;
}

export interface AlertProps {
  /** Color + default icon. @default 'info' */
  severity?: AlertSeverity;
  /** Layout / weight / motion. @default 'inline' */
  placement?: AlertPlacement;
  title: string;
  /** Supports a trailing muted mono <code> detail span. */
  description?: ReactNode;
  action?: AlertAction;
  /** Shows a spinner + busyLabel in the action button. */
  busy?: boolean;
  /** Show the ✕. @default true for banner/toast, false for inline. */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Banner only — sticks under the page chrome. */
  sticky?: boolean;
  /** Override the severity-derived icon. */
  icon?: ReactNode;
  /**
   * Toast-only auto-dismiss in ms (default 4000; 0 = sticky). Consumed by the
   * ToastProvider lifecycle, not rendered by <Alert> itself.
   */
  duration?: number;
  className?: string;
}

function SeverityIcon({ paths, size }: { paths: string[]; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function Spinner({ size = 15 }: { size?: number }) {
  // Stroke uses currentColor → inherits the button's text color. Rotation is the
  // one looped animation we allow; never a pulse/blink on the alert itself.
  return (
    <svg className="alert-spinner shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ActionButton({ action, busy, variant, tokens }: {
  action: AlertAction;
  busy?: boolean;
  variant: 'solid' | 'outline' | 'text';
  tokens: SeverityTokens;
}) {
  const content = (
    <>
      {busy && <Spinner />}
      {busy ? action.busyLabel ?? action.label : action.label}
    </>
  );
  const common = 'shrink-0 inline-flex items-center justify-center gap-[7px] font-bold transition-opacity disabled:opacity-70';

  if (variant === 'solid') {
    return (
      <button type="button" onClick={action.onClick} disabled={busy}
        className={`${common} rounded-full text-[13px] text-white`}
        style={{ background: tokens.solid, padding: '9px 18px', boxShadow: `0 8px 20px ${tokens.solid}42` }}>
        {content}
      </button>
    );
  }
  if (variant === 'outline') {
    return (
      <button type="button" onClick={action.onClick} disabled={busy}
        className={`${common} rounded-full text-[12.5px] bg-white border`}
        style={{ color: tokens.text, borderColor: tokens.border300, padding: '7px 14px' }}>
        {content}
      </button>
    );
  }
  // text — toasts are glanceable
  return (
    <button type="button" onClick={action.onClick} disabled={busy}
      className={`${common} text-[12.5px] bg-transparent`}
      style={{ color: tokens.text }}>
      {content}
    </button>
  );
}

function DismissButton({ onClick, color, size = 28 }: { onClick: () => void; color: string; size?: number }) {
  return (
    <button type="button" aria-label="Dismiss" onClick={onClick}
      className="shrink-0 inline-flex items-center justify-center rounded-md bg-transparent transition-opacity hover:opacity-60"
      style={{ width: size, height: size, color }}>
      <CloseIcon size={16} />
    </button>
  );
}

export function Alert({
  severity = 'info',
  placement = 'inline',
  title,
  description,
  action,
  busy,
  dismissible,
  onDismiss,
  sticky,
  icon,
  className = '',
}: AlertProps) {
  const s = SEVERITY[severity];
  // Color is never the only signal: assertive role for error/warning, polite otherwise.
  const role = severity === 'error' || severity === 'warning' ? 'alert' : 'status';
  const showDismiss = (dismissible ?? placement !== 'inline') && !!onDismiss;

  const titleEl = (
    <div className={placement === 'banner' ? 'text-[14.5px] font-bold leading-snug' : 'text-[14px] font-bold leading-snug'} style={{ color: s.title }}>
      {title}
    </div>
  );
  const descEl = description != null && (
    <div className={`alert-desc ${placement === 'banner' ? 'text-[12.5px] leading-[1.45]' : 'text-[12.5px] leading-[1.5]'} mt-[2px]`} style={{ color: s.text }}>
      {description}
    </div>
  );

  if (placement === 'banner') {
    return (
      <div
        role={role}
        className={`alert-enter flex items-center gap-[14px] rounded-[12px] border ${sticky ? 'sticky top-0 z-40' : ''} ${className}`}
        style={{ background: s.surface, borderColor: s.border, padding: '13px 14px', boxShadow: `0 8px 22px ${s.accent}1A` }}
      >
        <span className="shrink-0 inline-flex items-center justify-center rounded-[10px]" style={{ width: 38, height: 38, background: s.tint, color: s.accent }}>
          {icon ?? <SeverityIcon paths={s.icon} size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          {titleEl}
          {descEl}
        </div>
        {action && <ActionButton action={action} busy={busy} variant="solid" tokens={s} />}
        {showDismiss && <DismissButton onClick={onDismiss!} color={s.text} size={30} />}
      </div>
    );
  }

  if (placement === 'toast') {
    return (
      <div
        role={role}
        className={`flex items-start gap-[12px] rounded-[12px] border ${className}`}
        style={{ background: s.surface, borderColor: s.border, padding: '13px 14px', maxWidth: 380, boxShadow: '0 12px 30px rgba(15,23,42,0.14)' }}
      >
        <span className="shrink-0 mt-[1px]" style={{ color: s.accent }}>
          {icon ?? <SeverityIcon paths={s.icon} size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          {titleEl}
          {descEl}
        </div>
        {action && <ActionButton action={action} busy={busy} variant="text" tokens={s} />}
        {showDismiss && <DismissButton onClick={onDismiss!} color={s.text} size={26} />}
      </div>
    );
  }

  // inline (default)
  return (
    <div
      role={role}
      className={`alert-enter flex items-start gap-[12px] rounded-[11px] border ${className}`}
      style={{ background: s.surface, borderColor: s.border, borderLeft: `4px solid ${s.accent}`, padding: '12px 14px' }}
    >
      <span className="shrink-0 mt-[1px]" style={{ color: s.accent }}>
        {icon ?? <SeverityIcon paths={s.icon} size={19} />}
      </span>
      <div className="min-w-0 flex-1">
        {titleEl}
        {descEl}
      </div>
      {action && <ActionButton action={action} busy={busy} variant="outline" tokens={s} />}
      {showDismiss && <DismissButton onClick={onDismiss!} color={s.text} size={26} />}
    </div>
  );
}

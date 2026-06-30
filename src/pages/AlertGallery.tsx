/**
 * AlertGallery — a live preview of the platform Alert system (see
 * components/shared/Alert.tsx + ToastProvider). Renders every severity ×
 * placement and exposes buttons to fire toasts, trigger a busy spinner, and
 * dismiss/reset.
 *
 * Reachable on a non-production build at `?alerts` (wired in App.tsx). It is a
 * demo surface only — not part of the nav, never rendered in a production build.
 */
import { useState } from 'react';
import { Alert, useToast, type AlertSeverity } from '../components/shared';
import { errorToAlert } from '../lib/errorAlert';

const SEVERITIES: AlertSeverity[] = ['error', 'warning', 'success', 'info'];

/** A thrown value shaped like the real clients, for the error-mapper demo. */
function apiErr(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

// Representative throwables spanning the real error classes (see lib/errorAlert.ts).
const SAMPLE_ERRORS: { label: string; error: unknown }[] = [
  { label: 'network down (TypeError)', error: new TypeError('Failed to fetch') },
  { label: '401 session', error: apiErr(401, 'Not authenticated') },
  { label: '403 forbidden', error: apiErr(403, 'admin only') },
  { label: '404 (status in message)', error: new Error('API error: 404') },
  { label: '409 business rule', error: apiErr(409, 'team is in use by appointment type(s); reassign them first') },
  { label: '409 concurrent edit', error: apiErr(409, 'stale If-Match; row was modified') },
  { label: '429 cooldown', error: apiErr(429, 'rate_limited') },
  { label: '500 server', error: apiErr(500, 'API error: 500') },
];

function DemoButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-bold text-slate-800">{title}</h2>
        {hint && <p className="text-[12.5px] text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function AlertGallery() {
  const toast = useToast();
  const [reconnecting, setReconnecting] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const hide = (k: string) => setHidden((h) => new Set(h).add(k));
  const visible = (k: string) => !hidden.has(k);
  const reset = () => {
    setHidden(new Set());
    setReconnecting(false);
  };

  // Live busy demo: spinner for ~1.8s, then a success toast.
  const reconnect = () => {
    setReconnecting(true);
    window.setTimeout(() => {
      setReconnecting(false);
      toast.success('Google Calendar reconnected');
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900">Alert system — live preview</h1>
              <p className="text-[13px] text-slate-500">Every severity × placement. Hover a toast to pause its timer.</p>
            </div>
            <DemoButton onClick={reset}>Reset dismissed</DemoButton>
          </div>
          <Alert
            severity="info"
            placement="inline"
            title="This page is a demo surface"
            description="It only renders on non-production builds at the ?alerts URL. Nothing here writes data."
          />
        </header>

        <Section title="Toasts" hint="Transient confirmations / non-blocking results — bottom-right, auto-dismiss after 4s (hover to pause).">
          <div className="flex flex-wrap gap-2">
            <DemoButton onClick={() => toast.success('Team saved')}>success</DemoButton>
            <DemoButton
              onClick={() =>
                toast.error("Couldn't save team", {
                  description: 'The server returned an error.',
                  action: { label: 'Retry', onClick: () => toast.info('Retrying…') },
                })
              }
            >
              error + retry action
            </DemoButton>
            <DemoButton onClick={() => toast.warning('You have unsaved changes')}>warning</DemoButton>
            <DemoButton onClick={() => toast.info('Link copied')}>info</DemoButton>
            <DemoButton onClick={() => toast.info('Sticky — no auto-dismiss', { duration: 0 })}>sticky (duration 0)</DemoButton>
            <DemoButton onClick={() => { for (let i = 1; i <= 5; i += 1) toast.success(`Toast #${i}`); }}>fire 5 (cap-3)</DemoButton>
            <DemoButton
              onClick={() =>
                toast(<Alert severity="success" placement="toast" title="Custom node" description="Rendered via the escape hatch." />)
              }
            >
              custom node (escape hatch)
            </DemoButton>
          </div>
        </Section>

        <Section title="Banners" hint="Page / account-wide failures — live above page sections; can stick and carry a solid action.">
          {visible('banner-reconnect') && (
            <Alert
              severity="error"
              placement="banner"
              title="Google Calendar disconnected"
              description="New bookings are paused until you reconnect. Existing appointments aren’t affected."
              action={{ label: 'Reconnect Google Calendar', busyLabel: 'Reconnecting…', onClick: reconnect }}
              busy={reconnecting}
              dismissible
              onDismiss={() => hide('banner-reconnect')}
            />
          )}
          {SEVERITIES.map(
            (sev) =>
              visible(`banner-${sev}`) && (
                <Alert
                  key={sev}
                  severity={sev}
                  placement="banner"
                  title={`${sev} banner`}
                  description="Account/page-wide — persistent until resolved."
                  action={{ label: 'Action', onClick: () => toast.info(`${sev} banner action clicked`) }}
                  dismissible
                  onDismiss={() => hide(`banner-${sev}`)}
                />
              ),
          )}
        </Section>

        <Section title="Sticky banner" hint="Scroll the page — this one sticks to the top.">
          {visible('banner-sticky') && (
            <Alert
              severity="warning"
              placement="banner"
              sticky
              title="Sticky banner"
              description="Stays pinned under the top of the viewport while you scroll."
              dismissible
              onDismiss={() => hide('banner-sticky')}
            />
          )}
        </Section>

        <Section title="Inline" hint="Field / section-scoped — sits in the card with a left spine and an outline action. A trailing <code> renders as a muted mono detail.">
          <Alert
            severity="error"
            placement="inline"
            title="Calendar token expired"
            description={<>Bookings are paused until you reconnect Google Calendar. <code>(Invalid token: Token expired)</code></>}
            action={{ label: 'Reconnect', onClick: () => toast.info('Reconnect clicked') }}
          />
          {SEVERITIES.map((sev) => (
            <Alert
              key={sev}
              severity={sev}
              placement="inline"
              title={`${sev} inline`}
              description="Field/section-scoped notice — persistent, sits where it applies."
            />
          ))}
          {visible('inline-dismiss') && (
            <Alert
              severity="info"
              placement="inline"
              title="Dismissible inline (opt-in)"
              description="Inline alerts have no ✕ by default — this one opts in."
              dismissible
              onDismiss={() => hide('inline-dismiss')}
            />
          )}
        </Section>

        <Section title="Error → Alert (the central mapper)" hint="errorToAlert() turns each real error class into severity + human copy. Same function the migrated catch blocks use.">
          {SAMPLE_ERRORS.map(({ label, error }) => {
            const a = errorToAlert(error);
            return (
              <div key={label}>
                <div className="text-[11px] font-mono text-slate-400 mb-1">{label}</div>
                <Alert severity={a.severity} placement="inline" title={a.title} description={a.description} />
              </div>
            );
          })}
          <DemoButton onClick={() => { const a = errorToAlert(apiErr(500, 'API error: 500')); toast.error(a.title, { description: a.description }); }}>
            toast a mapped 500 error
          </DemoButton>
        </Section>
      </div>
    </div>
  );
}

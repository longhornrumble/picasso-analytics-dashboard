/**
 * IntegrationsTab — the Settings → Integrations screen (per the imported "Integrations" design).
 *
 * A "Connected tools" page header over the Google Calendar card (CalendarConnection — full live
 * OAuth / activation / disconnect behavior) and the Zoom placeholder card, with a shared privacy
 * footnote. The page header + footnote live here so each card stays a self-contained surface.
 */
import { CalendarConnection } from './CalendarConnection';
import { ZoomIntegrationCard } from './ZoomIntegrationCard';

export function IntegrationsTab() {
  return (
    <div className="max-w-[760px] mx-auto">
      <div className="mb-7">
        <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-primary-700 mb-2">
          Integrations
        </div>
        <h1 className="text-[28px] font-bold leading-tight text-slate-900">Connected tools</h1>
        <p className="text-[15px] text-slate-500 mt-2 max-w-[60ch]">
          Connect MyRecruiter to the tools that run your mission — so everything works together,
          automatically.
        </p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <CalendarConnection />
        <ZoomIntegrationCard />
      </div>

      <div className="mt-5 flex gap-2.5 items-start px-1">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 mt-px text-slate-400"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span className="text-[12.5px] leading-relaxed text-slate-400">
          Only your primary calendar is read. MyRecruiter never accesses email, contacts, or other
          calendar data.
        </span>
      </div>
    </div>
  );
}

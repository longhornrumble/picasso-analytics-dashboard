/**
 * ZoomIntegrationCard — placeholder card in the Integrations area.
 *
 * Zoom IS wired into the booking backend (per-tenant Server-to-Server credential, operator-
 * provisioned via the ZOOM_OAUTH_PROVISIONING runbook), but there is no self-service connect
 * flow yet. This card surfaces Zoom as an available meeting location and sets the expectation —
 * it intentionally has NO Connect action (nothing to wire it to). When self-service Zoom lands
 * (a published OAuth app + connect/callback, mirroring CalendarConnection), this becomes a real
 * connect card.
 */
import { ZoomLogo } from './IntegrationLogos';

export function ZoomIntegrationCard() {
  return (
    <section aria-label="Zoom integration" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ZoomLogo className="w-5 h-5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Zoom</h3>
          <p className="text-xs text-slate-500">
            Host booked appointments on Zoom instead of Google Meet.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
          <span className="text-sm font-medium text-slate-800">Not connected</span>
          <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
            Coming soon
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Self-service Zoom connection is coming soon. Contact MyRecruiter to enable Zoom for your
          organization in the meantime.
        </p>
      </div>
    </section>
  );
}

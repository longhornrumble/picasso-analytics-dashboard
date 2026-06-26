/**
 * ZoomIntegrationCard — placeholder card in the Integrations area (per the Integrations design).
 *
 * Zoom IS wired into the booking backend (per-tenant Server-to-Server credential, operator-
 * provisioned via the ZOOM_OAUTH_PROVISIONING runbook), but there is no self-service connect
 * flow yet — so this card surfaces Zoom as an available meeting location ("Coming soon") with
 * NO connect action. When self-service Zoom lands (a published OAuth app + connect/callback,
 * mirroring CalendarConnection), this becomes a real connect card.
 */
import { ZoomLogo } from './IntegrationLogos';

export function ZoomIntegrationCard() {
  return (
    <section
      aria-label="Zoom integration"
      className="bg-white border-[1.5px] border-dashed border-slate-200 rounded-[18px] px-[26px] py-[22px] flex items-center gap-[15px]"
    >
      <ZoomLogo className="w-12 h-12 shrink-0 rounded-xl" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-[17px] font-semibold text-slate-900">Zoom</h2>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1.5">
          Host booked appointments on Zoom instead of Google Meet.{' '}
          <span className="text-slate-400">Contact MyRecruiter to enable it for your organization.</span>
        </p>
      </div>
    </section>
  );
}

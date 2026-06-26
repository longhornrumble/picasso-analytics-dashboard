/**
 * Empty state — zero aggregates (staging day one, new tenant).
 * Never renders NaN/undefined. Friendly "collecting your first month" panel.
 */

export function AttributionEmpty() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-6"
      role="status"
      aria-label="No attribution data yet"
    >
      {/* Donut placeholder icon */}
      <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Collecting your first month</h2>
        <p className="text-slate-500 max-w-sm leading-relaxed">
          Attribution data will appear here once conversations start flowing through your channels.
          Check back after your first active month.
        </p>
      </div>

      <div
        className="bg-primary-50 border border-primary-100 rounded-2xl px-8 py-5 max-w-md text-left"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-primary-700 mb-3">
          What you'll see here
        </p>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5" aria-hidden="true">&#x2713;</span>
            Channel ecosystem — where conversations come from
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5" aria-hidden="true">&#x2713;</span>
            Conversion funnel — reached to lead
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5" aria-hidden="true">&#x2713;</span>
            After-hours coverage — staff-hours not hired
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5" aria-hidden="true">&#x2713;</span>
            Per-channel drill with entry points and trends
          </li>
        </ul>
      </div>
    </div>
  );
}

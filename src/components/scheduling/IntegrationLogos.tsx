/**
 * IntegrationLogos — brand marks for the Integrations cards.
 *
 * Simple, dependency-free inline SVGs (recognizable, not pixel-perfect brand assets).
 * Swap for official assets if/when brand-guideline fidelity is needed.
 */

/** Google Calendar's "31" icon (blue gradient calendar, white date). */
export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gcalBody" x1="24" y1="8" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5e9bff" />
          <stop offset="1" stopColor="#2f73f2" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="36" height="34" rx="7" fill="url(#gcalBody)" />
      {/* lighter top band */}
      <path d="M6 16v-1a7 7 0 0 1 7-7h22a7 7 0 0 1 7 7v1z" fill="#ffffff" opacity="0.28" />
      <text
        x="24"
        y="34"
        textAnchor="middle"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="#ffffff"
      >
        31
      </text>
    </svg>
  );
}

/** Zoom's video-camera mark on its brand blue. */
export function ZoomLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="11" fill="#2D8CFF" />
      <rect x="11" y="17" width="17" height="14" rx="3.5" fill="#fff" />
      <path d="M30 22.2 36.2 18c.6-.4 1.3 0 1.3.7v10.6c0 .7-.7 1.1-1.3.7L30 25.8z" fill="#fff" />
    </svg>
  );
}

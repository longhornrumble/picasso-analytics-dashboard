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

/**
 * Zoom wordmark — typeset stand-in in Zoom Blue (#0B5CFF). Recreating Zoom's custom
 * letterforms exactly isn't worth hand-pathing; swap for the official wordmark SVG when
 * brand-perfect fidelity is needed. aria-label carries the name since it acts as a title.
 */
export function ZoomWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 26" className={className} role="img" aria-label="Zoom">
      <text
        x="0"
        y="21"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="25"
        fontWeight="800"
        letterSpacing="-1.2"
        fill="#0B5CFF"
      >
        zoom
      </text>
    </svg>
  );
}

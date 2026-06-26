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
 * Zoom logo lockup — camera-in-circle mark + "zoom" wordmark (typeset stand-in in Zoom Blue).
 * Recreating Zoom's custom letterforms exactly isn't worth hand-pathing; swap for the official
 * lockup SVG for brand-perfect fidelity. aria-label carries the name since it acts as a title.
 */
export function ZoomLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 40" className={className} role="img" aria-label="Zoom">
      <circle cx="20" cy="20" r="18" fill="#4087FC" />
      <rect x="11" y="14.5" width="12.5" height="11" rx="2.5" fill="#fff" />
      <path d="M24 18 29.7 14.6V25.4L24 22z" fill="#fff" />
      <text
        x="44"
        y="28"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="23"
        fontWeight="800"
        letterSpacing="-1.2"
        fill="#4087FC"
      >
        zoom
      </text>
    </svg>
  );
}

/**
 * Alert design tokens — the ONE place severity maps to color + icon.
 *
 * Pure data (no JSX/components) so this module can be imported by both Alert.tsx
 * and ToastProvider.tsx without tripping react-refresh/only-export-components
 * (mirrors the AuthContext/useAuth and *Helpers split). The icon is stored as
 * SVG <path> `d` strings, which Alert renders with one generic <SeverityIcon>.
 *
 * Exact AA-safe spec hexes — they don't all map to this repo's
 * primary/danger/warning/info token scales, so Alert applies them inline (the
 * same exact-hex approach the Select component uses). The spec gave
 * `tint`/`border300` explicitly for `error` only; the other severities' tile /
 * outline values are derived from the same palette family.
 */
export type AlertSeverity = 'error' | 'warning' | 'success' | 'info';

export interface SeverityTokens {
  surface: string;
  border: string;
  accent: string;
  title: string;
  text: string;
  /** Icon-tile bg (banner) — a tint between surface and border. */
  tint: string;
  /** Solid action-button bg. */
  solid: string;
  /** Outline action-button border (inline). */
  border300: string;
  /** SVG <path> `d` strings for the severity icon (24×24 viewBox, stroked). */
  icon: string[];
}

// A full circle as a single stroked path (used by the circle-based severities).
const CIRCLE = 'M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0';

export const SEVERITY: Record<AlertSeverity, SeverityTokens> = {
  error:   { surface: '#FEF3F2', border: '#FECDCA', accent: '#D92D20', title: '#912018', text: '#B42318', tint: '#FEE4E2', solid: '#D92D20', border300: '#FDA29B', icon: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'] },
  warning: { surface: '#FFFAEB', border: '#FEDF89', accent: '#B54708', title: '#93370D', text: '#B54708', tint: '#FEF0C7', solid: '#DC6803', border300: '#FEC84B', icon: [CIRCLE, 'M12 8v4', 'M12 16h.01'] },
  success: { surface: '#ECFDF5', border: '#D1FADF', accent: '#1C7A45', title: '#08552E', text: '#1C7A45', tint: '#D1FADF', solid: '#50C878', border300: '#A6F4C5', icon: [CIRCLE, 'm8.5 12 2.5 2.5 4.5-4.5'] },
  info:    { surface: '#EFF4FF', border: '#B2CCFF', accent: '#175CD3', title: '#00359E', text: '#175CD3', tint: '#D1E0FF', solid: '#175CD3', border300: '#84ADFF', icon: [CIRCLE, 'M12 16v-4', 'M12 8h.01'] },
};

/** Severity accent hexes — read by the ToastProvider progress bar. */
export const ALERT_ACCENT: Record<AlertSeverity, string> = {
  error: SEVERITY.error.accent,
  warning: SEVERITY.warning.accent,
  success: SEVERITY.success.accent,
  info: SEVERITY.info.accent,
};

/**
 * Alert design tokens — the ONE place severity maps to color + icon.
 *
 * Pure data (no JSX/components) so this module can be imported by both Alert.tsx
 * and ToastProvider.tsx without tripping react-refresh/only-export-components
 * (mirrors the AuthContext/useAuth and *Helpers split). The icon is stored as
 * SVG <path> `d` strings, which Alert renders with one generic <SeverityIcon>.
 *
 * BRAND: every color references a design-system token from tokens.css (the
 * codified MyRecruiter palette) by CSS variable — so alerts match /myrecruiter-brand
 * by construction and track the tokens automatically. The tokens live on :root,
 * so they resolve inside the toast portal (document.body) too.
 *  - error → danger scale · warning → warning scale · info → info scale
 *  - success → primary (emerald) scale; its solid action button is the brand
 *    primary #50C878 (primary-500) with Deep Navy text (slate-900), per brand.
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
  /** Solid action-button text (AA on `solid`). */
  solidText: string;
  /** Outline action-button border (inline). */
  border300: string;
  /** SVG <path> `d` strings for the severity icon (24×24 viewBox, stroked). */
  icon: string[];
}

// A full circle as a single stroked path (used by the circle-based severities).
const CIRCLE = 'M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0';

export const SEVERITY: Record<AlertSeverity, SeverityTokens> = {
  error: {
    surface: 'var(--color-danger-50)', border: 'var(--color-danger-200)', accent: 'var(--color-danger-600)',
    title: 'var(--color-danger-800)', text: 'var(--color-danger-700)', tint: 'var(--color-danger-100)',
    solid: 'var(--color-danger-600)', solidText: '#ffffff', border300: 'var(--color-danger-300)',
    icon: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'],
  },
  warning: {
    surface: 'var(--color-warning-50)', border: 'var(--color-warning-200)', accent: 'var(--color-warning-600)',
    title: 'var(--color-warning-800)', text: 'var(--color-warning-700)', tint: 'var(--color-warning-100)',
    solid: 'var(--color-warning-700)', solidText: '#ffffff', border300: 'var(--color-warning-300)',
    icon: [CIRCLE, 'M12 8v4', 'M12 16h.01'],
  },
  success: {
    surface: 'var(--color-primary-50)', border: 'var(--color-primary-200)', accent: 'var(--color-primary-600)',
    title: 'var(--color-primary-800)', text: 'var(--color-primary-700)', tint: 'var(--color-primary-100)',
    solid: 'var(--color-primary-500)', solidText: 'var(--color-slate-900)', border300: 'var(--color-primary-300)',
    icon: [CIRCLE, 'm8.5 12 2.5 2.5 4.5-4.5'],
  },
  info: {
    surface: 'var(--color-info-50)', border: 'var(--color-info-200)', accent: 'var(--color-info-600)',
    title: 'var(--color-info-800)', text: 'var(--color-info-700)', tint: 'var(--color-info-100)',
    solid: 'var(--color-info-600)', solidText: '#ffffff', border300: 'var(--color-info-300)',
    icon: [CIRCLE, 'M12 16v-4', 'M12 8h.01'],
  },
};

/** Severity accent token refs — read by the ToastProvider progress bar. */
export const ALERT_ACCENT: Record<AlertSeverity, string> = {
  error: SEVERITY.error.accent,
  warning: SEVERITY.warning.accent,
  success: SEVERITY.success.accent,
  info: SEVERITY.info.accent,
};

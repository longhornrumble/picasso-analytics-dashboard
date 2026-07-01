/**
 * Toggle — the shared pill-shaped on/off switch.
 *
 * 44×24px track, 2px inset, fully rounded; a 20×20 white knob that slides flush-left (off) to
 * flush-right (on) with a subtle drop shadow. Track + knob animate on toggle (~80ms ease).
 * Whole track is the hit target; `role="switch"` + `aria-checked`. Labelless — it sits at the
 * trailing edge of a row, so an `ariaLabel` is required for an accessible name.
 *
 * Colors are token classes (never raw hex): on = primary-500 (#50C878), off = slate-300
 * (#CBD5E1), disabled = slate-200 (#E2E8F0).
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required (the switch shows no text). */
  ariaLabel: string;
  className?: string;
}

export function Toggle({ checked, onChange, disabled = false, ariaLabel, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex items-center shrink-0 w-11 h-6 rounded-full p-0.5',
        'transition-colors duration-[80ms] ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        disabled ? 'bg-slate-200 cursor-not-allowed' : checked ? 'bg-primary-500' : 'bg-slate-300',
        className ?? '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'block w-5 h-5 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.25)]',
          'transition-transform duration-[80ms] ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
          disabled ? 'opacity-70' : '',
        ].join(' ')}
      />
    </button>
  );
}

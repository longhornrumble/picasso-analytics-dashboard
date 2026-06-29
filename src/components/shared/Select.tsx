/**
 * Select — a custom (non-native) single-select dropdown built to the design spec.
 *
 * The key fix vs a native <select> (and the old toolbar Dropdown): the menu is anchored to
 * the trigger's OWN box — wrapped in a `relative` container with the menu `left-0 right-0`,
 * so its width and left edge derive from the trigger. No hard-coded width / margin / transform,
 * which is what eliminated the "menu shifted a few px left / narrower than the field" jank.
 *
 * Tokens: neutrals use slate-* (exact hex match to the spec); the focus accent is primary-500
 * (#50C878). The selected-row accent (#ECFDF5 bg / #1C7A45 text+check) is spec'd as exact hex
 * that does NOT map to this repo's primary-700 (#047857), so it's applied as arbitrary values.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Small uppercase field label above the trigger. */
  label?: string;
  /** Helper text below the trigger. */
  hint?: string;
  /** Shown in the trigger when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-slate-400 transition-transform duration-[180ms] ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1C7A45"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function Select({ value, onChange, options, label, hint, placeholder, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const triggerText = selected?.label ?? placeholder ?? '';

  // Outside-click: a document pointerdown listener, added ONLY while open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option scrolled into view while navigating.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    // optional-call: jsdom (tests) doesn't implement scrollIntoView
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  function openMenu() {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }
  function closeMenu({ focusTrigger = true } = {}) {
    setOpen(false);
    setActiveIndex(-1);
    if (focusTrigger) triggerRef.current?.focus();
  }
  function choose(i: number) {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.value);
    closeMenu();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) return openMenu();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) return openMenu();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) return openMenu();
        if (activeIndex >= 0) choose(activeIndex);
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          closeMenu();
        }
        break;
      case 'Tab':
        if (open) closeMenu({ focusTrigger: false });
        break;
    }
  }

  return (
    <div ref={rootRef} className="w-full">
      {label && (
        <label
          id={labelId}
          htmlFor={`${baseId}-trigger`}
          className="block text-[11.5px] font-bold tracking-[0.03em] uppercase text-slate-600 mb-[7px]"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={`${baseId}-trigger`}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={label ? labelId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          disabled={disabled}
          onClick={() => (open ? closeMenu({ focusTrigger: false }) : openMenu())}
          onKeyDown={onKeyDown}
          className={[
            'w-full flex items-center justify-between gap-[10px]',
            'rounded-[10px] border px-[14px] py-[11px] bg-white text-left text-[14px] font-medium',
            'transition-[border-color,box-shadow] duration-150',
            'focus:outline-none focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(80,200,120,0.15)]',
            open
              ? 'border-primary-500 shadow-[0_0_0_3px_rgba(80,200,120,0.15)]'
              : 'border-slate-200',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          <span className={`min-w-0 flex-1 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
            {triggerText}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 max-h-60 overflow-auto rounded-[12px] border border-slate-200 bg-white p-[6px] shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={[
                    'flex items-center gap-[9px] rounded-[8px] px-[12px] py-[10px] text-[14px] cursor-pointer',
                    isSelected
                      ? 'bg-[#ECFDF5] text-[#1C7A45] font-bold'
                      : `font-medium text-slate-700 ${isActive ? 'bg-slate-50' : ''}`,
                  ].join(' ')}
                >
                  <span className="w-4 shrink-0 flex items-center justify-center" aria-hidden="true">
                    {isSelected && <CheckIcon />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hint && <p className="mt-[8px] text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

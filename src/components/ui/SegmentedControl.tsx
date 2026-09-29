import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the whole group, e.g. "Moneda del precio". */
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

// The group has 4px of padding, so the total control height is button + 8px:
// 36 + 8 = 44px for `sm`, 40 + 8 = 48px for `md`.
const SIZE = {
  sm: 'min-h-[36px] px-3 text-xs',
  md: 'min-h-[40px] px-4 text-sm',
} as const;

/**
 * Mutually exclusive choice between a few short options (currency, input mode).
 * Toggle buttons rather than tabs: nothing here swaps a panel.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-sunken p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors ${SIZE[size]} ${
              active ? 'bg-surface text-heading shadow-card' : 'text-content-muted hover:text-content'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

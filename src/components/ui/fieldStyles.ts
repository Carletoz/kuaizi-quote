/**
 * Shared look for every text-like form control (TextField, NumberField,
 * SelectField, and bare inputs inside the quote table). Kept in one place so a
 * change to the field design lands everywhere.
 *
 * Font size is `text-base` (16px) below `sm`: iOS Safari zooms the page when a
 * focused input renders under 16px.
 */
export const fieldLabelClass = 'text-sm font-medium text-content';
export const fieldHintClass = 'text-xs text-content-subtle';
export const fieldErrorClass = 'text-xs font-medium text-danger';

interface InputClassOptions {
  invalid?: boolean;
  /** Denser height on desktop for inputs that live inside table cells. */
  compact?: boolean;
  className?: string;
}

export function inputClasses({ invalid = false, compact = false, className }: InputClassOptions = {}): string {
  return [
    'w-full rounded-xl border bg-surface px-3 text-base text-content outline-none transition-colors sm:text-sm',
    'placeholder:text-content-subtle',
    'disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-content-subtle',
    compact ? 'min-h-[44px] py-1.5 sm:min-h-[36px]' : 'min-h-[44px] py-2',
    invalid
      ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
      : 'border-border-strong focus:border-accent focus:ring-1 focus:ring-accent',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

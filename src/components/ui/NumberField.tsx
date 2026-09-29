import React, { useState, useEffect, useId, type ReactNode } from 'react';
import { fieldLabelClass } from './fieldStyles';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  hint?: string;
  readOnly?: boolean;
  /** Accessible name for fields whose visible label is rendered by the parent. */
  ariaLabel?: string;
  /** Control shown at the right end of the label row, e.g. a currency switch. */
  labelAccessory?: ReactNode;
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder = '0',
  min: _min,
  max: _max,
  step: _step,
  className = '',
  hint,
  readOnly = false,
  ariaLabel,
  labelAccessory,
}: NumberFieldProps) {
  const inputId = useId();
  const [text, setText] = useState(value === 0 ? '' : String(value));

  // Sync display when parent resets value externally (e.g. DEFAULT_INPUTS)
  useEffect(() => {
    const normalized = text.replace(',', '.');
    const parsed = normalized === '' ? 0 : parseFloat(normalized);
    if ((isNaN(parsed) ? 0 : parsed) !== value) {
      setText(value === 0 ? '' : String(value));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const normalized = raw.replace(',', '.');
    const parsed = normalized === '' ? 0 : parseFloat(normalized);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  const addonClass =
    'flex items-center whitespace-nowrap bg-surface-raised px-3 text-sm text-content-muted';

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {(label || hint || labelAccessory) && (
        <div className="flex items-center justify-between gap-2">
          {(label || hint) && (
            <label htmlFor={inputId} className={fieldLabelClass}>
              {label}
              {hint && (
                <span className="ml-1 text-xs font-normal text-content-subtle" title={hint}>
                  {' '}({hint})
                </span>
              )}
            </label>
          )}
          {labelAccessory}
        </div>
      )}
      <div className="flex min-h-[44px] min-w-0 items-stretch overflow-hidden rounded-xl border border-border-strong bg-surface transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        {prefix && <span className={`${addonClass} border-r border-border-strong`}>{prefix}</span>}
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-label={label ? undefined : ariaLabel}
          className={`min-w-0 flex-1 px-3 py-2 text-base outline-none placeholder:text-content-subtle sm:text-sm ${
            readOnly ? 'cursor-default bg-surface-raised text-content-muted' : 'bg-transparent text-content'
          }`}
        />
        {suffix && <span className={`${addonClass} border-l border-border-strong`}>{suffix}</span>}
      </div>
    </div>
  );
}

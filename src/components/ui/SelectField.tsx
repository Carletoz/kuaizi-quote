import { useId } from 'react';
import { fieldHintClass, fieldLabelClass, inputClasses } from './fieldStyles';
import { ChevronDownIcon } from './icons';

export interface SelectFieldOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
  /** Adds a disabled, empty first option. Omit when an empty-value option is part of `options`. */
  placeholder?: string;
  hint?: string;
  id?: string;
  className?: string;
}

/**
 * Native `<select>` (best mobile picker there is) with the shared field look.
 * Named `SelectField` so it does not collide with the retired `ui/Select`.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  hint,
  id,
  className = '',
}: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className={fieldLabelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          className={inputClasses({ className: 'appearance-none pr-10' })}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-content-subtle" />
      </div>
      {hint && (
        <p id={hintId} className={fieldHintClass}>
          {hint}
        </p>
      )}
    </div>
  );
}

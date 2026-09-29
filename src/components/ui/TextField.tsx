import { useId, type InputHTMLAttributes } from 'react';
import { fieldErrorClass, fieldHintClass, fieldLabelClass, inputClasses } from './fieldStyles';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  /** Validation message. Replaces the hint and flips the control to the danger style. */
  error?: string | null;
  /** Shows the required marker and sets `aria-required`. It does not enable native validation. */
  required?: boolean;
  /** Classes for the outer wrapper (layout); `className` goes to the input itself. */
  wrapperClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  required,
  id,
  className,
  wrapperClassName = '',
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wrapperClassName}`}>
      <label htmlFor={inputId} className={fieldLabelClass}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        type="text"
        id={inputId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={inputClasses({ invalid: Boolean(error), className })}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className={fieldErrorClass}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className={fieldHintClass}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

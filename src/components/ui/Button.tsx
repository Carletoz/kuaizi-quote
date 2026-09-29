import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-ring ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-card hover:bg-primary-hover active:bg-primary-active',
  secondary: 'bg-secondary text-on-secondary hover:bg-secondary-hover',
  outline: 'border border-secondary text-secondary hover:bg-secondary hover:text-on-secondary',
  ghost: 'text-content-muted hover:bg-surface-raised hover:text-content',
  link: 'text-accent underline-offset-4 hover:underline',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 text-sm',
  md: 'min-h-[44px] px-6 text-sm',
  lg: 'min-h-[48px] px-6 text-base',
};

/**
 * Shared class string so anchor CTAs (`<a href>`) can match Button exactly.
 * Brand colors are routed through here — do NOT hardcode `bg-orange-*` /
 * `bg-blue-*` on buttons.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  opts: { fullWidth?: boolean; className?: string } = {},
): string {
  return [BASE, VARIANT[variant], SIZE[size], opts.fullWidth ? 'w-full' : '', opts.className ?? '']
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, { fullWidth, className })} {...rest}>
      {children}
    </button>
  );
}

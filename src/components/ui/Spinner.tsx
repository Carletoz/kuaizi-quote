type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerTone = 'primary' | 'current';

const SIZE: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-7 w-7 border-[3px]',
};

const TONE: Record<SpinnerTone, string> = {
  // Standalone: a quiet track with an orange arc.
  primary: 'border-surface-sunken border-t-primary',
  // Inside a colored control (e.g. a primary button): inherit the text color.
  current: 'border-current border-t-transparent',
};

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
}

/**
 * Decorative: it is always paired with visible text ("Analizando...") and the
 * busy state is announced by the parent via `aria-busy`, so it stays hidden
 * from assistive tech.
 */
export function Spinner({ size = 'md', tone = 'primary', className = '' }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-shrink-0 animate-spin rounded-full ${SIZE[size]} ${TONE[tone]} ${className}`}
    />
  );
}

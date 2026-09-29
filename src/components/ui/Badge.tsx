import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-sunken text-content-muted',
  brand: 'border-secondary/20 bg-secondary-soft text-heading',
  info: 'border-info/30 bg-info-surface text-info-content',
  success: 'border-success/30 bg-success-surface text-success-content',
  warning: 'border-warning/30 bg-warning-surface text-warning-content',
  danger: 'border-danger/30 bg-danger-surface text-danger-content',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

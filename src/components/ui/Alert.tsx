import type { ComponentType, ReactNode } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from './icons';

export type AlertKind = 'warning' | 'danger' | 'info' | 'success';

const KIND_STYLES: Record<AlertKind, string> = {
  warning: 'border-warning/40 bg-warning-surface text-warning-content',
  danger: 'border-danger/40 bg-danger-surface text-danger-content',
  info: 'border-info/40 bg-info-surface text-info-content',
  success: 'border-success/40 bg-success-surface text-success-content',
};

const KIND_ICONS: Record<AlertKind, ComponentType<{ className?: string }>> = {
  warning: ExclamationTriangleIcon,
  danger: ExclamationCircleIcon,
  info: InformationCircleIcon,
  success: CheckCircleIcon,
};

interface AlertProps {
  kind?: AlertKind;
  children: ReactNode;
  /** Trailing control, e.g. a retry or "open" action. */
  action?: ReactNode;
  className?: string;
}

/**
 * Inline status message. Icon + color carry the kind together, so the meaning
 * never depends on color alone. Errors and warnings interrupt (`alert`); info
 * and success are polite (`status`).
 */
export function Alert({ kind = 'info', children, action, className = '' }: AlertProps) {
  const KindIcon = KIND_ICONS[kind];
  const interrupts = kind === 'danger' || kind === 'warning';

  return (
    <div
      role={interrupts ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${KIND_STYLES[kind]} ${className}`}
    >
      <KindIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

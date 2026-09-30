import { useId } from 'react';
import { Button } from '@/components/ui/Button';

interface NewQuoteConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before wiping the quote. Shared by every "start a new quote" entry point
 * (the quote table and the resume notice) so the warning reads the same in both.
 */
export function NewQuoteConfirm({ onCancel, onConfirm }: NewQuoteConfirmProps) {
  const titleId = useId();

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <p id={titleId} className="text-sm font-semibold text-warning-content">
          ¿Empezar una cotización nueva?
        </p>
        <p className="text-sm text-warning-content">
          Se borran los proveedores, productos y fotos de esta cotización, y no se puede deshacer.
          Si quieres conservarla, compártela en Drive antes.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" autoFocus onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={onConfirm}>
          Borrar y empezar de nuevo
        </Button>
      </div>
    </div>
  );
}

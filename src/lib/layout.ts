import type { WizardStep } from '@/state/session/types';

/** Steps that render the wide quote table get a wider shell on desktop. */
export function isWideStep(step: WizardStep): boolean {
  return step === 'review';
}

/**
 * Shared max-width so the header, stepper and main content stay on one visual
 * axis. Data-entry steps stay a phone-width column; the review step opens up
 * for the 19-column quote table.
 */
export function containerWidthClass(step: WizardStep): string {
  return isWideStep(step) ? 'max-w-[1600px]' : 'max-w-lg';
}

/** Stages shown in the progress stepper, one per wizard step. */
export const WIZARD_STAGES = [
  { key: 'supplier', label: 'Proveedor' },
  { key: 'product', label: 'Producto' },
  { key: 'review', label: 'Cotización' },
] as const satisfies ReadonlyArray<{ key: WizardStep; label: string }>;

/** Maps a wizard step to its stage index (0-based). */
export function stageIndexForStep(step: WizardStep): number {
  return WIZARD_STAGES.findIndex((stage) => stage.key === step);
}

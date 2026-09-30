import { ALL_HS_CATEGORIES } from '@/data/hs-categories';
import type { ProductEntry } from '@/state/session/types';

/** Sentinel category id: the user types arancel / IVA by hand. */
export const CUSTOM_HS = '__custom__';

/** String-valued form state while a product row is being edited. */
export interface EditDraft {
  name: string;
  numCajas: string;
  unitPriceRmb: string;
  piezasPorCaja: string;
  cbm: string;
  hsCategoryId: string;
  arancelRate: string;
  ivaRate: string;
  fleteInternoChinaRmb: string;
}

export function seedDraft(p: ProductEntry): EditDraft {
  const arancelPct = Math.round(p.arancelRate * 100);
  const ivaPct = Math.round(p.ivaRate * 100);
  const numCajas = p.piezasPorCaja > 0 ? Math.round(p.quantity / p.piezasPorCaja) : 1;

  const matchedCat = ALL_HS_CATEGORIES.find(
    (cat) =>
      Math.round(cat.arancelRate * 100) === arancelPct &&
      Math.round(cat.ivaRate * 100) === ivaPct &&
      (p.hsCategoryId ? cat.id === p.hsCategoryId : true)
  );

  return {
    name: p.name,
    numCajas: String(numCajas),
    unitPriceRmb: String(p.unitPriceRmb),
    piezasPorCaja: String(p.piezasPorCaja),
    cbm: String(p.cbm),
    hsCategoryId: matchedCat ? matchedCat.id : CUSTOM_HS,
    arancelRate: String(arancelPct),
    ivaRate: String(ivaPct),
    fleteInternoChinaRmb: String(p.fleteInternoChinaRmb ?? 0),
  };
}

/** Validates the draft and converts it to product fields, or null when it cannot be saved. */
export function draftToFields(d: EditDraft): Partial<ProductEntry> | null {
  const numCajas = parseInt(d.numCajas, 10);
  const unitPriceRmb = parseFloat(d.unitPriceRmb);
  const piezasPorCaja = parseFloat(d.piezasPorCaja);

  if (!d.name.trim()) return null;
  if (!numCajas || numCajas <= 0) return null;
  if (!unitPriceRmb || unitPriceRmb <= 0) return null;

  const quantity = piezasPorCaja > 0 ? numCajas * piezasPorCaja : numCajas;
  const arancelPct = Math.min(100, Math.max(0, parseFloat(d.arancelRate) || 0));
  const ivaPct = Math.min(100, Math.max(0, parseFloat(d.ivaRate) || 0));
  const cbm = parseFloat(d.cbm);
  const fleteInternoChinaRmb = parseFloat(d.fleteInternoChinaRmb) || 0;

  const fields: Partial<ProductEntry> = {
    name: d.name.trim(),
    quantity,
    unitPriceRmb,
    piezasPorCaja: piezasPorCaja > 0 ? piezasPorCaja : undefined,
    cbm: cbm > 0 ? cbm : undefined,
    arancelRate: arancelPct / 100,
    ivaRate: ivaPct / 100,
    fleteInternoChinaRmb,
  };

  if (d.hsCategoryId !== CUSTOM_HS && d.hsCategoryId !== '') {
    fields.hsCategoryId = d.hsCategoryId;
  }

  return fields;
}

/**
 * Numeric values read from the edit draft, falling back to the saved product.
 * Shared by the row calculation and the detail panel so both agree.
 */
export function deriveDraftValues(p: ProductEntry, draft: EditDraft | null) {
  return {
    numCajas: draft ? (parseInt(draft.numCajas, 10) || 0) : 0,
    piezasPorCaja: draft ? (parseFloat(draft.piezasPorCaja) || p.piezasPorCaja) : p.piezasPorCaja,
    cbm: draft ? (parseFloat(draft.cbm) || p.cbm) : p.cbm,
    fleteInterno: draft ? (parseFloat(draft.fleteInternoChinaRmb) || 0) : (p.fleteInternoChinaRmb ?? 0),
  };
}

export type DraftValues = ReturnType<typeof deriveDraftValues>;

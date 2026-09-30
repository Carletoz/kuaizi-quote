import { calculateLandedCost } from '@/lib/calc/v3-landed';
import type { LandedCostResult } from '@/lib/calc/v3-landed';
import { getHSCategory } from '@/data/hs-categories';
import type { ProductEntry } from '@/state/session/types';
import { deriveDraftValues } from './editDraft';
import type { DraftValues, EditDraft } from './editDraft';

export interface Rates {
  trmCopUsd: number;
  cnyToUsd: number;
}

/**
 * Everything a quote row displays, computed once so the desktop table and the
 * phone list can never show different numbers.
 */
export interface RowModel {
  /** The saved product (never the draft). */
  product: ProductEntry;
  /** True while this row has an edit draft. */
  isEditing: boolean;
  draftValues: DraftValues;
  /** Landed cost of the draft while editing, of the saved product otherwise. */
  calc: LandedCostResult;
  /** Boxes, from the saved product even while editing. */
  numCajas: number;
  /** Total CBM, from the saved product even while editing. */
  totalCbm: number;
  hsCode: string;
  /** Raw text of the selling price input (empty when not set). */
  sellingPrice: string;
  /** Margin over the unit cost in percent, or null when no valid selling price is set. */
  rentabilidad: number | null;
}

/**
 * @param draft The edit draft of THIS product, or null when it is not being edited.
 * @param sellingPrice Raw selling price text typed by the user ('' when empty).
 */
export function buildRowModel(
  product: ProductEntry,
  draft: EditDraft | null,
  rates: Rates,
  sellingPrice: string
): RowModel {
  const p = product;
  const isEditing = draft !== null;
  const dv = deriveDraftValues(p, draft);

  const draftProduct: ProductEntry = draft
    ? {
        ...p,
        name: draft.name || p.name,
        quantity: dv.numCajas * dv.piezasPorCaja || p.quantity,
        unitPriceRmb: parseFloat(draft.unitPriceRmb) || p.unitPriceRmb,
        piezasPorCaja: dv.piezasPorCaja,
        cbm: dv.cbm,
        arancelRate: Math.min(100, Math.max(0, parseFloat(draft.arancelRate) || 0)) / 100,
        ivaRate: Math.min(100, Math.max(0, parseFloat(draft.ivaRate) || 0)) / 100,
        fleteInternoChinaRmb: dv.fleteInterno,
      }
    : p;

  const calc = calculateLandedCost({
    unitPriceRmb: draftProduct.unitPriceRmb,
    piezasPorCaja: draftProduct.piezasPorCaja,
    cbm: draftProduct.cbm,
    quantity: draftProduct.quantity,
    trmCopUsd: rates.trmCopUsd,
    cnyToUsd: rates.cnyToUsd,
    arancelRate: draftProduct.arancelRate,
    ivaRate: draftProduct.ivaRate,
    fleteInternoChinaRmb: draftProduct.fleteInternoChinaRmb ?? 0,
  });

  const numCajas = p.piezasPorCaja > 0 ? Math.round(p.quantity / p.piezasPorCaja) : 0;
  const totalCbm = p.cbm * numCajas;

  const hsCat = p.hsCategoryId ? getHSCategory(p.hsCategoryId) : undefined;
  const hsCode = hsCat?.exampleHSCodes[0] ?? '—';

  const sellingPriceCop = parseFloat(sellingPrice.replace(/,/g, '.'));
  const rentabilidad =
    !isNaN(sellingPriceCop) && sellingPriceCop > 0 && calc.precioUnidadFinalCop > 0
      ? ((sellingPriceCop - calc.precioUnidadFinalCop) / calc.precioUnidadFinalCop) * 100
      : null;

  return { product: p, isEditing, draftValues: dv, calc, numCajas, totalCbm, hsCode, sellingPrice, rentabilidad };
}

export interface OrderTotals {
  grandTotalCop: number;
  grandTotalCajas: number;
  grandTotalFleteCop: number;
  orderTotalCbm: number;
}

/** Order-wide totals. Always computed from the saved products, never from an edit draft. */
export function buildOrderTotals(products: ProductEntry[], rates: Rates): OrderTotals {
  const orderCalcs = products.map((p) =>
    calculateLandedCost({
      unitPriceRmb: p.unitPriceRmb,
      piezasPorCaja: p.piezasPorCaja,
      cbm: p.cbm,
      quantity: p.quantity,
      trmCopUsd: rates.trmCopUsd,
      cnyToUsd: rates.cnyToUsd,
      arancelRate: p.arancelRate,
      ivaRate: p.ivaRate,
      fleteInternoChinaRmb: p.fleteInternoChinaRmb ?? 0,
    })
  );

  const grandTotalCop = orderCalcs.reduce((sum, c) => sum + c.precioTotalFinalCop, 0);
  const grandTotalCajas = products.reduce((sum, p) => {
    return sum + (p.piezasPorCaja > 0 ? Math.round(p.quantity / p.piezasPorCaja) : 0);
  }, 0);
  const grandTotalFleteCop = orderCalcs.reduce((sum, c) => sum + c.fleteImpuestosCop, 0);

  const orderTotalCbm = products.reduce((sum, p) => {
    const n = p.piezasPorCaja > 0 ? Math.round(p.quantity / p.piezasPorCaja) : 0;
    return sum + p.cbm * n;
  }, 0);

  return { grandTotalCop, grandTotalCajas, grandTotalFleteCop, orderTotalCbm };
}

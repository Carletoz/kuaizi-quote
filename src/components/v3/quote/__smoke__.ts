/**
 * Smoke test for the quote row model.
 * Run via: npx tsx src/components/v3/quote/__smoke__.ts
 *
 * Checks buildRowModel / buildOrderTotals against calculateLandedCost and the
 * rules the table has always followed (draft-aware calc, saved-product boxes/CBM).
 * Prints PASS/FAIL per check and exits non-zero on any failure.
 */

import { calculateLandedCost } from '../../../lib/calc/v3-landed';
import { ALL_HS_CATEGORIES } from '../../../data/hs-categories';
import type { ProductEntry } from '../../../state/session/types';
import { seedDraft } from './editDraft';
import type { EditDraft } from './editDraft';
import { buildOrderTotals, buildRowModel } from './rowModel';

const rates = { trmCopUsd: 4000, cnyToUsd: 0.14 };

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = Object.is(actual, expected);
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${label}${pass ? '' : ` — actual=${String(actual)} expected=${String(expected)}`}`);
}

function checkTrue(label: string, cond: boolean): void {
  check(label, cond, true);
}

function product(overrides: Partial<ProductEntry> = {}): ProductEntry {
  return {
    id: 'p1',
    supplierId: 's1',
    name: 'Producto de prueba',
    quantity: 100,
    unitPriceRmb: 10,
    piezasPorCaja: 10,
    cbm: 0.1,
    dimensionsSource: 'direct',
    arancelRate: 0.1,
    ivaRate: 0.19,
    fleteInternoChinaRmb: 0,
    ...overrides,
  };
}

function expectedCalc(p: Pick<ProductEntry, 'unitPriceRmb' | 'piezasPorCaja' | 'cbm' | 'quantity' | 'arancelRate' | 'ivaRate' | 'fleteInternoChinaRmb'>) {
  return calculateLandedCost({
    unitPriceRmb: p.unitPriceRmb,
    piezasPorCaja: p.piezasPorCaja,
    cbm: p.cbm,
    quantity: p.quantity,
    trmCopUsd: rates.trmCopUsd,
    cnyToUsd: rates.cnyToUsd,
    arancelRate: p.arancelRate,
    ivaRate: p.ivaRate,
    fleteInternoChinaRmb: p.fleteInternoChinaRmb ?? 0,
  });
}

// ─── Case 1: saved product, no selling price ─────────────────────────────────
function case1(): void {
  console.log('\n── Case 1: saved product, no selling price ──');
  const p = product();
  const row = buildRowModel(p, null, rates, '');
  const exp = expectedCalc(p);

  check('not editing', row.isEditing, false);
  check('calc.precioTotalFinalCop matches engine', row.calc.precioTotalFinalCop, exp.precioTotalFinalCop);
  check('calc.precioUnidadFinalCop matches engine', row.calc.precioUnidadFinalCop, exp.precioUnidadFinalCop);
  check('calc.fleteImpuestosCop matches engine', row.calc.fleteImpuestosCop, exp.fleteImpuestosCop);
  // Hand-computed anchor: 10*1.05=10.5 RMB; 10.5*100=1050; 1050*0.14*4000=588000; flete=0.1*10*4e6=4e6.
  check('hand-computed total COP', Math.round(row.calc.precioTotalFinalCop), 4_588_000);
  check('hand-computed unit COP', Math.round(row.calc.precioUnidadFinalCop), 45_880);
  check('numCajas', row.numCajas, 10);
  check('totalCbm', row.totalCbm, 0.1 * 10);
  check('hsCode without category', row.hsCode, '—');
  check('rentabilidad null without selling price', row.rentabilidad, null);
  check('sellingPrice echoed', row.sellingPrice, '');
  check('draftValues.piezasPorCaja falls back to product', row.draftValues.piezasPorCaja, 10);
  check('draftValues.numCajas is 0 without a draft', row.draftValues.numCajas, 0);
}

// ─── Case 2: selling price set / invalid ─────────────────────────────────────
function case2(): void {
  console.log('\n── Case 2: selling price ──');
  const p = product();
  const unit = expectedCalc(p).precioUnidadFinalCop;

  const ok = buildRowModel(p, null, rates, '60000');
  check('rentabilidad with selling price', ok.rentabilidad, ((60000 - unit) / unit) * 100);
  checkTrue('rentabilidad positive', (ok.rentabilidad ?? -1) > 0);

  const comma = buildRowModel(p, null, rates, '60000,5');
  check('decimal comma is accepted', comma.rentabilidad, ((60000.5 - unit) / unit) * 100);

  const below = buildRowModel(p, null, rates, '30000');
  checkTrue('rentabilidad negative below cost', (below.rentabilidad ?? 1) < 0);

  for (const bad of ['', 'abc', '0', '-5', '   ']) {
    check(`rentabilidad null for ${JSON.stringify(bad)}`, buildRowModel(p, null, rates, bad).rentabilidad, null);
  }
}

// ─── Case 3: edit draft (calc is draft-aware, boxes/CBM stay saved) ──────────
function case3(): void {
  console.log('\n── Case 3: edit draft ──');
  const p = product();
  const draft: EditDraft = {
    ...seedDraft(p),
    numCajas: '4',
    unitPriceRmb: '20',
    piezasPorCaja: '25',
    cbm: '0.2',
    fleteInternoChinaRmb: '50',
    arancelRate: '15',
    ivaRate: '5',
  };
  const row = buildRowModel(p, draft, rates, '');
  const exp = expectedCalc({
    unitPriceRmb: 20,
    piezasPorCaja: 25,
    cbm: 0.2,
    quantity: 4 * 25,
    arancelRate: 0.15,
    ivaRate: 0.05,
    fleteInternoChinaRmb: 50,
  });

  check('editing flag', row.isEditing, true);
  check('calc uses the draft (total)', row.calc.precioTotalFinalCop, exp.precioTotalFinalCop);
  check('calc uses the draft (unit)', row.calc.precioUnidadFinalCop, exp.precioUnidadFinalCop);
  check('calc uses the draft (flete)', row.calc.fleteImpuestosCop, exp.fleteImpuestosCop);
  check('numCajas stays from the saved product', row.numCajas, 10);
  check('totalCbm stays from the saved product', row.totalCbm, 0.1 * 10);
  check('draftValues.numCajas', row.draftValues.numCajas, 4);
  check('draftValues.cbm', row.draftValues.cbm, 0.2);
  check('draftValues.fleteInterno', row.draftValues.fleteInterno, 50);
  check('saved product is untouched', row.product, p);

  // Blank / invalid draft fields fall back to the saved product.
  const blank: EditDraft = { ...seedDraft(p), numCajas: '', unitPriceRmb: '', piezasPorCaja: '', cbm: '' };
  const blankRow = buildRowModel(p, blank, rates, '');
  const blankExp = expectedCalc({ ...p, arancelRate: 0.1, ivaRate: 0.19, fleteInternoChinaRmb: 0 });
  check('blank draft falls back to saved quantity/price/cbm', blankRow.calc.precioTotalFinalCop, blankExp.precioTotalFinalCop);

  // Selling price is judged against the draft-aware unit cost.
  const priced = buildRowModel(p, draft, rates, '90000');
  check('rentabilidad uses the draft unit cost', priced.rentabilidad, ((90000 - exp.precioUnidadFinalCop) / exp.precioUnidadFinalCop) * 100);
}

// ─── Case 4: piezasPorCaja 0 and missing cbm ─────────────────────────────────
function case4(): void {
  console.log('\n── Case 4: piezasPorCaja 0 / missing cbm ──');
  const noBoxes = product({ piezasPorCaja: 0, cbm: 0.05 });
  const row = buildRowModel(noBoxes, null, rates, '50000');
  check('numCajas is 0 when piezasPorCaja is 0', row.numCajas, 0);
  check('totalCbm is 0 when there are no boxes', row.totalCbm, 0);
  // Pre-existing behaviour kept on purpose: the engine divides by 0 boxes, so the
  // unit cost is Infinity and a typed selling price yields NaN (the table always showed it).
  checkTrue('unit cost is not finite without piezasPorCaja', !Number.isFinite(row.calc.precioUnidadFinalCop));
  checkTrue('rentabilidad is not a finite number without piezasPorCaja', !Number.isFinite(row.rentabilidad ?? NaN));
  checkTrue('no exception and model is returned', row.product === noBoxes);

  const noBoxesNoCbm = buildRowModel(product({ piezasPorCaja: 0, cbm: 0 }), null, rates, '');
  checkTrue('0 boxes and 0 cbm gives NaN flete, as before', Number.isNaN(noBoxesNoCbm.calc.fleteImpuestosCop));

  const noCbm = product({ cbm: 0 });
  const rowNoCbm = buildRowModel(noCbm, null, rates, '');
  check('flete is 0 without cbm', rowNoCbm.calc.fleteImpuestosCop, 0);
  check('totalCbm is 0 without cbm', rowNoCbm.totalCbm, 0);
  check('unit cost without cbm matches engine', rowNoCbm.calc.precioUnidadFinalCop, expectedCalc(noCbm).precioUnidadFinalCop);

  // Draft with a blank cbm falls back to the saved cbm (here 0).
  const blankCbm = buildRowModel(noCbm, { ...seedDraft(noCbm), cbm: '' }, rates, '');
  check('draft with blank cbm keeps the saved cbm', blankCbm.draftValues.cbm, 0);
}

// ─── Case 5: HS code lookup ──────────────────────────────────────────────────
function case5(): void {
  console.log('\n── Case 5: HS code ──');
  const cat = ALL_HS_CATEGORIES[0];
  const known = buildRowModel(product({ hsCategoryId: cat.id }), null, rates, '');
  check('known category shows its first example code', known.hsCode, cat.exampleHSCodes[0] ?? '—');
  const unknown = buildRowModel(product({ hsCategoryId: 'nope' }), null, rates, '');
  check('unknown category shows a dash', unknown.hsCode, '—');
}

// ─── Case 6: order totals ────────────────────────────────────────────────────
function case6(): void {
  console.log('\n── Case 6: order totals ──');
  const a = product({ id: 'a' });
  const b = product({ id: 'b', quantity: 30, piezasPorCaja: 3, cbm: 0.02, unitPriceRmb: 7.5, fleteInternoChinaRmb: 12 });
  const t = buildOrderTotals([a, b], rates);
  const ca = expectedCalc(a);
  const cb = expectedCalc(b);

  check('grandTotalCop', t.grandTotalCop, ca.precioTotalFinalCop + cb.precioTotalFinalCop);
  check('grandTotalFleteCop', t.grandTotalFleteCop, ca.fleteImpuestosCop + cb.fleteImpuestosCop);
  check('grandTotalCajas', t.grandTotalCajas, 10 + 10);
  check('orderTotalCbm', t.orderTotalCbm, 0.1 * 10 + 0.02 * 10);

  const empty = buildOrderTotals([], rates);
  check('empty order totals', `${empty.grandTotalCop}/${empty.grandTotalCajas}/${empty.grandTotalFleteCop}/${empty.orderTotalCbm}`, '0/0/0/0');

  // Totals ignore drafts: the model's draft-aware calc must not leak into them.
  const draftRow = buildRowModel(a, { ...seedDraft(a), unitPriceRmb: '99' }, rates, '');
  checkTrue('draft changes the row calc', draftRow.calc.precioTotalFinalCop !== ca.precioTotalFinalCop);
  check('totals still use saved products', buildOrderTotals([a], rates).grandTotalCop, ca.precioTotalFinalCop);
}

console.log('=== Quote row model — smoke tests ===');
case1();
case2();
case3();
case4();
case5();
case6();

if (failures > 0) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: all checks passed.');

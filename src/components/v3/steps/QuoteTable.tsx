import { useState, Fragment } from 'react';
import { calculateLandedCost } from '@/lib/calc/v3-landed';
import type { LandedCostResult } from '@/lib/calc/v3-landed';
import { ALL_HS_CATEGORIES, getHSCategory } from '@/data/hs-categories';
import type { ProductEntry, SupplierEntry } from '@/state/session/types';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { ArrowTopRightOnSquareIcon, XMarkIcon } from '@/components/ui/icons';
import { inputClasses } from '@/components/ui/fieldStyles';
import { FLETE_INTERNO_HELP, FLETE_INTERNO_LABEL } from '../copy';
import { Breakdown, GroupTh, Td, Th } from '../quote/cells';
import { ProductPhoto } from '../quote/ProductPhoto';
import { RatesCard } from '../quote/RatesCard';

const CUSTOM_HS = '__custom__';

interface EditDraft {
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

type ShareStatus = 'idle' | 'sharing' | 'success' | 'error';

interface QuoteTableProps {
  products: ProductEntry[];
  suppliers: SupplierEntry[];
  trmCopUsd: number;
  cnyToUsd: number;
  ratesFetchedAt: string | null;
  ratesUsedFallback: boolean;
  entityFiles?: ReadonlyMap<string, File>;
  onRemove: (id: string) => void;
  onUpdate: (id: string, fields: Partial<ProductEntry>) => void;
  onNewQuote?: () => void;
  onShare?: () => Promise<void>;
  shareStatus?: ShareStatus;
  sheetUrl?: string;
  shareError?: string;
}

function fmtCOP(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}

function seedDraft(p: ProductEntry): EditDraft {
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

function draftToFields(d: EditDraft): Partial<ProductEntry> | null {
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
function deriveDraftValues(p: ProductEntry, draft: EditDraft | null) {
  return {
    numCajas: draft ? (parseInt(draft.numCajas, 10) || 0) : 0,
    piezasPorCaja: draft ? (parseFloat(draft.piezasPorCaja) || p.piezasPorCaja) : p.piezasPorCaja,
    cbm: draft ? (parseFloat(draft.cbm) || p.cbm) : p.cbm,
    fleteInterno: draft ? (parseFloat(draft.fleteInternoChinaRmb) || 0) : (p.fleteInternoChinaRmb ?? 0),
  };
}

type DraftValues = ReturnType<typeof deriveDraftValues>;

// Text-style actions that live inside table cells. `-my-1.5` cancels the cell
// padding so the 44px touch target does not inflate the row.
const ROW_LINK_CLASS =
  'focus-ring -my-1.5 inline-flex min-h-[44px] items-center rounded px-2 text-xs font-semibold text-secondary underline underline-offset-4 hover:text-secondary-hover';

interface RowDetailProps {
  product: ProductEntry;
  file: File | undefined;
  calc: LandedCostResult;
  /** Non-null only while this row is being edited. */
  draft: EditDraft | null;
  draftValues: DraftValues;
  onDraftChange: (patch: Partial<EditDraft>) => void;
  saveError: string | null;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  sellingPrice: string;
  onSellingPriceChange: (value: string) => void;
  rentabilidad: number | null;
}

/** Expanded row: cost breakdown + profitability, or the edit form with a live preview. */
function RowDetail({
  product,
  file,
  calc,
  draft,
  draftValues,
  onDraftChange,
  saveError,
  onStartEdit,
  onSave,
  onCancel,
  sellingPrice,
  onSellingPriceChange,
  rentabilidad,
}: RowDetailProps) {
  const handleHsChange = (v: string) => {
    if (v === CUSTOM_HS) {
      onDraftChange({ hsCategoryId: CUSTOM_HS });
      return;
    }
    const cat = ALL_HS_CATEGORIES.find((c) => c.id === v);
    if (cat) {
      onDraftChange({
        hsCategoryId: v,
        arancelRate: String(Math.round(cat.arancelRate * 100)),
        ivaRate: String(Math.round(cat.ivaRate * 100)),
      });
    }
  };

  const hsOptions = [
    ...ALL_HS_CATEGORIES.map((cat) => ({ value: cat.id, label: cat.label })),
    { value: CUSTOM_HS, label: 'Personalizado' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Left: image + edit form or desglose */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        {file && <ProductPhoto file={file} />}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-heading">{draft ? 'Editar producto' : 'Desglose DDP'}</h3>
          {!draft && (
            <Button variant="link" size="sm" onClick={onStartEdit}>
              Editar
            </Button>
          )}
        </div>

        {draft ? (
          <div className="space-y-4">
            <TextField
              label="Nombre del producto"
              value={draft.name}
              onChange={(e) => onDraftChange({ name: e.target.value })}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="# Cajas"
                type="number"
                min={1}
                step={1}
                value={draft.numCajas}
                onChange={(e) => onDraftChange({ numCajas: e.target.value })}
                hint={
                  draftValues.numCajas > 0 && draftValues.piezasPorCaja > 0
                    ? `= ${draftValues.numCajas * draftValues.piezasPorCaja} piezas · ${(draftValues.cbm * draftValues.numCajas).toFixed(3)} m³ CBM total`
                    : undefined
                }
              />
              <TextField
                label="Precio unitario (¥ RMB)"
                type="number"
                value={draft.unitPriceRmb}
                onChange={(e) => onDraftChange({ unitPriceRmb: e.target.value })}
              />
              <TextField
                label="Piezas / caja"
                type="number"
                value={draft.piezasPorCaja}
                onChange={(e) => onDraftChange({ piezasPorCaja: e.target.value })}
              />
              <TextField
                label="CBM / caja"
                type="number"
                step="0.001"
                value={draft.cbm}
                onChange={(e) => onDraftChange({ cbm: e.target.value })}
              />
              <TextField
                label={`${FLETE_INTERNO_LABEL} (¥ RMB)`}
                hint={FLETE_INTERNO_HELP}
                type="number"
                step="0.01"
                min={0}
                value={draft.fleteInternoChinaRmb}
                onChange={(e) => onDraftChange({ fleteInternoChinaRmb: e.target.value })}
                wrapperClassName="sm:col-span-2"
              />
            </div>

            <SelectField
              label="Categoria arancelaria"
              value={draft.hsCategoryId}
              options={hsOptions}
              onChange={handleHsChange}
            />

            {draft.hsCategoryId === CUSTOM_HS && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Arancel (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.arancelRate}
                  onChange={(e) => onDraftChange({ arancelRate: e.target.value })}
                />
                <TextField
                  label="IVA (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.ivaRate}
                  onChange={(e) => onDraftChange({ ivaRate: e.target.value })}
                />
              </div>
            )}

            {saveError && <Alert kind="danger">{saveError}</Alert>}

            <div className="flex flex-wrap gap-3">
              <Button onClick={onSave} disabled={draftToFields(draft) === null}>
                Guardar
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Breakdown calc={calc} fleteInternoChinaRmb={product.fleteInternoChinaRmb ?? 0} />
        )}
      </div>

      {/* Right: rentabilidad / live preview when editing */}
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        {draft ? (
          <>
            <h3 className="text-sm font-semibold text-heading">Vista previa</h3>
            <Breakdown calc={calc} fleteInternoChinaRmb={draftValues.fleteInterno} />
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-heading">Rentabilidad</h3>
            <p className="text-sm text-content-muted">
              Costo unidad: COP${fmtCOP(calc.precioUnidadFinalCop)}
            </p>
            <TextField
              label="Precio de venta (COP / u)"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => onSellingPriceChange(e.target.value)}
              placeholder="Ej: 25000"
            />
            {rentabilidad !== null && (
              <div
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  rentabilidad >= 0
                    ? 'border-success/40 bg-success-surface text-success-content'
                    : 'border-danger/40 bg-danger-surface text-danger-content'
                }`}
              >
                <span className="text-sm font-semibold">Rentabilidad</span>
                <span className="text-base font-bold tabular-nums">
                  {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}%
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function QuoteTable({
  products,
  suppliers,
  trmCopUsd,
  cnyToUsd,
  ratesFetchedAt,
  ratesUsedFallback,
  entityFiles,
  onRemove,
  onUpdate,
  onNewQuote,
  onShare,
  shareStatus = 'idle',
  sheetUrl,
  shareError,
}: QuoteTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellingPrices, setSellingPrices] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEdit = (p: ProductEntry) => {
    setSaveError(null);
    setEditingId(p.id);
    setDraft(seedDraft(p));
  };

  const handleSave = (id: string) => {
    if (!draft) return;
    const fields = draftToFields(draft);
    if (!fields) {
      setSaveError('Nombre, # cajas y precio son requeridos.');
      return;
    }
    onUpdate(id, fields);
    setEditingId(null);
    setDraft(null);
    setSaveError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft(null);
    setSaveError(null);
  };

  const orderCalcs = products.map((p) =>
    calculateLandedCost({
      unitPriceRmb: p.unitPriceRmb,
      piezasPorCaja: p.piezasPorCaja,
      cbm: p.cbm,
      quantity: p.quantity,
      trmCopUsd,
      cnyToUsd,
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

  const copyAsText = () => {
    const today = new Date().toLocaleDateString('es-CO');
    const cnyDisplay = (1 / cnyToUsd).toFixed(4);
    const bySupplier = new Map<string, typeof products>();
    for (const p of products) {
      const existing = bySupplier.get(p.supplierId) ?? [];
      existing.push(p);
      bySupplier.set(p.supplierId, existing);
    }
    const lines: string[] = [
      `KUAIZI · Cotizacion ${today}`,
      `TRM ${trmCopUsd.toLocaleString('es-CO')} COP/USD · CNY ${cnyDisplay}/USD`,
      '',
    ];
    for (const [supplierId, prods] of bySupplier) {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const tel = supplier?.tel ? ` ${supplier.tel}` : '';
      lines.push(`[${supplier?.name ?? supplierId}${tel}]`);
      for (const p of prods) {
        const calc = calculateLandedCost({
          unitPriceRmb: p.unitPriceRmb,
          piezasPorCaja: p.piezasPorCaja,
          cbm: p.cbm,
          quantity: p.quantity,
          trmCopUsd,
          cnyToUsd,
          arancelRate: p.arancelRate,
          ivaRate: p.ivaRate,
          fleteInternoChinaRmb: p.fleteInternoChinaRmb ?? 0,
        });
        lines.push(
          `- ${p.name} x${p.quantity}  COP${fmtCOP(calc.precioUnidadFinalCop)}/u  = COP${fmtCOP(calc.precioTotalFinalCop)}`
        );
      }
      lines.push('');
    }
    lines.push(`TOTAL: COP${fmtCOP(grandTotalCop)}`);
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      <RatesCard
        trmCopUsd={trmCopUsd}
        cnyToUsd={cnyToUsd}
        ratesFetchedAt={ratesFetchedAt}
        ratesUsedFallback={ratesUsedFallback}
      />

      {/* Table */}
      {products.length > 0 && (
        <div
          role="region"
          aria-label="Cotización por producto"
          tabIndex={0}
          className="focus-ring overflow-x-auto rounded-xl border border-border bg-surface shadow-card"
        >
          <table className="w-full min-w-[1400px] text-xs">
            <thead>
              {/* Group header row */}
              <tr className="border-b border-border bg-surface-sunken">
                <GroupTh colSpan={4} groupEnd>
                  Especificaciones
                </GroupTh>
                <GroupTh colSpan={3} groupEnd>
                  Logistica
                </GroupTh>
                <GroupTh colSpan={9} groupEnd>
                  Precio
                </GroupTh>
                <GroupTh colSpan={2}>Rentabilidad</GroupTh>
                <th className="px-3 py-1.5" />
              </tr>
              {/* Column header row */}
              <tr className="border-b border-border bg-surface-raised">
                <Th align="center">#</Th>
                <Th align="left">Nombre</Th>
                <Th align="center">Foto</Th>
                <Th align="left" groupEnd>HSCODE</Th>
                <Th>Piezas/caja</Th>
                <Th># Cajas</Th>
                <Th groupEnd>CBM</Th>
                <Th>Precio Fabrica (¥)</Th>
                <Th>% Comision</Th>
                <Th>Flete Int. China (¥)</Th>
                <Th>Precio/u c/margen (¥)</Th>
                <Th>Cantidad</Th>
                <Th>Total Orden (¥)</Th>
                <Th>FLETE+IMP (COP)</Th>
                <Th>PRECIO UNIT (COP)</Th>
                <Th groupEnd>PRECIO TOTAL (COP)</Th>
                <Th>Precio Actual Colombia (COP)</Th>
                <Th>Rentabilidad %</Th>
                <Th ariaLabel="Acciones" />
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const isExpanded = expandedId === p.id;
                const isEditing = editingId === p.id && draft !== null;

                const dv = deriveDraftValues(p, draft);

                const draftProduct: ProductEntry = isEditing
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
                  trmCopUsd,
                  cnyToUsd,
                  arancelRate: draftProduct.arancelRate,
                  ivaRate: draftProduct.ivaRate,
                  fleteInternoChinaRmb: draftProduct.fleteInternoChinaRmb ?? 0,
                });

                const numCajas = p.piezasPorCaja > 0 ? Math.round(p.quantity / p.piezasPorCaja) : 0;
                const totalCbm = p.cbm * numCajas;

                const hsCat = p.hsCategoryId ? getHSCategory(p.hsCategoryId) : undefined;
                const hsCode = hsCat?.exampleHSCodes[0] ?? '—';

                const rawSellingPrice = sellingPrices[p.id] ?? '';
                const sellingPriceCop = parseFloat(rawSellingPrice.replace(/,/g, '.'));
                const rentabilidad =
                  !isNaN(sellingPriceCop) && sellingPriceCop > 0 && calc.precioUnidadFinalCop > 0
                    ? ((sellingPriceCop - calc.precioUnidadFinalCop) / calc.precioUnidadFinalCop) * 100
                    : null;

                const file = entityFiles?.get(p.id);
                const setSellingPrice = (value: string) =>
                  setSellingPrices((prev) => ({ ...prev, [p.id]: value }));

                return (
                  <Fragment key={p.id}>
                    <tr className="border-b border-border hover:bg-surface-raised">
                      <Td align="center" className="text-content-subtle">{idx + 1}</Td>
                      <Td align="left" className="min-w-[10rem] font-medium text-content">{p.name}</Td>
                      <Td align="center">
                        {file ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            aria-label={`Ver foto de ${p.name}`}
                            aria-expanded={isExpanded}
                            className={ROW_LINK_CLASS}
                          >
                            ver
                          </button>
                        ) : (
                          <span className="text-content-subtle">—</span>
                        )}
                      </Td>
                      <Td align="left" groupEnd className="text-content-muted">{hsCode}</Td>
                      <Td className="tabular-nums text-content">{p.piezasPorCaja}</Td>
                      <Td className="tabular-nums text-content">{numCajas}</Td>
                      <Td groupEnd className="tabular-nums text-content">{totalCbm.toFixed(3)}</Td>
                      <Td className="tabular-nums text-content">¥{p.unitPriceRmb.toFixed(2)}</Td>
                      <Td className="tabular-nums text-content-muted">5.00%</Td>
                      <Td className="tabular-nums text-content">¥{(p.fleteInternoChinaRmb ?? 0).toFixed(2)}</Td>
                      <Td className="tabular-nums text-content">¥{calc.precioConMargenRmb.toFixed(2)}</Td>
                      <Td className="tabular-nums text-content">{p.quantity}</Td>
                      <Td className="tabular-nums text-content">¥{calc.totalChinaRmb.toFixed(0)}</Td>
                      <Td className="tabular-nums text-content">COP${fmtCOP(calc.fleteImpuestosCop)}</Td>
                      <Td className="font-semibold tabular-nums text-content">COP${fmtCOP(calc.precioUnidadFinalCop)}</Td>
                      <Td groupEnd className="font-bold tabular-nums text-heading">COP${fmtCOP(calc.precioTotalFinalCop)}</Td>
                      <Td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rawSellingPrice}
                          onChange={(e) => setSellingPrice(e.target.value)}
                          placeholder="Ej: 25000"
                          aria-label={`Precio actual en Colombia (COP) de ${p.name}`}
                          className={inputClasses({ compact: true, widthClass: 'w-32', className: 'text-right' })}
                        />
                      </Td>
                      <Td>
                        {rentabilidad !== null ? (
                          <span
                            className={`font-semibold tabular-nums ${
                              rentabilidad >= 0 ? 'text-success-content' : 'text-danger-content'
                            }`}
                          >
                            {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-content-subtle">—</span>
                        )}
                      </Td>
                      <Td align="center">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            aria-label={`${isExpanded ? 'Cerrar' : 'Editar'} ${p.name}`}
                            aria-expanded={isExpanded}
                            className={ROW_LINK_CLASS}
                          >
                            {isExpanded ? 'cerrar' : 'editar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemove(p.id)}
                            aria-label={`Eliminar ${p.name}`}
                            className="focus-ring -my-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-danger-surface hover:text-danger-content"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-border bg-surface-raised">
                        <td colSpan={19} className="px-4 py-4">
                          {/* Pinned to the left edge of the scrolling table so the panel stays in view on phones */}
                          <div className="sticky left-4 w-[calc(100vw-4.5rem)] max-w-4xl">
                            <RowDetail
                              product={p}
                              file={file}
                              calc={calc}
                              draft={isEditing ? draft : null}
                              draftValues={dv}
                              onDraftChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
                              saveError={saveError}
                              onStartEdit={() => startEdit(p)}
                              onSave={() => handleSave(p.id)}
                              onCancel={handleCancel}
                              sellingPrice={rawSellingPrice}
                              onSellingPriceChange={setSellingPrice}
                              rentabilidad={rentabilidad}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Grand total row */}
              <tr className="border-t-2 border-border-strong bg-surface-raised">
                <Td colSpan={5} />
                <Td className="font-semibold tabular-nums text-content-muted">
                  {grandTotalCajas}
                </Td>
                <Td groupEnd className="whitespace-nowrap font-semibold tabular-nums text-content-muted">
                  {orderTotalCbm.toFixed(3)} m³
                </Td>
                <Td colSpan={6} className="text-sm font-bold text-content">
                  TOTAL
                </Td>
                <Td className="font-bold tabular-nums text-content">
                  COP${fmtCOP(grandTotalFleteCop)}
                </Td>
                <Td />
                <Td groupEnd className="text-sm font-bold tabular-nums text-heading">
                  COP${fmtCOP(grandTotalCop)}
                </Td>
                <Td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {products.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center text-sm text-content-subtle">
          No hay productos en la cotizacion todavia.
        </p>
      )}

      {/* Share result */}
      {shareStatus === 'success' && sheetUrl && (
        <Alert
          kind="success"
          action={
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('outline', 'md')}
            >
              Abrir Sheet
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          }
        >
          <span className="font-semibold">Sheet creado</span>
        </Alert>
      )}
      {shareStatus === 'error' && shareError && <Alert kind="danger">{shareError}</Alert>}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {products.length > 0 && onShare && (
          <Button onClick={onShare} disabled={shareStatus === 'sharing'} className="sm:min-w-[200px]">
            {shareStatus === 'sharing' ? (
              <>
                <Spinner size="sm" tone="current" />
                Creando Sheet...
              </>
            ) : shareStatus === 'success' ? (
              'Compartir de nuevo'
            ) : (
              'Compartir en Drive'
            )}
          </Button>
        )}
        {products.length > 0 && (
          <Button variant="outline" onClick={copyAsText} title="Copiar como texto">
            Copiar texto
          </Button>
        )}
        {onNewQuote && (
          <Button variant="ghost" onClick={onNewQuote}>
            Nueva cotizacion
          </Button>
        )}
      </div>
    </div>
  );
}

import type { LandedCostResult } from '@/lib/calc/v3-landed';
import { ALL_HS_CATEGORIES } from '@/data/hs-categories';
import type { ProductEntry } from '@/state/session/types';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { FLETE_INTERNO_HELP, FLETE_INTERNO_LABEL } from '../copy';
import { Breakdown } from './cells';
import { CUSTOM_HS, draftToFields } from './editDraft';
import type { DraftValues, EditDraft } from './editDraft';
import { fmtCOP } from './format';
import { ProductPhoto } from './ProductPhoto';

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
export function RowDetail({
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

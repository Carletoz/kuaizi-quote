import { useState, useEffect } from 'react';
import { useProductScan } from '@/hooks/useScan';
import { useSession } from '@/state/session/SessionProvider';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { ScanDropzone } from '@/components/ui/ScanDropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { calculateLandedCost } from '@/lib/calc/v3-landed';
import { ALL_HS_CATEGORIES, getHSCategory } from '@/data/hs-categories';
import type { DimensionsSource } from '@/state/session/types';

type PriceCurrency = 'RMB' | 'USD';

interface ProductFormState {
  name: string;
  numCajas: number;
  priceInputValue: number;
  priceCurrency: PriceCurrency;
  piezasPorCaja: number;
  cbm: number;
  dimensionsSource: DimensionsSource;
  hsCategoryId: string;
  arancelRate: number;
  ivaRate: number;
  fleteInternoChinaRmb: number;
}

const DEFAULT_FORM: ProductFormState = {
  name: '',
  numCajas: 1,
  priceInputValue: 0,
  priceCurrency: 'RMB',
  piezasPorCaja: 1,
  cbm: 0,
  dimensionsSource: 'direct',
  hsCategoryId: '',
  arancelRate: 0,
  ivaRate: 0.19,
  fleteInternoChinaRmb: 0,
};

const CURRENCY_OPTIONS: Array<{ value: PriceCurrency; label: string }> = [
  { value: 'RMB', label: '¥ RMB' },
  { value: 'USD', label: '$ USD' },
];

const HS_OPTIONS = [
  { value: '', label: 'Sin categoría — IVA 19%, arancel 0%' },
  ...ALL_HS_CATEGORIES.map((cat) => ({
    value: cat.id,
    label: `${cat.label} — arancel ${Math.round(cat.arancelRate * 100)}%`,
  })),
];

export function ProductStep() {
  const { state, dispatch, setEntityFile } = useSession();
  const scan = useProductScan();


  const [form, setForm] = useState<ProductFormState>(DEFAULT_FORM);
  const [scannedFile, setScannedFile] = useState<File | undefined>();
  const set = <K extends keyof ProductFormState>(k: K) =>
    (v: ProductFormState[K]) =>
      setForm((prev) => ({ ...prev, [k]: v }));

  // RMB ↔ USD helpers
  const toRmb = (value: number, currency: PriceCurrency): number => {
    if (currency === 'RMB') return value;
    return state.cnyToUsd > 0 ? value / state.cnyToUsd : 0;
  };

  const unitPriceRmb = toRmb(form.priceInputValue, form.priceCurrency);
  const quantity = form.numCajas * form.piezasPorCaja;

  const handleCurrencyToggle = (next: PriceCurrency) => {
    if (next === form.priceCurrency) return;
    // Convert displayed value to the new currency
    const converted =
      next === 'USD'
        ? form.priceInputValue * state.cnyToUsd
        : state.cnyToUsd > 0
          ? form.priceInputValue / state.cnyToUsd
          : form.priceInputValue;
    setForm((prev) => ({
      ...prev,
      priceCurrency: next,
      priceInputValue: parseFloat(converted.toFixed(4)),
    }));
  };

  // Pre-fill from scan result (always in RMB from n8n)
  useEffect(() => {
    if (scan.status === 'success' && scan.result) {
      const r = scan.result;
      setForm((prev) => ({
        ...prev,
        // convert to whatever currency is currently selected
        priceInputValue:
          prev.priceCurrency === 'RMB'
            ? r.unitPriceRmb
            : parseFloat((r.unitPriceRmb * state.cnyToUsd).toFixed(4)),
        piezasPorCaja: r.piezasPorCaja,
        cbm: r.cbm,
        dimensionsSource: r.dimensionsSource,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.status, scan.result]);

  const handleFile = (file: File) => {
    setScannedFile(file);
    scan.trigger(file);
  };

  const activeSupplier =
    state.activeSupplierIndex !== null ? state.suppliers[state.activeSupplierIndex] : null;

  const canCalcPreview =
    unitPriceRmb > 0 &&
    form.piezasPorCaja > 0 &&
    form.cbm > 0 &&
    form.numCajas > 0 &&
    state.trmCopUsd > 0 &&
    state.cnyToUsd > 0;

  const preview = canCalcPreview
    ? calculateLandedCost({
        unitPriceRmb,
        piezasPorCaja: form.piezasPorCaja,
        cbm: form.cbm,
        quantity,
        trmCopUsd: state.trmCopUsd,
        cnyToUsd: state.cnyToUsd,
        arancelRate: form.arancelRate,
        ivaRate: form.ivaRate,
        fleteInternoChinaRmb: form.fleteInternoChinaRmb,
      })
    : null;

  const handleHsChange = (id: string) => {
    const cat = id ? getHSCategory(id) : null;
    setForm((prev) => ({
      ...prev,
      hsCategoryId: id,
      arancelRate: cat ? cat.arancelRate : 0,
      ivaRate: cat ? cat.ivaRate : 0.19,
    }));
  };

  const canConfirm = form.name.trim().length > 0 && form.numCajas >= 1 && activeSupplier != null;

  const handleConfirm = () => {
    if (!canConfirm || !activeSupplier) return;
    const productId = crypto.randomUUID();
    if (scannedFile) setEntityFile(productId, scannedFile);
    dispatch({
      type: 'ADD_PRODUCT',
      payload: {
        id: productId,
        supplierId: activeSupplier.id,
        name: form.name.trim(),
        quantity,
        unitPriceRmb,
        piezasPorCaja: form.piezasPorCaja,
        cbm: form.cbm,
        dimensionsSource: form.dimensionsSource,
        hsCategoryId: form.hsCategoryId || undefined,
        arancelRate: form.arancelRate,
        ivaRate: form.ivaRate,
        fleteInternoChinaRmb: form.fleteInternoChinaRmb,
      },
    });
    dispatch({ type: 'SET_STEP', payload: 'review' });
    setForm(DEFAULT_FORM);
    setScannedFile(undefined);
    scan.reset();
  };

  const dimensionsLabel =
    form.dimensionsSource === 'direct' ? 'CBM directo (del tag)' : 'CBM calculado (dimensiones)';

  return (
    <section className="flex flex-col gap-6">
      {activeSupplier && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <Badge tone="brand">Proveedor activo</Badge>
          <p className="mt-1.5 break-words text-sm font-bold text-heading">{activeSupplier.name}</p>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-heading">Escanear producto</h2>
        <p className="mt-1 text-sm text-content-subtle">
          Foto la etiqueta de precio o ingresa los datos manualmente.
        </p>
      </div>

      <ScanDropzone
        label="Escanear etiqueta de precio"
        scanning={scan.status === 'scanning'}
        onFile={handleFile}
      />

      {scan.status === 'error' && (
        <Alert
          kind="danger"
          action={
            <Button variant="outline" onClick={scan.reset}>
              Reintentar
            </Button>
          }
        >
          {scan.error ?? 'Error al escanear'}
        </Alert>
      )}

      {/* Product form */}
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre del producto"
          required
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Camiseta talla M azul"
          autoComplete="off"
        />

        <div className="flex flex-col gap-1.5">
          <NumberField
            label="Precio / u"
            labelAccessory={
              <SegmentedControl
                size="sm"
                ariaLabel="Moneda del precio"
                options={CURRENCY_OPTIONS}
                value={form.priceCurrency}
                onChange={handleCurrencyToggle}
              />
            }
            value={form.priceInputValue}
            onChange={set('priceInputValue')}
            prefix={form.priceCurrency === 'RMB' ? '¥' : '$'}
            step={0.01}
            min={0}
          />
          {form.priceCurrency === 'USD' && unitPriceRmb > 0 && (
            <p className="text-xs text-content-subtle">
              ≈ ¥{unitPriceRmb.toFixed(2)} RMB
            </p>
          )}
          {form.priceCurrency === 'RMB' && form.priceInputValue > 0 && state.cnyToUsd > 0 && (
            <p className="text-xs text-content-subtle">
              ≈ ${(form.priceInputValue * state.cnyToUsd).toFixed(2)} USD
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <NumberField
              label="# Cajas"
              value={form.numCajas}
              onChange={(v) => setForm((prev) => ({ ...prev, numCajas: Math.max(1, Math.round(v)) }))}
              suffix="cajas"
              step={1}
              min={1}
            />
            {form.numCajas > 0 && form.piezasPorCaja > 0 && (
              <p className="text-xs text-content-subtle">= {quantity} uds totales</p>
            )}
          </div>
          <NumberField
            label="Piezas / caja"
            value={form.piezasPorCaja}
            onChange={(v) => setForm((prev) => ({ ...prev, piezasPorCaja: Math.max(1, Math.round(v)) }))}
            suffix="uds"
            step={1}
            min={1}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <NumberField
              label="CBM / caja"
              value={form.cbm}
              onChange={set('cbm')}
              hint="m³"
              step={0.0001}
              min={0}
            />
            {scan.status === 'success' && (
              <p className="text-xs text-content-subtle">{dimensionsLabel}</p>
            )}
          </div>
          <NumberField
            label="Flete Interno China (¥)"
            value={form.fleteInternoChinaRmb}
            onChange={set('fleteInternoChinaRmb')}
            prefix="¥"
            hint="RMB"
            step={0.01}
            min={0}
          />
        </div>

        {/* HS Category selector */}
        <SelectField
          label="Categoría HS (aranceles)"
          value={form.hsCategoryId}
          options={HS_OPTIONS}
          onChange={handleHsChange}
        />
      </div>

      {/* Live cost preview */}
      {preview && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-4">
          <p className="text-sm font-semibold text-heading">Vista previa del costo</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-content-muted">Precio / u final</dt>
              <dd className="font-semibold tabular-nums text-heading">
                {Math.round(preview.precioUnidadFinalCop).toLocaleString('es-CO')} COP
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-content-muted">Total ({quantity} uds)</dt>
              <dd className="font-bold tabular-nums text-heading">
                {Math.round(preview.precioTotalFinalCop).toLocaleString('es-CO')} COP
              </dd>
            </div>
          </dl>
        </div>
      )}

      <Button fullWidth size="lg" onClick={handleConfirm} disabled={!canConfirm}>
        Agregar producto
      </Button>
    </section>
  );
}

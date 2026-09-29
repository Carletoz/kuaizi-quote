import { useState, useEffect } from 'react';
import { useProductScan } from '@/hooks/useScan';
import { useSession } from '@/state/session/SessionProvider';
import { NumberField } from '@/components/ui/NumberField';
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannedFile(file);
    scan.trigger(file);
    e.target.value = '';
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
    <div className="space-y-5">
      {/* Active supplier badge */}
      {activeSupplier && (
        <div className="rounded-xl bg-kuaizi-secondary/10 border border-kuaizi-secondary/20 px-4 py-2">
          <p className="text-xs font-semibold text-kuaizi-secondary uppercase tracking-wide">
            Proveedor activo
          </p>
          <p className="text-sm font-bold text-kuaizi-ink">{activeSupplier.name}</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-kuaizi-ink">Escanear producto</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Foto la etiqueta de precio o ingresa los datos manualmente.
        </p>
      </div>

      {/* Scan trigger */}
      <label
        className={`w-full rounded-xl border-2 border-dashed border-kuaizi-secondary/40 bg-kuaizi-secondary/5 py-6 text-sm font-semibold text-kuaizi-secondary hover:bg-kuaizi-secondary/10 transition-colors flex items-center justify-center cursor-pointer ${scan.status === 'scanning' ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={scan.status === 'scanning'}
          onChange={handleFile}
        />
        {scan.status === 'scanning' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-kuaizi-secondary border-t-transparent rounded-full" />
            Analizando...
          </span>
        ) : (
          'Escanear etiqueta de precio'
        )}
      </label>

      {/* Error state */}
      {scan.status === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{scan.error ?? 'Error al escanear'}</p>
          <button
            type="button"
            onClick={scan.reset}
            className="text-xs font-semibold text-red-600 underline shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Product form */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-kuaizi-ink">
            Nombre del producto <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Camiseta talla M azul"
            className="rounded-md border border-gray-300 bg-white text-sm text-kuaizi-ink px-3 py-2 focus:outline-none focus:border-kuaizi-accent focus:ring-1 focus:ring-kuaizi-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <NumberField
              label="# Cajas"
              value={form.numCajas}
              onChange={(v) => setForm((prev) => ({ ...prev, numCajas: Math.max(1, Math.round(v)) }))}
              suffix="cajas"
              step={1}
              min={1}
            />
            {form.numCajas > 0 && form.piezasPorCaja > 0 && (
              <p className="text-xs text-gray-400">= {quantity} uds totales</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-kuaizi-ink">
                Precio / u
              </label>
              <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs font-semibold">
                {(['RMB', 'USD'] as PriceCurrency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCurrencyToggle(c)}
                    className={`px-2 py-0.5 transition-colors ${
                      form.priceCurrency === c
                        ? 'bg-kuaizi-secondary text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {c === 'RMB' ? '¥' : '$'} {c}
                  </button>
                ))}
              </div>
            </div>
            <NumberField
              label=""
              value={form.priceInputValue}
              onChange={set('priceInputValue')}
              prefix={form.priceCurrency === 'RMB' ? '¥' : '$'}
              hint={form.priceCurrency === 'RMB' ? 'CNY' : 'USD'}
              step={0.01}
              min={0}
            />
            {form.priceCurrency === 'USD' && unitPriceRmb > 0 && (
              <p className="text-xs text-gray-400">
                ≈ ¥{unitPriceRmb.toFixed(2)} RMB
              </p>
            )}
            {form.priceCurrency === 'RMB' && form.priceInputValue > 0 && state.cnyToUsd > 0 && (
              <p className="text-xs text-gray-400">
                ≈ ${(form.priceInputValue * state.cnyToUsd).toFixed(2)} USD
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Piezas / caja"
            value={form.piezasPorCaja}
            onChange={(v) => setForm((prev) => ({ ...prev, piezasPorCaja: Math.max(1, Math.round(v)) }))}
            suffix="uds"
            step={1}
            min={1}
          />
          <div className="flex flex-col gap-1">
            <NumberField
              label="CBM / caja"
              value={form.cbm}
              onChange={set('cbm')}
              hint="m³"
              step={0.0001}
              min={0}
            />
            {scan.status === 'success' && (
              <p className="text-xs text-kuaizi-secondary/70">{dimensionsLabel}</p>
            )}
          </div>
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-kuaizi-ink">
          Categoría HS (aranceles)
        </label>
        <select
          value={form.hsCategoryId}
          onChange={(e) => handleHsChange(e.target.value)}
          className="rounded-md border border-gray-300 bg-white text-sm text-kuaizi-ink px-3 py-2 focus:outline-none focus:border-kuaizi-accent focus:ring-1 focus:ring-kuaizi-accent"
        >
          <option value="">Sin categoría — IVA 19%, arancel 0%</option>
          {ALL_HS_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label} — arancel {Math.round(cat.arancelRate * 100)}%
            </option>
          ))}
        </select>
      </div>

      {/* Live cost preview */}
      {preview && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
            Vista previa del costo
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Precio / u final</span>
            <span className="font-semibold text-emerald-700">
              {Math.round(preview.precioUnidadFinalCop).toLocaleString('es-CO')} COP
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total ({quantity} uds)</span>
            <span className="font-bold text-emerald-700">
              {Math.round(preview.precioTotalFinalCop).toLocaleString('es-CO')} COP
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full rounded-xl bg-kuaizi-secondary text-white py-3 text-sm font-semibold hover:bg-kuaizi-secondary/90 transition-colors disabled:opacity-40"
      >
        Agregar producto
      </button>
    </div>
  );
}

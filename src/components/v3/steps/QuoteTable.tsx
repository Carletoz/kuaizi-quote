import { useState, Fragment } from 'react';
import type { ProductEntry } from '@/state/session/types';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowTopRightOnSquareIcon, XMarkIcon } from '@/components/ui/icons';
import { inputClasses } from '@/components/ui/fieldStyles';
import { NewQuoteConfirm } from '../NewQuoteConfirm';
import { GroupTh, Td, Th } from '../quote/cells';
import { draftToFields, seedDraft } from '../quote/editDraft';
import type { EditDraft } from '../quote/editDraft';
import { fmtCOP } from '../quote/format';
import { RatesCard } from '../quote/RatesCard';
import { RowDetail } from '../quote/RowDetail';
import { buildOrderTotals, buildRowModel } from '../quote/rowModel';

type ShareStatus = 'idle' | 'sharing' | 'success' | 'error';

interface QuoteTableProps {
  products: ProductEntry[];
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

// Text-style actions that live inside table cells. `-my-1.5` cancels the cell
// padding so the 44px touch target does not inflate the row.
const ROW_LINK_CLASS =
  'focus-ring -my-1.5 inline-flex min-h-[44px] items-center rounded px-2 text-xs font-semibold text-secondary underline underline-offset-4 hover:text-secondary-hover';

export function QuoteTable({
  products,
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
  const [confirmingNew, setConfirmingNew] = useState(false);

  // Starting over wipes the session, so ask first unless the quote is empty or already shared.
  const newQuoteNeedsConfirm = products.length > 0 && shareStatus !== 'success';

  const handleNewQuoteClick = () => {
    if (newQuoteNeedsConfirm) setConfirmingNew(true);
    else onNewQuote?.();
  };

  const confirmNewQuote = () => {
    setConfirmingNew(false);
    onNewQuote?.();
  };

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

  const rates = { trmCopUsd, cnyToUsd };
  const rows = products.map((p) =>
    buildRowModel(p, editingId === p.id ? draft : null, rates, sellingPrices[p.id] ?? '')
  );
  const { grandTotalCop, grandTotalCajas, grandTotalFleteCop, orderTotalCbm } = buildOrderTotals(products, rates);

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
              {rows.map((row, idx) => {
                const { product: p, isEditing, draftValues: dv, calc, numCajas, totalCbm, hsCode, rentabilidad } = row;
                const rawSellingPrice = row.sellingPrice;
                const isExpanded = expandedId === p.id;

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
        {onNewQuote && !confirmingNew && (
          <Button variant="ghost" onClick={handleNewQuoteClick}>
            Nueva cotización
          </Button>
        )}
      </div>

      {onNewQuote && confirmingNew && (
        <NewQuoteConfirm onCancel={() => setConfirmingNew(false)} onConfirm={confirmNewQuote} />
      )}
    </div>
  );
}

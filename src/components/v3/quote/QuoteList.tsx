import type { ProductEntry } from '@/state/session/types';
import { XMarkIcon } from '@/components/ui/icons';
import type { EditDraft } from './editDraft';
import { fmtCOP } from './format';
import { RowDetail } from './RowDetail';
import type { OrderTotals, RowModel } from './rowModel';

// Same look as the table's row links, without the negative margins that cancel
// table-cell padding. `-ml-2` lines the text up with the row content.
const DETAIL_LINK_CLASS =
  'focus-ring -ml-2 inline-flex min-h-[44px] items-center rounded px-2 text-xs font-semibold text-secondary underline underline-offset-4 hover:text-secondary-hover';

// Same as the table's remove button; `-mr-3.5` lines the icon up with the prices below it.
const REMOVE_BUTTON_CLASS =
  'focus-ring -my-1.5 -mr-3.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-danger-surface hover:text-danger-content';

interface QuoteListProps {
  rows: RowModel[];
  totals: OrderTotals;
  expandedId: string | null;
  onToggleExpanded: (id: string) => void;
  entityFiles?: ReadonlyMap<string, File>;
  /** The edit draft of whichever row is being edited (shared with the table). */
  draft: EditDraft | null;
  saveError: string | null;
  onDraftChange: (patch: Partial<EditDraft>) => void;
  onStartEdit: (product: ProductEntry) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onSellingPriceChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}

function boxesLine(row: RowModel): string {
  const { product: p, numCajas } = row;
  // Without a box size the "N cajas de M" breakdown has no meaning.
  if (!(p.piezasPorCaja > 0)) return `${p.quantity} uds`;
  return `${numCajas} ${numCajas === 1 ? 'caja' : 'cajas'} de ${p.piezasPorCaja} = ${p.quantity} uds`;
}

/**
 * Phone layout of the quote: one product per row instead of the wide table.
 * Receives the same row models as the table, so both always agree.
 */
export function QuoteList({
  rows,
  totals,
  expandedId,
  onToggleExpanded,
  entityFiles,
  draft,
  saveError,
  onDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  onSellingPriceChange,
  onRemove,
}: QuoteListProps) {
  return (
    <section aria-label="Cotización por producto" className="rounded-xl border border-border bg-surface shadow-card">
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const { product: p, isEditing, draftValues, calc, rentabilidad } = row;
          const isExpanded = expandedId === p.id;

          return (
            <li key={p.id}>
              <div className="px-4 pb-1 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-content">{p.name}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Eliminar ${p.name}`}
                    className={REMOVE_BUTTON_CLASS}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-0.5 text-xs tabular-nums text-content-muted">{boxesLine(row)}</p>

                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4">
                  <div>
                    <dt className="text-xs text-content-subtle">Precio unit.</dt>
                    <dd className="text-sm font-semibold tabular-nums text-content">
                      COP${fmtCOP(calc.precioUnidadFinalCop)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-content-subtle">Precio total</dt>
                    <dd className="text-base font-bold tabular-nums text-heading">
                      COP${fmtCOP(calc.precioTotalFinalCop)}
                    </dd>
                  </div>
                </dl>

                {rentabilidad !== null && (
                  <p className="mt-1 text-xs text-content-muted">
                    Rentabilidad{' '}
                    <span
                      className={`font-semibold tabular-nums ${
                        rentabilidad >= 0 ? 'text-success-content' : 'text-danger-content'
                      }`}
                    >
                      {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}%
                    </span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onToggleExpanded(p.id)}
                  aria-label={`${isExpanded ? 'Cerrar detalle de' : 'Ver detalle de'} ${p.name}`}
                  aria-expanded={isExpanded}
                  className={DETAIL_LINK_CLASS}
                >
                  {isExpanded ? 'Cerrar detalle' : 'Ver detalle'}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border bg-surface-raised p-3">
                  <RowDetail
                    product={p}
                    file={entityFiles?.get(p.id)}
                    calc={calc}
                    draft={isEditing ? draft : null}
                    draftValues={draftValues}
                    onDraftChange={onDraftChange}
                    saveError={saveError}
                    onStartEdit={() => onStartEdit(p)}
                    onSave={() => onSave(p.id)}
                    onCancel={onCancel}
                    sellingPrice={row.sellingPrice}
                    onSellingPriceChange={(value) => onSellingPriceChange(p.id, value)}
                    rentabilidad={rentabilidad}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="rounded-b-xl border-t-2 border-border-strong bg-surface-raised px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-content">Total</span>
          <span className="text-lg font-bold tabular-nums text-heading">COP${fmtCOP(totals.grandTotalCop)}</span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_auto_1fr] gap-x-4">
          <div>
            <dt className="text-xs text-content-subtle">Cajas</dt>
            <dd className="text-sm font-medium tabular-nums text-content">{totals.grandTotalCajas}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-subtle">CBM</dt>
            <dd className="whitespace-nowrap text-sm font-medium tabular-nums text-content">
              {totals.orderTotalCbm.toFixed(3)} m³
            </dd>
          </div>
          <div>
            <dt className="text-xs text-content-subtle">Flete + imp.</dt>
            <dd className="text-sm font-medium tabular-nums text-content">COP${fmtCOP(totals.grandTotalFleteCop)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { useSession } from '@/state/session/SessionProvider';
import { calculateLandedCost } from '@/lib/calc/v3-landed';
import { shareQuote } from '@/lib/scan/n8n';
import type { QuoteShareData } from '@/lib/scan/n8n';
import { QuoteTable } from './QuoteTable';

type ShareStatus = 'idle' | 'sharing' | 'success' | 'error';

export function ReviewStep() {
  const { state, dispatch, getEntityFiles, clearEntityFiles } = useSession();
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [sheetUrl, setSheetUrl] = useState<string | undefined>();
  const [shareError, setShareError] = useState<string | undefined>();

  const handleRemove = (id: string) => {
    dispatch({ type: 'REMOVE_PRODUCT', payload: { id } });
  };

  const handleNewQuote = () => {
    clearEntityFiles();
    dispatch({ type: 'RESET_SESSION' });
    setShareStatus('idle');
    setSheetUrl(undefined);
  };

  const handleShare = async () => {
    if (state.products.length === 0) return;
    setShareStatus('sharing');
    setShareError(undefined);

    try {
      const supplierMap = new Map(state.suppliers.map((s) => [s.id, s]));

      const products = state.products.map((p) => {
        const calc = calculateLandedCost({
          unitPriceRmb: p.unitPriceRmb,
          piezasPorCaja: p.piezasPorCaja,
          cbm: p.cbm,
          quantity: p.quantity,
          trmCopUsd: state.trmCopUsd,
          cnyToUsd: state.cnyToUsd,
          arancelRate: p.arancelRate,
          ivaRate: p.ivaRate,
          fleteInternoChinaRmb: p.fleteInternoChinaRmb ?? 0,
        });
        const supplier = supplierMap.get(p.supplierId);
        return {
          id: p.id,
          supplierId: p.supplierId,
          supplierName: supplier?.name ?? '—',
          supplierBitrixId: supplier?.bitrixId,
          name: p.name,
          quantity: p.quantity,
          unitPriceRmb: p.unitPriceRmb,
          piezasPorCaja: p.piezasPorCaja,
          cbm: p.cbm,
          arancelRate: p.arancelRate,
          ivaRate: p.ivaRate,
          fleteInternoChinaRmb: p.fleteInternoChinaRmb ?? 0,
          ...calc,
        };
      });

      const grandTotal = products.reduce((s, p) => s + p.precioTotalFinalCop, 0);

      const quoteData: QuoteShareData = {
        date: new Date().toLocaleDateString('es-CO'),
        trmCopUsd: state.trmCopUsd,
        cnyToUsd: state.cnyToUsd,
        grandTotal,
        suppliers: state.suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          tel: s.tel,
          location: s.location,
          bitrixId: s.bitrixId,
        })),
        products,
      };

      const { sheetUrl: url } = await shareQuote(quoteData, getEntityFiles());
      setSheetUrl(url);
      setShareStatus('success');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Error al compartir');
      setShareStatus('error');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-kuaizi-ink">Cotizacion</h2>
        <p className="text-sm text-gray-400 mt-0.5">Revisa los productos, exporta o agrega mas.</p>
      </div>

      <QuoteTable
        products={state.products}
        suppliers={state.suppliers}
        trmCopUsd={state.trmCopUsd}
        cnyToUsd={state.cnyToUsd}
        ratesFetchedAt={state.ratesFetchedAt}
        ratesUsedFallback={state.ratesUsedFallback}
        entityFiles={getEntityFiles()}
        onRemove={handleRemove}
        onUpdate={(id, fields) =>
          dispatch({ type: 'UPDATE_PRODUCT', payload: { id, ...fields } })
        }
        onNewQuote={handleNewQuote}
        onShare={handleShare}
        shareStatus={shareStatus}
        sheetUrl={sheetUrl}
        shareError={shareError}
      />

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'product' })}
          className="flex-1 rounded-xl border border-kuaizi-secondary text-kuaizi-secondary py-3 text-sm font-semibold hover:bg-kuaizi-secondary/5 transition-colors"
        >
          Agregar otro producto
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'supplier' })}
          className="flex-1 rounded-xl border border-gray-300 text-gray-600 py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Cambiar proveedor
        </button>
      </div>
    </div>
  );
}

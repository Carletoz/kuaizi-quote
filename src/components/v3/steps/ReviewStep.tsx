import { useState } from 'react';
import { useSession } from '@/state/session/SessionProvider';
import { referencedEntityIds } from '@/state/session/persistence';
import { calculateLandedCost } from '@/lib/calc/v3-landed';
import { shareQuote } from '@/lib/scan/n8n';
import { Button } from '@/components/ui/Button';
import type { QuoteShareData } from '@/lib/scan/n8n';
import { QuoteTable } from './QuoteTable';

type ShareStatus = 'idle' | 'sharing' | 'success' | 'error';

export function ReviewStep() {
  const { state, dispatch, getEntityFiles, removeEntityFile, startNewQuote } = useSession();
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [sheetUrl, setSheetUrl] = useState<string | undefined>();
  const [shareError, setShareError] = useState<string | undefined>();

  const handleRemove = (id: string) => {
    dispatch({ type: 'REMOVE_PRODUCT', payload: { id } });
    // A product's photo is stored under the product id.
    removeEntityFile(id);
  };

  const handleNewQuote = () => {
    startNewQuote();
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
          raw: s.raw,
          bitrixId: s.bitrixId,
        })),
        products,
      };

      // Photos are stored under supplier and product ids. Upload only those that
      // belong to this quote: the n8n flow makes every uploaded photo public.
      const referenced = referencedEntityIds(state);
      const files = new Map(Array.from(getEntityFiles()).filter(([id]) => referenced.has(id)));

      const { sheetUrl: url } = await shareQuote(quoteData, files);
      setSheetUrl(url);
      setShareStatus('success');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Error al compartir');
      setShareStatus('error');
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-heading">Cotizacion</h2>
        <p className="mt-1 text-sm text-content-subtle">Revisa los productos, exporta o agrega mas.</p>
      </div>

      <QuoteTable
        products={state.products}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="outline" onClick={() => dispatch({ type: 'SET_STEP', payload: 'product' })}>
          Agregar otro producto
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ type: 'SET_STEP', payload: 'supplier' })}>
          Cambiar proveedor
        </Button>
      </div>
    </section>
  );
}

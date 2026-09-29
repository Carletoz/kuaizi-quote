import { Badge } from '@/components/ui/Badge';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

interface RatesCardProps {
  trmCopUsd: number;
  cnyToUsd: number;
  ratesFetchedAt: string | null;
  ratesUsedFallback: boolean;
}

/** Exchange rates the whole quote was priced with. */
export function RatesCard({ trmCopUsd, cnyToUsd, ratesFetchedAt, ratesUsedFallback }: RatesCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-heading">Tasas de cambio</h3>
          <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs text-content-subtle">TRM</dt>
              <dd className="text-sm font-medium tabular-nums text-content">
                {trmCopUsd.toLocaleString('es-CO')} COP/USD
              </dd>
            </div>
            <div>
              <dt className="text-xs text-content-subtle">CNY</dt>
              <dd className="text-sm font-medium tabular-nums text-content">
                {(1 / cnyToUsd).toFixed(4)}/USD
              </dd>
            </div>
            <div>
              <dt className="text-xs text-content-subtle">Actualizado</dt>
              <dd className="text-sm font-medium tabular-nums text-content">{fmtDate(ratesFetchedAt)}</dd>
            </div>
          </dl>
        </div>
        {ratesUsedFallback && <Badge tone="warning">Tasa por defecto</Badge>}
      </div>
    </div>
  );
}

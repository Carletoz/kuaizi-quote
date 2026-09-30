import { Badge } from '@/components/ui/Badge';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/** Day/month and time only, so the three rates fit on one row on phones. */
function fmtDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    <div className="rounded-xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="w-full sm:w-auto">
          <h3 className="text-sm font-semibold text-heading">Tasas de cambio</h3>
          {/* Phones: one 3-column row. From `sm` up: the original wrapping flex row. */}
          <dl className="mt-2 grid grid-cols-3 gap-x-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            <div>
              <dt className="text-xs text-content-subtle">TRM</dt>
              <dd className="text-xs font-medium tabular-nums text-content sm:text-sm">
                {trmCopUsd.toLocaleString('es-CO')} COP/USD
              </dd>
            </div>
            <div>
              <dt className="text-xs text-content-subtle">CNY</dt>
              <dd className="text-xs font-medium tabular-nums text-content sm:text-sm">
                {(1 / cnyToUsd).toFixed(4)}/USD
              </dd>
            </div>
            <div>
              <dt className="text-xs text-content-subtle">Actualizado</dt>
              <dd className="text-xs font-medium tabular-nums text-content sm:text-sm">
                <span className="sm:hidden">{fmtDateShort(ratesFetchedAt)}</span>
                <span className="hidden sm:inline">{fmtDate(ratesFetchedAt)}</span>
              </dd>
            </div>
          </dl>
        </div>
        {ratesUsedFallback && <Badge tone="warning">Tasa por defecto</Badge>}
      </div>
    </div>
  );
}

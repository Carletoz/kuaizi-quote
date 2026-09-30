import type { ReactNode } from 'react';
import type { LandedCostResult } from '@/lib/calc/v3-landed';

type Align = 'left' | 'center' | 'right';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// A right border marks the end of a column group (Especificaciones / Logistica / Precio).
const GROUP_END = 'border-r border-border';

interface GroupThProps {
  colSpan: number;
  groupEnd?: boolean;
  children?: ReactNode;
}

/** Top-row header cell that spans one column group. */
export function GroupTh({ colSpan, groupEnd = false, children }: GroupThProps) {
  return (
    <th
      colSpan={colSpan}
      scope="colgroup"
      className={`px-3 py-1.5 text-center font-bold text-heading ${groupEnd ? GROUP_END : ''}`}
    >
      {children}
    </th>
  );
}

interface ThProps {
  align?: Align;
  groupEnd?: boolean;
  /** For columns with no visible label (the actions column). */
  ariaLabel?: string;
  children?: ReactNode;
}

/** Column header cell. Numeric columns are right-aligned by default. */
export function Th({ align = 'right', groupEnd = false, ariaLabel, children }: ThProps) {
  return (
    <th
      scope="col"
      aria-label={ariaLabel}
      className={`px-3 py-2 font-semibold text-content-muted ${ALIGN[align]} ${groupEnd ? GROUP_END : ''}`}
    >
      {children}
    </th>
  );
}

interface TdProps {
  align?: Align;
  groupEnd?: boolean;
  colSpan?: number;
  className?: string;
  children?: ReactNode;
}

/** Body cell. Numeric columns are right-aligned by default. */
export function Td({ align = 'right', groupEnd = false, colSpan, className = '', children }: TdProps) {
  return (
    <td colSpan={colSpan} className={`px-3 py-1.5 ${ALIGN[align]} ${groupEnd ? GROUP_END : ''} ${className}`}>
      {children}
    </td>
  );
}

function BreakdownRow({
  label,
  value,
  unit,
  bold,
}: {
  label: string;
  value: number;
  unit: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 py-0.5 text-sm ${
        bold ? 'mt-1 border-t border-border pt-1.5 font-bold text-heading' : 'text-content-muted'
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">
        {value.toLocaleString('es-CO', { maximumFractionDigits: 2 })} {unit}
      </dd>
    </div>
  );
}

/**
 * DDP cost breakdown for one product. Rendered from the saved product when
 * viewing and from the live draft while editing, so the caller passes the
 * flete it wants shown.
 */
export function Breakdown({
  calc,
  fleteInternoChinaRmb,
}: {
  calc: LandedCostResult;
  fleteInternoChinaRmb: number;
}) {
  return (
    <dl>
      <BreakdownRow label="Precio con margen (5%)" value={calc.precioConMargenRmb} unit="¥" />
      <BreakdownRow label="Flete interno China" value={fleteInternoChinaRmb} unit="¥" />
      <BreakdownRow label="Total China" value={calc.totalChinaRmb} unit="¥" bold />
      <BreakdownRow label="Flete + Impuestos" value={calc.fleteImpuestosCop} unit="COP" />
      <BreakdownRow label="Precio total final" value={calc.precioTotalFinalCop} unit="COP" bold />
      <BreakdownRow label="Precio unidad final" value={calc.precioUnidadFinalCop} unit="COP" bold />
    </dl>
  );
}

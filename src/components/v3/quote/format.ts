/** Whole pesos with es-CO thousands separators (no currency prefix). */
export function fmtCOP(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}

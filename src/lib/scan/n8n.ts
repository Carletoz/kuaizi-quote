import type { DimensionsSource } from '@/state/session/types';
import { compressToBase64 } from '@/lib/imageUtils';

export interface SupplierScanResult {
  name: string;
  tel?: string;
  location?: string;
  raw: string;
  bitrixId?: number;
}

export interface ProductScanResult {
  unitPriceRmb: number;
  piezasPorCaja: number;
  /** CBM per box — n8n extracts CBM for one full box, never per unit */
  cbm: number;
  dimensionsSource: DimensionsSource;
}

async function postImage(url: string | undefined, file: File): Promise<unknown> {
  if (!url) {
    throw new Error('Webhook no configurado. Agregá la URL en el archivo .env');
  }
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Scan request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if ('error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  return data;
}

export async function scanSupplier(file: File): Promise<SupplierScanResult> {
  const url = import.meta.env.VITE_N8N_SUPPLIER_WEBHOOK_URL;
  const data = (await postImage(url, file)) as Record<string, unknown>;

  if (typeof data.name !== 'string' || typeof data.raw !== 'string') {
    throw new Error('Invalid supplier scan response: missing required fields');
  }

  return {
    name: data.name,
    tel: typeof data.tel === 'string' ? data.tel : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    raw: data.raw,
    bitrixId: typeof data.bitrixId === 'number' ? data.bitrixId : undefined,
  };
}

// NOTE: the n8n Drive-sheet Apps Script must be updated separately to map the new payload keys
// (old USD-chain fields removed; new RMB+COP fields added below).
export interface QuoteProductItem {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierBitrixId?: number;
  name: string;
  quantity: number;
  unitPriceRmb: number;
  piezasPorCaja: number;
  cbm: number;
  arancelRate: number;
  ivaRate: number;
  // DDP calc results
  fleteInternoChinaRmb: number;
  precioConMargenRmb: number;
  totalChinaRmb: number;
  numCajas: number;
  fleteImpuestosCop: number;
  precioTotalFinalCop: number;
  precioUnidadFinalCop: number;
}

export interface QuoteImage {
  id: string;
  data: string;
  mimeType: string;
}

export interface QuoteShareData {
  date: string;
  trmCopUsd: number;
  cnyToUsd: number;
  grandTotal: number;
  suppliers: Array<{ id: string; name: string; tel?: string; location?: string; raw?: string; bitrixId?: number }>;
  products: QuoteProductItem[];
  images?: QuoteImage[];
}


export async function shareQuote(
  quoteData: QuoteShareData,
  entityFiles: ReadonlyMap<string, File>,
): Promise<{ sheetUrl: string }> {
  const url = import.meta.env.VITE_N8N_SHARE_WEBHOOK_URL;
  if (!url) throw new Error('Share webhook no configurado. Agregá VITE_N8N_SHARE_WEBHOOK_URL en .env.local');

  const images: QuoteImage[] = await Promise.all(
    Array.from(entityFiles.entries()).map(async ([id, file]) => ({
      id,
      data: await compressToBase64(file),
      mimeType: 'image/jpeg',
    })),
  );

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...quoteData, images }),
  });
  if (!res.ok) throw new Error(`Share failed: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.sheetUrl !== 'string') throw new Error((data.error as string) ?? 'No sheet URL returned');
  return { sheetUrl: data.sheetUrl };
}

export async function scanProduct(file: File): Promise<ProductScanResult> {
  const url = import.meta.env.VITE_N8N_PRODUCT_WEBHOOK_URL;
  const data = (await postImage(url, file)) as Record<string, unknown>;

  if (
    typeof data.unitPriceRmb !== 'number' ||
    typeof data.piezasPorCaja !== 'number' ||
    typeof data.cbm !== 'number' ||
    (data.dimensionsSource !== 'direct' && data.dimensionsSource !== 'reverse_engineered')
  ) {
    throw new Error('Invalid product scan response: missing or invalid required fields');
  }

  return {
    unitPriceRmb: data.unitPriceRmb,
    piezasPorCaja: data.piezasPorCaja,
    cbm: data.cbm,
    dimensionsSource: data.dimensionsSource as DimensionsSource,
  };
}

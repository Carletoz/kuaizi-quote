/**
 * In-progress wizard forms (the product being typed, the supplier being typed).
 *
 * They are mirrored to localStorage on every change so a closed tab does not
 * lose a half-filled form. Only plain, serialisable fields are stored:
 * `scannedFile` (a File) and scan status are deliberately left out.
 *
 * Like persistence.ts, everything here takes a `Storage`-like object and never
 * throws. Values are re-validated on read because they outlive deploys.
 */

import { getHSCategory } from '../../data/hs-categories';
import { isRecord, type StorageLike } from './persistence';
import type { DimensionsSource } from './types';

export const PRODUCT_DRAFT_KEY = 'kuaizi-quote-draft-product';
export const SUPPLIER_DRAFT_KEY = 'kuaizi-quote-draft-supplier';
export const DRAFT_VERSION = 1;

export type PriceCurrency = 'RMB' | 'USD';

export interface ProductFormState {
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

export const DEFAULT_PRODUCT_FORM: ProductFormState = {
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

export interface SupplierDraft {
  name: string;
  tel: string;
  location: string;
}

export const EMPTY_SUPPLIER_DRAFT: SupplierDraft = { name: '', tel: '', location: '' };

// ---------------------------------------------------------------------------
// Sanitizers: pick known keys, check types, fall back to defaults
// ---------------------------------------------------------------------------

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback;
}

export function sanitizeProductForm(raw: Record<string, unknown>): ProductFormState {
  const d = DEFAULT_PRODUCT_FORM;

  // HS ids changed before (the Alibaba taxonomy alignment), so an unknown id
  // falls back to "no category" instead of leaving the select on a ghost value.
  const category = typeof raw.hsCategoryId === 'string' ? getHSCategory(raw.hsCategoryId) : undefined;

  return {
    name: str(raw.name, d.name),
    numCajas: Math.max(1, Math.round(num(raw.numCajas, d.numCajas, 1))),
    priceInputValue: num(raw.priceInputValue, d.priceInputValue),
    priceCurrency: raw.priceCurrency === 'USD' || raw.priceCurrency === 'RMB' ? raw.priceCurrency : d.priceCurrency,
    piezasPorCaja: Math.max(1, Math.round(num(raw.piezasPorCaja, d.piezasPorCaja, 1))),
    cbm: num(raw.cbm, d.cbm),
    dimensionsSource:
      raw.dimensionsSource === 'direct' || raw.dimensionsSource === 'reverse_engineered'
        ? raw.dimensionsSource
        : d.dimensionsSource,
    hsCategoryId: category ? category.id : d.hsCategoryId,
    // Rates follow the category, exactly like the form's own category handler.
    arancelRate: category ? category.arancelRate : d.arancelRate,
    ivaRate: category ? category.ivaRate : d.ivaRate,
    fleteInternoChinaRmb: num(raw.fleteInternoChinaRmb, d.fleteInternoChinaRmb),
  };
}

export function sanitizeSupplierDraft(raw: Record<string, unknown>): SupplierDraft {
  return {
    name: str(raw.name, ''),
    tel: str(raw.tel, ''),
    location: str(raw.location, ''),
  };
}

// ---------------------------------------------------------------------------
// Storage access
// ---------------------------------------------------------------------------

interface DraftEnvelope<T> {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  data: T;
}

/** The stored draft, sanitised; null when absent, unreadable or from another version. */
export function readDraft<T>(
  storage: StorageLike,
  key: string,
  sanitize: (raw: Record<string, unknown>) => T,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== DRAFT_VERSION || !isRecord(parsed.data)) {
      removeDraft(storage, key);
      return null;
    }
    return sanitize(parsed.data);
  } catch {
    removeDraft(storage, key);
    return null;
  }
}

/** Returns false when the write failed (full or blocked storage); callers may ignore it. */
export function writeDraft<T>(storage: StorageLike, key: string, data: T, now: Date = new Date()): boolean {
  try {
    const envelope: DraftEnvelope<T> = { version: DRAFT_VERSION, savedAt: now.toISOString(), data };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best effort.
  }
}

/** Drops every in-progress form draft (used when starting a new quote). */
export function clearAllDrafts(storage: StorageLike): void {
  removeDraft(storage, PRODUCT_DRAFT_KEY);
  removeDraft(storage, SUPPLIER_DRAFT_KEY);
}

/** Field-by-field equality against the defaults, so a pristine form never occupies storage. */
export function isPristine<T extends object>(value: T, initial: T): boolean {
  return (Object.keys(initial) as Array<keyof T>).every((k) => value[k] === initial[k]);
}

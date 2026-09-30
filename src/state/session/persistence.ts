/**
 * Pure load/save/validate logic for the persisted quote session.
 *
 * Every function takes a `Storage`-like object instead of reaching for the
 * global, so the module can be exercised without a browser (see __smoke__.ts).
 * Nothing in here throws: storage can be blocked, full or corrupted, and none
 * of that may take the app down.
 *
 * The stored value is a versioned envelope. Data now outlives deploys, so any
 * change to `SessionState` that old payloads cannot satisfy must bump
 * `SESSION_VERSION` (an unknown version is dropped, never migrated by guess).
 */

import { initialSessionState } from './reducer';
import type { ProductEntry, SessionState, SupplierEntry, WizardStep } from './types';

export const SESSION_STORAGE_KEY = 'kuaizi-quote-session';
export const SESSION_VERSION = 1;

/** sessionStorage marker: present once this tab has been open before. */
export const TAB_ACTIVE_KEY = 'kuaizi-quote-tab-active';

/** The subset of `Storage` this module needs. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface PersistedSession {
  version: typeof SESSION_VERSION;
  savedAt: string;
  state: SessionState;
}

/**
 * - `loaded`: a valid saved quote with content.
 * - `empty`: nothing saved (or an envelope with no suppliers/products).
 * - `discarded`: an entry existed but was corrupt, foreign or an unknown version, and was removed.
 * - `unavailable`: storage could not be read at all (blocked, private mode).
 */
export type LoadStatus = 'loaded' | 'empty' | 'discarded' | 'unavailable';

export interface LoadResult {
  status: LoadStatus;
  state: SessionState;
  /** ISO timestamp of the last save; only set when `status` is `loaded`. */
  savedAt: string | null;
}

/** `removed` means the session was empty, so the key was cleared instead of written. */
export type SaveStatus = 'saved' | 'removed' | 'quota' | 'error';

const STEPS: readonly WizardStep[] = ['supplier', 'product', 'review'];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** `localStorage`, or null where it is missing or access throws (blocked site data). */
export function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** `sessionStorage`, or null where it is missing or access throws. */
export function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** True for the "storage is full" family across browsers (Chromium, Safari, Firefox). */
export function isQuotaError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: unknown; code?: unknown };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isOptionalString(v: unknown): boolean {
  return v === undefined || typeof v === 'string';
}

function isOptionalFiniteNumber(v: unknown): boolean {
  return v === undefined || isFiniteNumber(v);
}

// ---------------------------------------------------------------------------
// Session content helpers
// ---------------------------------------------------------------------------

/** A session is only worth saving (or resuming) once it has a supplier or a product. */
export function hasContent(state: SessionState): boolean {
  return state.suppliers.length > 0 || state.products.length > 0;
}

/**
 * Identity of everything the user built. Exchange rates are left out on
 * purpose: they are re-fetched on every open, so a rates-only change must not
 * rewrite storage (it would look like an edit to any other open tab).
 */
export function contentSignature(state: SessionState): string {
  return JSON.stringify([state.suppliers, state.products, state.activeSupplierIndex, state.step]);
}

/** Ids of every entity that legitimately owns a stored photo (suppliers and products). */
export function referencedEntityIds(state: SessionState): Set<string> {
  const ids = new Set<string>();
  for (const s of state.suppliers) ids.add(s.id);
  for (const p of state.products) ids.add(p.id);
  return ids;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function toSupplier(v: unknown): SupplierEntry | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  if (!isOptionalString(v.tel) || !isOptionalString(v.location) || !isOptionalString(v.raw)) return null;
  if (!isOptionalFiniteNumber(v.bitrixId)) return null;
  return v as unknown as SupplierEntry;
}

function toProduct(v: unknown): ProductEntry | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== 'string' || typeof v.supplierId !== 'string' || typeof v.name !== 'string') return null;
  if (
    !isFiniteNumber(v.quantity) ||
    !isFiniteNumber(v.unitPriceRmb) ||
    !isFiniteNumber(v.arancelRate) ||
    !isFiniteNumber(v.ivaRate)
  ) {
    return null;
  }
  if (v.dimensionsSource !== 'direct' && v.dimensionsSource !== 'reverse_engineered') return null;
  if (!isOptionalString(v.hsCategoryId) || !isOptionalFiniteNumber(v.fleteInternoChinaRmb)) return null;

  // The quote table's inline edit can leave these two as `undefined` when the
  // field is blanked, and JSON drops undefined keys. Treat "missing" as 0 (its
  // "unknown" value, which the table already guards with `> 0`) instead of
  // throwing away the whole quote over one cleared cell.
  return {
    ...(v as unknown as ProductEntry),
    piezasPorCaja: isFiniteNumber(v.piezasPorCaja) ? v.piezasPorCaja : 0,
    cbm: isFiniteNumber(v.cbm) ? v.cbm : 0,
  };
}

function mapAll<T>(list: unknown[], convert: (v: unknown) => T | null): T[] | null {
  const out: T[] = [];
  for (const item of list) {
    const converted = convert(item);
    if (converted === null) return null;
    out.push(converted);
  }
  return out;
}

/** Validates an untrusted value as a `SessionState`; null when it cannot be trusted. */
export function validateSessionState(raw: unknown): SessionState | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.suppliers) || !Array.isArray(raw.products)) return null;
  if (!STEPS.includes(raw.step as WizardStep)) return null;
  if (!isFiniteNumber(raw.trmCopUsd) || raw.trmCopUsd <= 0) return null;
  if (!isFiniteNumber(raw.cnyToUsd) || raw.cnyToUsd <= 0) return null;

  const suppliers = mapAll(raw.suppliers, toSupplier);
  const products = mapAll(raw.products, toProduct);
  if (!suppliers || !products) return null;

  const index = raw.activeSupplierIndex;
  if (index !== null && index !== undefined) {
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= suppliers.length) return null;
  }

  return {
    trmCopUsd: raw.trmCopUsd,
    cnyToUsd: raw.cnyToUsd,
    ratesFetchedAt: typeof raw.ratesFetchedAt === 'string' ? raw.ratesFetchedAt : null,
    ratesUsedFallback: typeof raw.ratesUsedFallback === 'boolean' ? raw.ratesUsedFallback : true,
    suppliers,
    products,
    activeSupplierIndex: typeof index === 'number' ? index : null,
    step: raw.step as WizardStep,
  };
}

function parseEnvelope(raw: string): { savedAt: string; state: SessionState } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== SESSION_VERSION) return null;
  if (typeof parsed.savedAt !== 'string' || Number.isNaN(Date.parse(parsed.savedAt))) return null;
  const state = validateSessionState(parsed.state);
  return state ? { savedAt: parsed.savedAt, state } : null;
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing more to do; the entry stays and will be discarded again next load.
  }
}

/** Reads the saved quote. Never throws; bad data is removed and reported as `discarded`. */
export function loadSession(storage: StorageLike): LoadResult {
  const fresh = (status: LoadStatus): LoadResult => ({ status, state: initialSessionState, savedAt: null });

  let raw: string | null;
  try {
    raw = storage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return fresh('unavailable');
  }
  if (raw === null) return fresh('empty');

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    safeRemove(storage, SESSION_STORAGE_KEY);
    return fresh('discarded');
  }
  if (!hasContent(envelope.state)) {
    safeRemove(storage, SESSION_STORAGE_KEY);
    return fresh('empty');
  }
  return { status: 'loaded', state: envelope.state, savedAt: envelope.savedAt };
}

/**
 * Writes the quote, or clears the key when the session is empty so an empty
 * session never produces a "resume" notice. Never throws.
 */
export function saveSession(storage: StorageLike, state: SessionState, now: Date = new Date()): SaveStatus {
  try {
    if (!hasContent(state)) {
      storage.removeItem(SESSION_STORAGE_KEY);
      return 'removed';
    }
    const envelope: PersistedSession = { version: SESSION_VERSION, savedAt: now.toISOString(), state };
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    return 'saved';
  } catch (err) {
    return isQuotaError(err) ? 'quota' : 'error';
  }
}

// ---------------------------------------------------------------------------
// Per-tab marker (sessionStorage)
// ---------------------------------------------------------------------------

/**
 * Whether this tab has been open before. A plain reload keeps sessionStorage,
 * so the marker survives it; a new tab or a new browser session starts without
 * one. When sessionStorage cannot be read we answer "yes" so the notice is
 * suppressed rather than repeated on every reload.
 */
export function wasTabActive(storage: StorageLike): boolean {
  try {
    return storage.getItem(TAB_ACTIVE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTabActive(storage: StorageLike): void {
  try {
    storage.setItem(TAB_ACTIVE_KEY, '1');
  } catch {
    // Best effort.
  }
}

/**
 * Smoke test for the session persistence layer.
 * Run via: npx tsx src/state/session/__smoke__.ts
 *
 * Exercises persistence.ts against an in-memory fake Storage (no browser).
 * Prints PASS/FAIL per case and exits non-zero when any case fails.
 */

import { initialSessionState } from './reducer';
import {
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  TAB_ACTIVE_KEY,
  contentSignature,
  hasContent,
  isQuotaError,
  loadSession,
  markTabActive,
  referencedEntityIds,
  saveSession,
  wasTabActive,
  type StorageLike,
} from './persistence';
import type { ProductEntry, SessionState, SupplierEntry } from './types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let failures = 0;

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e} but got ${a}`);
}

// ---------------------------------------------------------------------------
// Fakes and fixtures
// ---------------------------------------------------------------------------

interface FakeOptions {
  getError?: unknown;
  setError?: unknown;
  removeError?: unknown;
}

class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>();
  constructor(private readonly opts: FakeOptions = {}) {}

  getItem(key: string): string | null {
    if (this.opts.getError) throw this.opts.getError;
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.opts.setError) throw this.opts.setError;
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    if (this.opts.removeError) throw this.opts.removeError;
    this.data.delete(key);
  }
}

const supplier: SupplierEntry = { id: 's-1', name: 'Guangzhou Textiles', tel: '123', location: 'A12', bitrixId: 7 };

const product: ProductEntry = {
  id: 'p-1',
  supplierId: 's-1',
  name: 'Camiseta',
  quantity: 100,
  unitPriceRmb: 12.5,
  piezasPorCaja: 50,
  cbm: 0.12,
  dimensionsSource: 'direct',
  hsCategoryId: 'textiles',
  arancelRate: 0.15,
  ivaRate: 0.19,
  fleteInternoChinaRmb: 30,
};

const filled: SessionState = {
  ...initialSessionState,
  trmCopUsd: 4100,
  cnyToUsd: 0.14,
  ratesFetchedAt: '2026-09-30T10:00:00.000Z',
  ratesUsedFallback: false,
  suppliers: [supplier],
  products: [product],
  activeSupplierIndex: 0,
  step: 'review',
};

/** A storage holding `value` under the session key. */
function withRaw(value: string): FakeStorage {
  const storage = new FakeStorage();
  storage.data.set(SESSION_STORAGE_KEY, value);
  return storage;
}

function envelope(overrides: Record<string, unknown>): string {
  return JSON.stringify({ version: SESSION_VERSION, savedAt: '2026-09-30T10:00:00.000Z', state: filled, ...overrides });
}

function quotaError(): DOMException {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError');
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

run('valid round trip restores the same state and savedAt', () => {
  const storage = new FakeStorage();
  const now = new Date('2026-09-30T12:34:56.000Z');
  assertEqual(saveSession(storage, filled, now), 'saved', 'save status');

  const stored = JSON.parse(storage.data.get(SESSION_STORAGE_KEY) as string);
  assertEqual(stored.version, 1, 'stored version');
  assertEqual(stored.savedAt, now.toISOString(), 'stored savedAt');

  const loaded = loadSession(storage);
  assertEqual(loaded.status, 'loaded', 'load status');
  assertEqual(loaded.state, filled, 'restored state');
  assertEqual(loaded.savedAt, now.toISOString(), 'restored savedAt');
});

run('wrong version is discarded and the key removed', () => {
  const storage = withRaw(envelope({ version: 2 }));
  const loaded = loadSession(storage);
  assertEqual(loaded.status, 'discarded', 'status');
  assert(loaded.state === initialSessionState, 'falls back to the initial state');
  assert(!storage.data.has(SESSION_STORAGE_KEY), 'key removed');
});

run('legacy unversioned payload (the old sessionStorage shape) is discarded', () => {
  const storage = withRaw(JSON.stringify(filled));
  const loaded = loadSession(storage);
  assertEqual(loaded.status, 'discarded', 'status');
  assert(!storage.data.has(SESSION_STORAGE_KEY), 'key removed');
});

run('corrupt JSON is discarded and the key removed', () => {
  const storage = withRaw('{not valid json');
  const loaded = loadSession(storage);
  assertEqual(loaded.status, 'discarded', 'status');
  assert(loaded.state === initialSessionState, 'falls back to the initial state');
  assert(!storage.data.has(SESSION_STORAGE_KEY), 'key removed');
});

run('invalid shapes are discarded', () => {
  const badStates: Array<[string, unknown]> = [
    ['suppliers not an array', { ...filled, suppliers: 'nope' }],
    ['products not an array', { ...filled, products: {} }],
    ['unknown step', { ...filled, step: 'checkout' }],
    ['string exchange rate', { ...filled, trmCopUsd: '4100' }],
    ['zero exchange rate', { ...filled, cnyToUsd: 0 }],
    ['state is not an object', 'hello'],
    ['active supplier index out of range', { ...filled, activeSupplierIndex: 5 }],
    ['product without an id', { ...filled, products: [{ ...product, id: undefined }] }],
    ['product with a non-numeric price', { ...filled, products: [{ ...product, unitPriceRmb: 'x' }] }],
    ['product with an unknown dimensions source', { ...filled, products: [{ ...product, dimensionsSource: 'guess' }] }],
    ['supplier without a name', { ...filled, suppliers: [{ id: 's-1' }] }],
  ];
  for (const [label, state] of badStates) {
    const storage = withRaw(envelope({ state }));
    const loaded = loadSession(storage);
    assertEqual(loaded.status, 'discarded', label);
    assert(!storage.data.has(SESSION_STORAGE_KEY), `${label}: key removed`);
  }
});

run('invalid savedAt is discarded', () => {
  const storage = withRaw(envelope({ savedAt: 'yesterday-ish' }));
  assertEqual(loadSession(storage).status, 'discarded', 'status');
});

run('empty session removes the key instead of writing', () => {
  const storage = new FakeStorage();
  assertEqual(saveSession(storage, filled), 'saved', 'first save');
  assert(storage.data.has(SESSION_STORAGE_KEY), 'key written');

  assertEqual(saveSession(storage, initialSessionState), 'removed', 'empty save status');
  assert(!storage.data.has(SESSION_STORAGE_KEY), 'key removed');
  assertEqual(loadSession(storage).status, 'empty', 'load after clearing');
});

run('an envelope with no suppliers or products loads as empty and is removed', () => {
  const storage = withRaw(envelope({ state: initialSessionState }));
  assertEqual(loadSession(storage).status, 'empty', 'status');
  assert(!storage.data.has(SESSION_STORAGE_KEY), 'key removed');
});

run('nothing saved loads as empty', () => {
  const loaded = loadSession(new FakeStorage());
  assertEqual(loaded.status, 'empty', 'status');
  assert(loaded.state === initialSessionState, 'initial state');
  assertEqual(loaded.savedAt, null, 'savedAt');
});

run('a product with a cleared piezas/cbm cell still loads', () => {
  // The quote table can leave these undefined; JSON then drops the keys.
  const { piezasPorCaja: _p, cbm: _c, ...partial } = product;
  const storage = withRaw(envelope({ state: { ...filled, products: [partial] } }));
  const loaded = loadSession(storage);
  assertEqual(loaded.status, 'loaded', 'status');
  assertEqual(loaded.state.products[0].piezasPorCaja, 0, 'piezasPorCaja coerced');
  assertEqual(loaded.state.products[0].cbm, 0, 'cbm coerced');
});

run('storage that throws on write does not throw', () => {
  assertEqual(saveSession(new FakeStorage({ setError: new Error('SecurityError') }), filled), 'error', 'generic error');
  assertEqual(saveSession(new FakeStorage({ setError: quotaError() }), filled), 'quota', 'quota error');
  assertEqual(
    saveSession(new FakeStorage({ setError: { name: 'NS_ERROR_DOM_QUOTA_REACHED' } }), filled),
    'quota',
    'firefox quota error',
  );
  assertEqual(
    saveSession(new FakeStorage({ removeError: new Error('blocked') }), initialSessionState),
    'error',
    'throwing removeItem on empty save',
  );
});

run('storage that throws on read does not throw', () => {
  const loaded = loadSession(new FakeStorage({ getError: new Error('SecurityError') }));
  assertEqual(loaded.status, 'unavailable', 'status');
  assert(loaded.state === initialSessionState, 'initial state');
});

run('a discard survives storage that cannot remove the key', () => {
  const storage = new FakeStorage({ removeError: new Error('blocked') });
  storage.data.set(SESSION_STORAGE_KEY, 'garbage');
  assertEqual(loadSession(storage).status, 'discarded', 'status');
});

run('isQuotaError recognises the browser variants and ignores the rest', () => {
  assert(isQuotaError(quotaError()), 'DOMException QuotaExceededError');
  assert(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), 'Firefox name');
  assert(isQuotaError({ code: 22 }), 'legacy code 22');
  assert(!isQuotaError(new Error('nope')), 'plain Error');
  assert(!isQuotaError(null), 'null');
  assert(!isQuotaError('QuotaExceededError'), 'a bare string');
});

run('content helpers', () => {
  assert(hasContent(filled), 'filled has content');
  assert(!hasContent(initialSessionState), 'initial has no content');

  const ratesOnly: SessionState = { ...filled, trmCopUsd: 9999, ratesFetchedAt: null, ratesUsedFallback: true };
  assertEqual(contentSignature(ratesOnly), contentSignature(filled), 'rates do not change the signature');
  assert(contentSignature({ ...filled, step: 'product' }) !== contentSignature(filled), 'step changes it');

  assertEqual(Array.from(referencedEntityIds(filled)).sort(), ['p-1', 's-1'], 'supplier and product ids');
});

run('tab marker: absent on a new tab, present after marking, safe when storage throws', () => {
  const tab = new FakeStorage();
  assert(!wasTabActive(tab), 'new tab has no marker');
  markTabActive(tab);
  assert(tab.data.has(TAB_ACTIVE_KEY), 'marker written');
  assert(wasTabActive(tab), 'marker seen after a reload');

  assert(wasTabActive(new FakeStorage({ getError: new Error('x') })), 'unreadable storage suppresses the notice');
  markTabActive(new FakeStorage({ setError: new Error('x') }));
});

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.log(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log('\nAll cases passed');

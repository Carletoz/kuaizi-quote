/**
 * Smoke test for the session persistence layer.
 * Run via: npx tsx src/state/session/__smoke__.ts
 *
 * Exercises persistence.ts and drafts.ts against an in-memory fake Storage (no browser).
 * Prints PASS/FAIL per case and exits non-zero when any case fails.
 */

import { ALL_HS_CATEGORIES } from '../../data/hs-categories';
import {
  DEFAULT_PRODUCT_FORM,
  EMPTY_SUPPLIER_DRAFT,
  PRODUCT_DRAFT_KEY,
  SUPPLIER_DRAFT_KEY,
  clearAllDrafts,
  isPristine,
  readDraft,
  removeDraft,
  sanitizeProductForm,
  sanitizeSupplierDraft,
  writeDraft,
} from './drafts';
import { initialSessionState } from './reducer';
import {
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  TAB_ACTIVE_KEY,
  contentSignature,
  hasContent,
  isQuoteChangeEvent,
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

run('other-tab write detection: only the quote key (or a clear) in localStorage counts', () => {
  const local = new FakeStorage();
  const other = new FakeStorage();

  assert(isQuoteChangeEvent({ key: SESSION_STORAGE_KEY, storageArea: local }, local), 'quote key written');
  assert(isQuoteChangeEvent({ key: null, storageArea: local }, local), 'localStorage cleared');
  assert(!isQuoteChangeEvent({ key: PRODUCT_DRAFT_KEY, storageArea: local }, local), 'a draft key is ignored');
  assert(!isQuoteChangeEvent({ key: 'kuaizi-theme', storageArea: local }, local), 'an unrelated key is ignored');
  assert(!isQuoteChangeEvent({ key: SESSION_STORAGE_KEY, storageArea: other }, local), 'another storage area');
  assert(!isQuoteChangeEvent({ key: SESSION_STORAGE_KEY, storageArea: local }, null), 'localStorage unavailable here');
});

// ---------------------------------------------------------------------------
// Form drafts
// ---------------------------------------------------------------------------

run('product draft round trip restores the same form', () => {
  const storage = new FakeStorage();
  const form = { ...DEFAULT_PRODUCT_FORM, name: 'Taza', numCajas: 4, priceInputValue: 3.5, cbm: 0.05 };
  assert(writeDraft(storage, PRODUCT_DRAFT_KEY, form), 'write succeeded');

  const stored = JSON.parse(storage.data.get(PRODUCT_DRAFT_KEY) as string);
  assertEqual(stored.version, 1, 'stored version');

  assertEqual(readDraft(storage, PRODUCT_DRAFT_KEY, sanitizeProductForm), form, 'restored form');
});

run('a missing draft reads as null', () => {
  assertEqual(readDraft(new FakeStorage(), PRODUCT_DRAFT_KEY, sanitizeProductForm), null, 'no draft');
});

run('draft with a wrong version or corrupt JSON is dropped', () => {
  const wrongVersion = new FakeStorage();
  wrongVersion.data.set(PRODUCT_DRAFT_KEY, JSON.stringify({ version: 9, savedAt: 'x', data: { name: 'old' } }));
  assertEqual(readDraft(wrongVersion, PRODUCT_DRAFT_KEY, sanitizeProductForm), null, 'wrong version');
  assert(!wrongVersion.data.has(PRODUCT_DRAFT_KEY), 'wrong version removed');

  const corrupt = new FakeStorage();
  corrupt.data.set(PRODUCT_DRAFT_KEY, '}{');
  assertEqual(readDraft(corrupt, PRODUCT_DRAFT_KEY, sanitizeProductForm), null, 'corrupt');
  assert(!corrupt.data.has(PRODUCT_DRAFT_KEY), 'corrupt removed');

  const notAnObject = new FakeStorage();
  notAnObject.data.set(PRODUCT_DRAFT_KEY, JSON.stringify({ version: 1, savedAt: 'x', data: 'text' }));
  assertEqual(readDraft(notAnObject, PRODUCT_DRAFT_KEY, sanitizeProductForm), null, 'data not an object');
});

run('product form sanitizer picks known keys and falls back to defaults on bad types', () => {
  const restored = sanitizeProductForm({
    name: 42,
    numCajas: 'many',
    priceInputValue: -5,
    priceCurrency: 'EUR',
    piezasPorCaja: 0,
    cbm: null,
    dimensionsSource: 'guess',
    hsCategoryId: 7,
    fleteInternoChinaRmb: Number.NaN,
    scannedFile: { fake: true },
    somethingElse: 'ignored',
  });
  assertEqual(restored, DEFAULT_PRODUCT_FORM, 'all defaults');
  assert(!('scannedFile' in restored) && !('somethingElse' in restored), 'unknown keys dropped');
});

run('product form sanitizer clamps counts and resolves the HS category', () => {
  const category = ALL_HS_CATEGORIES[0];
  assert(category !== undefined, 'fixture: at least one HS category');

  const known = sanitizeProductForm({ hsCategoryId: category.id, numCajas: 2.6, piezasPorCaja: 12 });
  assertEqual(known.hsCategoryId, category.id, 'known category kept');
  assertEqual(known.arancelRate, category.arancelRate, 'arancel follows the category');
  assertEqual(known.ivaRate, category.ivaRate, 'iva follows the category');
  assertEqual(known.numCajas, 3, 'numCajas rounded');

  const ghost = sanitizeProductForm({ hsCategoryId: 'removed-in-a-deploy', arancelRate: 0.4, ivaRate: 0.05 });
  assertEqual(ghost.hsCategoryId, '', 'unknown category cleared');
  assertEqual(ghost.arancelRate, 0, 'default arancel');
  assertEqual(ghost.ivaRate, 0.19, 'default iva');
});

run('supplier draft round trip and sanitizer', () => {
  const storage = new FakeStorage();
  const draft = { name: 'Yiwu Co.', tel: 'wx123', location: 'Stand 4' };
  writeDraft(storage, SUPPLIER_DRAFT_KEY, draft);
  assertEqual(readDraft(storage, SUPPLIER_DRAFT_KEY, sanitizeSupplierDraft), draft, 'restored draft');

  assertEqual(sanitizeSupplierDraft({ name: 1, tel: null, extra: 'x' }), EMPTY_SUPPLIER_DRAFT, 'bad types fall back');
});

run('pristine forms are recognised; edited ones are not', () => {
  assert(isPristine({ ...DEFAULT_PRODUCT_FORM }, DEFAULT_PRODUCT_FORM), 'defaults are pristine');
  assert(!isPristine({ ...DEFAULT_PRODUCT_FORM, name: 'x' }, DEFAULT_PRODUCT_FORM), 'edited product form');
  assert(isPristine({ ...EMPTY_SUPPLIER_DRAFT }, EMPTY_SUPPLIER_DRAFT), 'empty supplier draft');
  assert(!isPristine({ ...EMPTY_SUPPLIER_DRAFT, tel: '1' }, EMPTY_SUPPLIER_DRAFT), 'edited supplier draft');
});

run('clearAllDrafts removes both drafts and leaves the session alone', () => {
  const storage = new FakeStorage();
  saveSession(storage, filled);
  writeDraft(storage, PRODUCT_DRAFT_KEY, DEFAULT_PRODUCT_FORM);
  writeDraft(storage, SUPPLIER_DRAFT_KEY, EMPTY_SUPPLIER_DRAFT);

  clearAllDrafts(storage);
  assert(!storage.data.has(PRODUCT_DRAFT_KEY) && !storage.data.has(SUPPLIER_DRAFT_KEY), 'drafts removed');
  assert(storage.data.has(SESSION_STORAGE_KEY), 'session untouched');
});

run('draft storage that throws never throws', () => {
  const broken = new FakeStorage({
    getError: new Error('x'),
    setError: quotaError(),
    removeError: new Error('x'),
  });
  assertEqual(writeDraft(broken, PRODUCT_DRAFT_KEY, DEFAULT_PRODUCT_FORM), false, 'write reports failure');
  assertEqual(readDraft(broken, PRODUCT_DRAFT_KEY, sanitizeProductForm), null, 'read reports nothing');
  removeDraft(broken, PRODUCT_DRAFT_KEY);
  clearAllDrafts(broken);
});

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.log(`\n${failures} case(s) failed`);
  process.exit(1);
}
console.log('\nAll cases passed');

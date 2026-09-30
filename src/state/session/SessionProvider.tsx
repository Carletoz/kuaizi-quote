import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { sessionReducer, initialSessionState } from './reducer';
import type { SessionState, SessionAction } from './types';
import { saveImage, loadAllImages, clearImages } from '@/lib/imageDb';
import { clearAllDrafts } from './drafts';
import {
  contentSignature,
  getLocalStorage,
  getSessionStorage,
  isQuoteChangeEvent,
  isQuotaError,
  loadSession,
  markTabActive,
  saveSession,
  wasTabActive,
  type LoadResult,
} from './persistence';

export const STORAGE_FULL_MESSAGE =
  'No hay espacio para guardar tu cotización. Comparte en Drive antes de cerrar esta pestaña.';

interface Boot {
  load: LoadResult;
  /** ISO time of the saved quote, only when it should be offered for resuming (see below). */
  resumeSavedAt: string | null;
}

/**
 * The saved quote is read once per page load. Memoised at module level because
 * React StrictMode runs state initialisers twice in development.
 *
 * The resume notice is offered only when a saved quote exists and this tab has
 * not been open before: a plain reload keeps the sessionStorage marker, a new
 * tab or a new browser session does not.
 */
let bootCache: Boot | null = null;

function boot(): Boot {
  if (!bootCache) {
    const local = getLocalStorage();
    const load: LoadResult = local
      ? loadSession(local)
      : { status: 'unavailable', state: initialSessionState, savedAt: null };
    const session = getSessionStorage();
    const tabWasActive = session ? wasTabActive(session) : true;
    bootCache = {
      load,
      resumeSavedAt: load.status === 'loaded' && !tabWasActive ? load.savedAt : null,
    };
  }
  return bootCache;
}

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  imagesReady: boolean;
  /** Set when the quote or a photo could not be saved because storage is full. */
  storageWarning: string | null;
  /** ISO time of the saved quote being offered for resuming, or null when no notice should show. */
  resumeSavedAt: string | null;
  dismissResumeNotice: () => void;
  /**
   * True once another tab has written the saved quote. localStorage is shared and
   * last write wins, so this tab stops writing until it is reloaded.
   */
  storageConflict: boolean;
  /** Bumps on every new quote so the wizard can remount steps that hold local form state. */
  quoteEpoch: number;
  setEntityFile: (id: string, file: File) => void;
  getEntityFiles: () => ReadonlyMap<string, File>;
  clearEntityFiles: () => void;
  /** The single start-over action: wipes photos and resets the session (rates are kept). */
  startNewQuote: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, (): SessionState => boot().load.state);
  const filesRef = useRef<Map<string, File>>(new Map());
  const [imagesReady, setImagesReady] = useState(false);
  const [stateQuotaHit, setStateQuotaHit] = useState(false);
  const [imageQuotaHit, setImageQuotaHit] = useState(false);
  const [resumeSavedAt, setResumeSavedAt] = useState<string | null>(() => boot().resumeSavedAt);
  const [quoteEpoch, setQuoteEpoch] = useState(0);

  // Mirrors `storageConflict` for code that must not wait for a re-render (saves, photo and draft writes).
  const conflictRef = useRef(false);
  const [storageConflict, setStorageConflict] = useState(false);

  // The `storage` event fires only in the *other* tabs. If one of them wrote the
  // saved quote (or cleared storage), what this tab holds is stale: stop writing
  // so we never overwrite their data, and ask the user to reload.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!isQuoteChangeEvent(e, getLocalStorage())) return;
      conflictRef.current = true;
      setStorageConflict(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // From now on this tab counts as active, so reloading it does not offer the resume notice again.
  useEffect(() => {
    const storage = getSessionStorage();
    if (storage) markTabActive(storage);
  }, []);

  // Ask the browser not to evict our storage under pressure. Best effort only.
  useEffect(() => {
    try {
      navigator.storage?.persist?.()?.catch(() => {});
    } catch {
      // Unsupported or blocked: nothing to do.
    }
  }, []);

  useEffect(() => {
    loadAllImages()
      .then((map) => {
        map.forEach((file, id) => filesRef.current.set(id, file));
      })
      .catch(() => {})
      .finally(() => setImagesReady(true));
  }, []);

  const setEntityFile = useCallback((id: string, file: File) => {
    filesRef.current.set(id, file);
    if (conflictRef.current) return;
    saveImage(id, file)
      .then(() => setImageQuotaHit(false))
      .catch((err: unknown) => {
        // Only a full disk is worth telling the user about; the photo stays in memory either way.
        if (isQuotaError(err)) setImageQuotaHit(true);
      });
  }, []);

  const getEntityFiles = useCallback(() => filesRef.current as ReadonlyMap<string, File>, []);

  const clearEntityFiles = useCallback(() => {
    filesRef.current.clear();
    // In conflict the shared photo store belongs to the other tab's quote too: leave it alone.
    if (conflictRef.current) return;
    clearImages().catch(() => {});
  }, []);

  const dismissResumeNotice = useCallback(() => setResumeSavedAt(null), []);

  const startNewQuote = useCallback(() => {
    clearEntityFiles();
    const storage = getLocalStorage();
    if (storage && !conflictRef.current) clearAllDrafts(storage);
    setStateQuotaHit(false);
    setImageQuotaHit(false);
    setResumeSavedAt(null);
    setQuoteEpoch((n) => n + 1);
    dispatch({ type: 'RESET_SESSION' });
  }, [clearEntityFiles]);

  // Signature of the last content written (or loaded), so a rates-only change
  // never rewrites storage.
  const lastSavedRef = useRef<string>(contentSignature(state));

  useEffect(() => {
    if (conflictRef.current) return;
    const signature = contentSignature(state);
    if (signature === lastSavedRef.current) return;
    const storage = getLocalStorage();
    if (!storage) return;

    const result = saveSession(storage, state);
    if (result === 'saved' || result === 'removed') {
      lastSavedRef.current = signature;
      setStateQuotaHit(false);
    } else if (result === 'quota') {
      setStateQuotaHit(true);
    }
  }, [state]);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;

    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { signal })
      .then((r) => r.json())
      .then((data) => {
        const cop = data?.usd?.cop;
        const cny = data?.usd?.cny;
        if (typeof cop === 'number' && cop > 0 && typeof cny === 'number' && cny > 0) {
          dispatch({
            type: 'SET_RATES',
            payload: { trmCopUsd: Math.round(cop), cnyToUsd: 1 / cny, fetchedAt: new Date().toISOString() },
          });
        } else {
          dispatch({ type: 'SET_RATES_FALLBACK', payload: { trmCopUsd: 4200, cnyToUsd: 0.138 } });
        }
      })
      .catch(() => {
        if (!signal.aborted) {
          dispatch({ type: 'SET_RATES_FALLBACK', payload: { trmCopUsd: 4200, cnyToUsd: 0.138 } });
        }
      });

    return () => ctrl.abort();
  }, []);

  const storageWarning = stateQuotaHit || imageQuotaHit ? STORAGE_FULL_MESSAGE : null;

  return (
    <SessionContext.Provider
      value={{
        state,
        dispatch,
        imagesReady,
        storageWarning,
        resumeSavedAt,
        dismissResumeNotice,
        storageConflict,
        quoteEpoch,
        setEntityFile,
        getEntityFiles,
        clearEntityFiles,
        startNewQuote,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}

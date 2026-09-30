import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { sessionReducer, initialSessionState } from './reducer';
import type { SessionState, SessionAction } from './types';
import { saveImage, loadAllImages, clearImages } from '@/lib/imageDb';
import {
  contentSignature,
  getLocalStorage,
  isQuotaError,
  loadSession,
  saveSession,
  type LoadResult,
} from './persistence';

export const STORAGE_FULL_MESSAGE =
  'No hay espacio para guardar tu cotización. Comparte en Drive antes de cerrar esta pestaña.';

/**
 * The saved quote is read once per page load. Memoised at module level because
 * React StrictMode runs state initialisers twice in development.
 */
let bootCache: LoadResult | null = null;

function boot(): LoadResult {
  if (!bootCache) {
    const storage = getLocalStorage();
    bootCache = storage
      ? loadSession(storage)
      : { status: 'unavailable', state: initialSessionState, savedAt: null };
  }
  return bootCache;
}

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  imagesReady: boolean;
  /** Set when the quote or a photo could not be saved because storage is full. */
  storageWarning: string | null;
  setEntityFile: (id: string, file: File) => void;
  getEntityFiles: () => ReadonlyMap<string, File>;
  clearEntityFiles: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, (): SessionState => boot().state);
  const filesRef = useRef<Map<string, File>>(new Map());
  const [imagesReady, setImagesReady] = useState(false);
  const [stateQuotaHit, setStateQuotaHit] = useState(false);
  const [imageQuotaHit, setImageQuotaHit] = useState(false);

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
    clearImages().catch(() => {});
  }, []);

  // Signature of the last content written (or loaded), so a rates-only change
  // never rewrites storage.
  const lastSavedRef = useRef<string>(contentSignature(state));

  useEffect(() => {
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
      value={{ state, dispatch, imagesReady, storageWarning, setEntityFile, getEntityFiles, clearEntityFiles }}
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

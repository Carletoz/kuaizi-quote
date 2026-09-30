import { useCallback, useRef, useState } from 'react';
import { getLocalStorage } from './persistence';
import { isPristine, readDraft, removeDraft, writeDraft } from './drafts';

type Updater<T> = T | ((prev: T) => T);

/**
 * `useState` for a wizard form whose value is mirrored to localStorage.
 *
 * The mirror is written synchronously inside the setter (not from an effect),
 * so a keystroke is on disk even if the tab closes right after it. The value
 * is restored on mount through `sanitize`, which re-validates it because it
 * outlives deploys. A form equal to `initial` is removed from storage rather
 * than written.
 *
 * Returns `[value, setValue, reset]`; `reset` returns the form to `initial` and
 * clears its stored draft (use it after the entry is confirmed).
 */
export function useFormDraft<T extends object>(
  key: string,
  initial: T,
  sanitize: (raw: Record<string, unknown>) => T,
): [T, (next: Updater<T>) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    const storage = getLocalStorage();
    return (storage && readDraft(storage, key, sanitize)) || initial;
  });

  // Always-current copy, so two setters fired in the same tick both see the first one's result.
  const valueRef = useRef(value);

  const update = useCallback(
    (next: Updater<T>) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);

      const storage = getLocalStorage();
      if (!storage) return;
      if (isPristine(resolved, initial)) removeDraft(storage, key);
      else writeDraft(storage, key, resolved);
    },
    [key, initial],
  );

  const reset = useCallback(() => update(initial), [update, initial]);

  return [value, update, reset];
}

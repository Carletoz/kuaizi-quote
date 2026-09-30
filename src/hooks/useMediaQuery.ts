import { useEffect, useState } from 'react';

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Tracks a CSS media query. The first render already reads the real value, so
 * there is no flash of the wrong layout.
 *
 * @param fallback Value used where `matchMedia` does not exist (SSR, old test runners).
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    canMatchMedia() ? window.matchMedia(query).matches : fallback
  );

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Re-sync in case the query changed or the viewport moved between render and subscribe.
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

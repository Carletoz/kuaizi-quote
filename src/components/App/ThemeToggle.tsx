import { useState } from 'react';
import { getInitialTheme, setTheme, type Theme } from '@/lib/theme';
import { MoonIcon, SunIcon } from '@/components/ui/icons';

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const isDark = theme === 'dark';

  function toggle() {
    const next: Theme = isDark ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="focus-ring flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-content-muted transition-colors hover:bg-surface-raised hover:text-content"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

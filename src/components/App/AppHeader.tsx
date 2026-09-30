import kuaiziLogo from '@/assets/logo-kuaizi-group-1024x403.webp';
import { useSession } from '@/state/session/SessionProvider';
import { containerWidthClass } from '@/lib/layout';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
  const { state } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className={`mx-auto flex w-full items-center gap-3 px-4 py-3 ${containerWidthClass(state.step)}`}>
        {/* The wordmark is a fixed deep-blue; give it a light chip in dark mode so it stays legible */}
        <span className="flex-shrink-0 rounded-md px-1.5 py-1 dark:bg-white/95">
          <img src={kuaiziLogo} alt="Kuaizi Group" width={81} height={32} className="h-8 w-auto" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight text-heading sm:text-base">Cotizador</h1>
          <p className="text-xs leading-snug text-content-subtle">Importación China a Colombia</p>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

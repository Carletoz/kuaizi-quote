import { useSession } from '@/state/session/SessionProvider';
import { WIZARD_STAGES, stageIndexForStep } from '@/lib/layout';
import { CheckIcon } from '@/components/ui/icons';

export function Stepper() {
  const { state } = useSession();
  const current = stageIndexForStep(state.step);

  return (
    <nav aria-label="Progreso de la cotización">
      <ol className="flex items-center">
        {WIZARD_STAGES.map((stage, i) => {
          const done = i < current;
          const active = i === current;
          const isLast = i === WIZARD_STAGES.length - 1;

          const circle = done
            ? 'bg-primary text-on-primary'
            : active
              ? 'bg-primary text-on-primary ring-4 ring-primary-soft'
              : 'bg-surface text-content-subtle border border-border';

          const label = active ? 'text-heading' : done ? 'text-content-muted' : 'text-content-subtle';

          return (
            <li
              key={stage.key}
              className={`flex items-center ${isLast ? '' : 'flex-1'}`}
              aria-current={active ? 'step' : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${circle}`}
                >
                  {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {/* Labels collapse on phones, except the current step so it is always named */}
                <span
                  className={`whitespace-nowrap text-xs font-medium transition-colors ${
                    active ? 'inline' : 'hidden sm:inline'
                  } ${label}`}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <span
                  className={`mx-2 h-0.5 flex-1 rounded-full transition-colors ${done ? 'bg-primary' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

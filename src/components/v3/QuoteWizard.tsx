import { useSession } from '@/state/session/SessionProvider';
import { AppHeader } from '@/components/App/AppHeader';
import { Stepper } from '@/components/App/Stepper';
import { containerWidthClass } from '@/lib/layout';
import { SessionNotices } from './SessionNotices';
import { SupplierStep } from './steps/SupplierStep';
import { ProductStep } from './steps/ProductStep';
import { ReviewStep } from './steps/ReviewStep';

export function QuoteWizard() {
  const { state } = useSession();
  const width = containerWidthClass(state.step);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AppHeader />

      {/* The stepper keeps a phone-width measure even when the shell widens for the table */}
      <div className={`mx-auto w-full px-4 pt-5 ${width}`}>
        <div className="max-w-lg">
          <Stepper />
        </div>
      </div>

      <main className={`mx-auto w-full px-4 pb-12 pt-6 ${width}`}>
        <SessionNotices />

        {/* Keyed so the enter animation replays once per step change */}
        <div key={state.step} className="animate-fade-in-up">
          {state.step === 'supplier' && <SupplierStep />}
          {state.step === 'product' && <ProductStep />}
          {state.step === 'review' && <ReviewStep />}
        </div>
      </main>
    </div>
  );
}

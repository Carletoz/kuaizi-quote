import { useState } from 'react';
import { useSession } from '@/state/session/SessionProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { NewQuoteConfirm } from './NewQuoteConfirm';

/** Offered when the app opens in a fresh tab and a saved quote is waiting. */
function ResumeNotice({ savedAt }: { savedAt: string }) {
  const { dismissResumeNotice, startNewQuote } = useSession();
  const [confirmingNew, setConfirmingNew] = useState(false);

  // The saved quote always has content, so starting over always asks first.
  if (confirmingNew) {
    return <NewQuoteConfirm onCancel={() => setConfirmingNew(false)} onConfirm={startNewQuote} />;
  }

  return (
    <Alert kind="info">
      <p>Retomaste tu cotización guardada el {new Date(savedAt).toLocaleString('es-CO')}.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={dismissResumeNotice}>Continuar</Button>
        <Button variant="outline" onClick={() => setConfirmingNew(true)}>
          Empezar nueva
        </Button>
      </div>
    </Alert>
  );
}

/**
 * Status messages about the saved quote, shown above the wizard steps.
 * Kept at the stepper's phone-width measure so they stay readable on the wide review step.
 */
export function SessionNotices() {
  const { storageWarning, resumeSavedAt } = useSession();

  if (!storageWarning && !resumeSavedAt) return null;

  return (
    <div className="mb-6 flex max-w-lg flex-col gap-3">
      {resumeSavedAt && <ResumeNotice savedAt={resumeSavedAt} />}
      {storageWarning && <Alert kind="warning">{storageWarning}</Alert>}
    </div>
  );
}

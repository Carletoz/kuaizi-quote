import { useSession } from '@/state/session/SessionProvider';
import { Alert } from '@/components/ui/Alert';

/**
 * Status messages about the saved quote, shown above the wizard steps.
 * Kept at the stepper's phone-width measure so they stay readable on the wide review step.
 */
export function SessionNotices() {
  const { storageWarning } = useSession();

  if (!storageWarning) return null;

  return (
    <div className="mb-6 flex max-w-lg flex-col gap-3">
      {storageWarning && <Alert kind="warning">{storageWarning}</Alert>}
    </div>
  );
}

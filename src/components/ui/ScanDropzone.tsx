import type { ChangeEvent } from 'react';
import { CameraIcon } from './icons';
import { Spinner } from './Spinner';

interface ScanDropzoneProps {
  /** Idle call to action, e.g. "Escanear proveedor". */
  label: string;
  scanning?: boolean;
  scanningLabel?: string;
  onFile: (file: File) => void;
}

/**
 * Big tap target that opens the camera / gallery picker. The whole surface is a
 * `<label>` around a visually hidden file input, so it is keyboard reachable and
 * announced as a file control without any extra ARIA.
 */
export function ScanDropzone({ label, scanning = false, scanningLabel = 'Analizando...', onFile }: ScanDropzoneProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFile(file);
    // Reset so picking the same photo again still fires a change event.
    e.target.value = '';
  };

  return (
    <label
      aria-busy={scanning}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-surface p-6 text-center transition-colors hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg ${
        scanning ? 'pointer-events-none opacity-70' : ''
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={scanning}
        onChange={handleChange}
      />
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-content-subtle">
        {scanning ? <Spinner size="lg" /> : <CameraIcon className="h-7 w-7" />}
      </span>
      <span className="text-sm font-medium text-content">{scanning ? scanningLabel : label}</span>
    </label>
  );
}

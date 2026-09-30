import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@/components/ui/icons';

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portaled to <body>: the step wrapper keeps a transform after its enter
  // animation, which would otherwise become the containing block of this
  // `fixed` overlay and pin it to the wrapper instead of the viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto del producto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Foto producto"
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-pop"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="focus-ring absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}

/** Product thumbnail that opens a full-size lightbox. */
export function ProductPhoto({ file }: { file: File }) {
  const [url, setUrl] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  // Stable identity: the lightbox re-subscribes its key listener when this changes.
  const close = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Ampliar foto del producto"
        className="focus-ring block cursor-zoom-in rounded-lg"
      >
        <img
          src={url}
          alt="Foto producto"
          className="h-20 w-20 rounded-lg border border-border object-cover"
        />
      </button>
      {expanded && <Lightbox src={url} onClose={close} />}
    </>
  );
}

import { useState, useEffect } from 'react';
import { useSupplierScan } from '@/hooks/useScan';
import { useSession } from '@/state/session/SessionProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ScanDropzone } from '@/components/ui/ScanDropzone';
import { TextField } from '@/components/ui/TextField';
import {
  EMPTY_SUPPLIER_DRAFT,
  SUPPLIER_DRAFT_KEY,
  sanitizeSupplierDraft,
  type SupplierDraft,
} from '@/state/session/drafts';
import { useFormDraft } from '@/state/session/useFormDraft';

export function SupplierStep() {
  const { dispatch, setEntityFile } = useSession();
  const scan = useSupplierScan();
  const [scannedFile, setScannedFile] = useState<File | undefined>();

  // The typed fields survive a closed tab; the scanned photo (a File) and scan status do not.
  const [draft, setDraft, resetDraft] = useFormDraft(SUPPLIER_DRAFT_KEY, EMPTY_SUPPLIER_DRAFT, sanitizeSupplierDraft);
  const { name, tel, location } = draft;
  const setField = (field: keyof SupplierDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const handleFile = (file: File) => {
    setScannedFile(file);
    scan.trigger(file);
  };

  // A scan only fills fields the user has not typed into.
  useEffect(() => {
    if (scan.status === 'success' && scan.result) {
      const r = scan.result;
      setDraft((prev) => ({
        name: prev.name === '' && r.name ? r.name : prev.name,
        tel: prev.tel === '' && r.tel ? r.tel : prev.tel,
        location: prev.location === '' && r.location ? r.location : prev.location,
      }));
    }
  }, [scan.status, scan.result, setDraft]);

  const canConfirm = name.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const supplierId = crypto.randomUUID();
    if (scannedFile) setEntityFile(supplierId, scannedFile);
    dispatch({
      type: 'ADD_SUPPLIER',
      payload: {
        id: supplierId,
        name: name.trim(),
        tel: tel.trim() || undefined,
        location: location.trim() || undefined,
        raw: scan.result?.raw,
        bitrixId: scan.result?.bitrixId,
      },
    });
    dispatch({ type: 'SET_STEP', payload: 'product' });
    resetDraft();
  };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-heading">Escanear proveedor</h2>
        <p className="mt-1 text-sm text-content-subtle">
          Foto la tarjeta del proveedor o ingresalo manualmente.
        </p>
      </div>

      <ScanDropzone
        label="Escanear proveedor"
        scanning={scan.status === 'scanning'}
        onFile={handleFile}
      />

      {scan.status === 'success' && scan.result?.bitrixId && (
        <Alert kind="info">
          <span className="font-semibold">Bitrix24</span> ID #{scan.result.bitrixId} sincronizado
        </Alert>
      )}

      {scan.status === 'error' && (
        <Alert
          kind="danger"
          action={
            <Button variant="outline" onClick={scan.reset}>
              Reintentar
            </Button>
          }
        >
          {scan.error ?? 'Error al escanear'}
        </Alert>
      )}

      {/* Manual entry — always visible */}
      <div className="flex flex-col gap-4">
        <TextField
          label="Nombre del proveedor"
          required
          value={name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Ej: Guangzhou Textiles Co."
          autoComplete="off"
        />
        <TextField
          label="Telefono / WeChat"
          value={tel}
          onChange={(e) => setField('tel', e.target.value)}
          placeholder="Opcional"
          autoComplete="off"
        />
        <TextField
          label="Ubicacion / Stand"
          value={location}
          onChange={(e) => setField('location', e.target.value)}
          placeholder="Opcional"
          autoComplete="off"
        />
      </div>

      <Button fullWidth size="lg" onClick={handleConfirm} disabled={!canConfirm}>
        Confirmar proveedor
      </Button>
    </section>
  );
}

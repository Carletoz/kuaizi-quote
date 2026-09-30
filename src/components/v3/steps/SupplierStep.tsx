import { useState, useEffect } from 'react';
import { useSupplierScan } from '@/hooks/useScan';
import { useSession } from '@/state/session/SessionProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ScanDropzone } from '@/components/ui/ScanDropzone';
import { TextField } from '@/components/ui/TextField';

export function SupplierStep() {
  const { dispatch, setEntityFile } = useSession();
  const scan = useSupplierScan();
  const [scannedFile, setScannedFile] = useState<File | undefined>();

  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [location, setLocation] = useState('');

  const handleFile = (file: File) => {
    setScannedFile(file);
    scan.trigger(file);
  };

  useEffect(() => {
    if (scan.status === 'success' && scan.result) {
      const r = scan.result;
      if (r.name) setName((prev) => prev === '' ? r.name : prev);
      if (r.tel) setTel((prev) => prev === '' ? r.tel! : prev);
      if (r.location) setLocation((prev) => prev === '' ? r.location! : prev);
    }
  }, [scan.status, scan.result]);

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
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Guangzhou Textiles Co."
          autoComplete="off"
        />
        <TextField
          label="Telefono / WeChat"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="Opcional"
          autoComplete="off"
        />
        <TextField
          label="Ubicacion / Stand"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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

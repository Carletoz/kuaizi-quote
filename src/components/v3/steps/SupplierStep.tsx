import { useState, useEffect } from 'react';
import { useSupplierScan } from '@/hooks/useScan';
import { useSession } from '@/state/session/SessionProvider';

export function SupplierStep() {
  const { dispatch, setEntityFile } = useSession();
  const scan = useSupplierScan();
  const [scannedFile, setScannedFile] = useState<File | undefined>();

  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [location, setLocation] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannedFile(file);
    scan.trigger(file);
    e.target.value = '';
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-kuaizi-ink">Escanear proveedor</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Foto la tarjeta del proveedor o ingresalo manualmente.
        </p>
      </div>

      {/* Scan trigger */}
      <label
        className={`w-full rounded-xl border-2 border-dashed border-kuaizi-secondary/40 bg-kuaizi-secondary/5 py-6 text-sm font-semibold text-kuaizi-secondary hover:bg-kuaizi-secondary/10 transition-colors flex items-center justify-center cursor-pointer ${scan.status === 'scanning' ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={scan.status === 'scanning'}
          onChange={handleFile}
        />
        {scan.status === 'scanning' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-kuaizi-secondary border-t-transparent rounded-full" />
            Analizando...
          </span>
        ) : (
          'Escanear proveedor'
        )}
      </label>

      {/* Bitrix sync badge */}
      {scan.status === 'success' && scan.result?.bitrixId && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-center gap-2 text-xs text-blue-700">
          <span className="font-semibold">Bitrix24</span>
          <span>ID #{scan.result.bitrixId} sincronizado</span>
        </div>
      )}

      {/* Error state */}
      {scan.status === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{scan.error ?? 'Error al escanear'}</p>
          <button
            type="button"
            onClick={scan.reset}
            className="text-xs font-semibold text-red-600 underline shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Manual entry — always visible */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-kuaizi-ink">
            Nombre del proveedor <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Guangzhou Textiles Co."
            className="rounded-md border border-gray-300 bg-white text-sm text-kuaizi-ink px-3 py-2 focus:outline-none focus:border-kuaizi-accent focus:ring-1 focus:ring-kuaizi-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-kuaizi-ink">Telefono / WeChat</label>
          <input
            type="text"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            placeholder="Opcional"
            className="rounded-md border border-gray-300 bg-white text-sm text-kuaizi-ink px-3 py-2 focus:outline-none focus:border-kuaizi-accent focus:ring-1 focus:ring-kuaizi-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-kuaizi-ink">Ubicacion / Stand</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Opcional"
            className="rounded-md border border-gray-300 bg-white text-sm text-kuaizi-ink px-3 py-2 focus:outline-none focus:border-kuaizi-accent focus:ring-1 focus:ring-kuaizi-accent"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full rounded-xl bg-kuaizi-secondary text-white py-3 text-sm font-semibold hover:bg-kuaizi-secondary/90 transition-colors disabled:opacity-40"
      >
        Confirmar proveedor
      </button>
    </div>
  );
}

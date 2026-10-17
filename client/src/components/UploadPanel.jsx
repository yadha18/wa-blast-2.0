import { useRef, useState } from 'react';
import { uploadContacts } from '../api';

export default function UploadPanel({ onUploaded, disabled }) {
  const fileRef = useRef(null);
  const [campaignName, setCampaignName] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setBusy(true);
    try {
      const data = await uploadContacts(file, campaignName || file.name, '');
      setResult(data);
      onUploaded(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengunggah file.');
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`border border-line p-5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <h2 className="mono text-xs tracking-wide text-ink/60 uppercase">02 — Unggah Daftar Nomor</h2>

      <input
        type="text"
        placeholder="Nama campaign (opsional)"
        value={campaignName}
        onChange={(e) => setCampaignName(e.target.value)}
        className="mt-4 w-full border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-signal"
      />

      <label className="mt-3 flex items-center justify-between border border-dashed border-line px-4 py-6 cursor-pointer hover:border-signal transition-colors">
        <div>
          <p className="text-sm">{fileName || 'Pilih file .xlsx atau .csv'}</p>
          <p className="text-xs text-ink/50 mt-1">Kolom wajib: No.HP. Kolom opsional: Nama. Maks. 20.000 baris.</p>
        </div>
        <span className="mono text-xs border border-ink px-3 py-1.5">Pilih File</span>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </label>

      {busy && <p className="mt-3 text-sm text-ink/60 mono">Memvalidasi nomor…</p>}
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}

      {result && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Total" value={result.total} />
          <Stat label="Valid" value={result.valid} tone="text-signal" />
          <Stat label="Tidak Valid" value={result.invalid} tone="text-warn" />
        </div>
      )}

      {result?.preview?.length > 0 && (
        <div className="mt-4 max-h-48 overflow-y-auto border border-line">
          <table className="w-full text-xs mono">
            <thead className="sticky top-0 bg-paper border-b border-line">
              <tr className="text-left text-ink/50">
                <th className="px-2 py-1.5">Nomor Asli</th>
                <th className="px-2 py-1.5">Normalisasi</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.preview.map((row, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="px-2 py-1">{row.raw_number}</td>
                  <td className="px-2 py-1">{row.normalized_number || '—'}</td>
                  <td className={`px-2 py-1 ${row.is_valid ? 'text-signal' : 'text-warn'}`}>
                    {row.is_valid ? 'valid' : row.invalid_reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink' }) {
  return (
    <div className="border border-line px-3 py-2">
      <p className="text-[11px] text-ink/50 uppercase mono">{label}</p>
      <p className={`text-xl mono ${tone}`}>{value}</p>
    </div>
  );
}

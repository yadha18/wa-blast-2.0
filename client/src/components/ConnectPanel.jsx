export default function ConnectPanel({ waStatus, qr, onLogout }) {
  const state = waStatus?.status || 'disconnected';

  const dot = {
    connected: 'bg-signal',
    qr: 'bg-warn animate-pulse',
    connecting: 'bg-warn animate-pulse',
    disconnected: 'bg-ink/30',
  }[state];

  const label = {
    connected: 'Terhubung',
    qr: 'Menunggu scan QR',
    connecting: 'Menghubungkan…',
    disconnected: 'Belum terhubung',
  }[state];

  return (
    <div className="border border-line p-5">
      <div className="flex items-center justify-between">
        <h2 className="mono text-xs tracking-wide text-ink/60 uppercase">01 — Koneksi WhatsApp</h2>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="mono text-xs">{label}</span>
        </div>
      </div>

      {state === 'qr' && qr && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <img src={qr} alt="QR Code WhatsApp" className="w-48 h-48 border border-line" />
          <p className="text-sm text-ink/70 text-center max-w-xs">
            Buka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat, lalu scan kode ini.
          </p>
        </div>
      )}

      {state === 'connected' && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-ink/70">
            Nomor <span className="mono">{waStatus.phone?.split(':')[0] || ''}</span> siap mengirim pesan.
          </p>
          <button onClick={onLogout} className="text-xs mono border border-line px-3 py-1.5 hover:border-warn hover:text-warn transition-colors">
            Putuskan
          </button>
        </div>
      )}

      {state === 'disconnected' && (
        <div className="mt-4">
          <p className="text-sm text-ink/60">Menunggu koneksi ke server WhatsApp…</p>
          {waStatus?.error && (
            <p className="mt-1 text-xs text-warn mono">Detail: {waStatus.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

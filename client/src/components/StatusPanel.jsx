export default function StatusPanel({ campaign, log }) {
  if (!campaign) {
    return (
      <div className="border border-line p-5 h-full flex items-center justify-center text-sm text-ink/40">
        Log pengiriman akan muncul di sini.
      </div>
    );
  }

  const { total, sent, failed, status } = campaign;
  const processed = sent + failed;
  const pct = total ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="border border-line p-5">
      <div className="flex items-center justify-between">
        <h2 className="mono text-xs tracking-wide text-ink/60 uppercase">04 — Status Pengiriman</h2>
        <span className="mono text-xs uppercase">{status}</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Terkirim" value={sent} tone="text-signal" />
        <Stat label="Gagal" value={failed} tone="text-warn" />
        <Stat label="Progres" value={`${pct}%`} />
      </div>

      <div className="mt-3 h-1.5 bg-line w-full">
        <div className="h-full bg-signal transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto border border-line">
        <table className="w-full text-xs mono">
          <thead className="sticky top-0 bg-paper border-b border-line">
            <tr className="text-left text-ink/50">
              <th className="px-2 py-1.5">Nomor</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-ink/40 text-center">
                  Belum ada aktivitas.
                </td>
              </tr>
            )}
            {log.map((entry, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="px-2 py-1">{entry.number}</td>
                <td className={`px-2 py-1 ${entry.status === 'sent' ? 'text-signal' : 'text-warn'}`}>
                  {entry.status === 'sent' ? 'terkirim' : 'gagal'}
                </td>
                <td className="px-2 py-1 text-ink/60">{entry.error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

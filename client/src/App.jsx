import { useEffect, useState } from 'react';
import { socket, fetchWaStatus, logoutWa, startCampaign, pauseCampaign, resumeCampaign, stopCampaign, fetchCampaign } from './api';
import ConnectPanel from './components/ConnectPanel';
import UploadPanel from './components/UploadPanel';
import ComposePanel from './components/ComposePanel';
import StatusPanel from './components/StatusPanel';

export default function App() {
  const [waStatus, setWaStatus] = useState({ status: 'disconnected' });
  const [qr, setQr] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    fetchWaStatus().then((s) => {
      setWaStatus(s);
      setQr(s.qr || null);
    }).catch((err) => {
      console.error('[App] Gagal mengambil status WhatsApp:', err);
      setGlobalError('Tidak bisa menghubungi server backend. Cek apakah backend hidup dan VITE_BACKEND_URL/CORS sudah benar.');
    });

    socket.on('wa:status', (s) => {
      setWaStatus(s);
      setQr(s.qr || null);
    });

    socket.on('campaign:progress', (payload) => {
      setCampaign((prev) => (prev ? { ...prev, sent: payload.sent, failed: payload.failed, total: payload.total } : prev));
      setLog((prev) => [{ number: payload.number, status: payload.status, error: payload.error }, ...prev].slice(0, 200));
    });

    socket.on('campaign:done', ({ status }) => {
      setRunning(false);
      setCampaign((prev) => (prev ? { ...prev, status } : prev));
    });

    socket.on('connect_error', (err) => {
      console.error('[App] Socket.io gagal konek:', err.message);
      setGlobalError('Koneksi real-time (Socket.io) ke backend gagal. Cek CORS/CLIENT_ORIGIN di backend dan VITE_BACKEND_URL di frontend.');
    });

    return () => {
      socket.off('wa:status');
      socket.off('campaign:progress');
      socket.off('campaign:done');
      socket.off('connect_error');
    };
  }, []);

  // Wraps every button action so a failed request always surfaces something
  // visible instead of the button just silently doing nothing.
  async function runAction(fn) {
    setGlobalError(null);
    try {
      await fn();
    } catch (err) {
      console.error('[App] Aksi gagal:', err);
      const message =
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK' ? 'Tidak bisa menghubungi backend (cek CORS/URL backend).' : err.message) ||
        'Terjadi kesalahan tidak diketahui.';
      setGlobalError(message);
    }
  }

  function handleUploaded(data) {
    setUploadResult(data);
    setCampaign({ id: data.campaignId, total: data.total, sent: 0, failed: 0, status: 'draft' });
    setLog([]);
  }

  async function handleSend(message, delayMs) {
    if (!uploadResult) return;
    await startCampaign(uploadResult.campaignId, message, delayMs);
    setRunning(true);
    setCampaign((prev) => ({ ...prev, status: 'running' }));
  }

  async function handlePause() {
    await pauseCampaign(uploadResult.campaignId);
    setCampaign((prev) => ({ ...prev, status: 'paused' }));
  }

  async function handleResume() {
    await resumeCampaign(uploadResult.campaignId);
    setCampaign((prev) => ({ ...prev, status: 'running' }));
  }

  async function handleStop() {
    await stopCampaign(uploadResult.campaignId);
  }

  const waConnected = waStatus.status === 'connected';

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dispatch</h1>
          <p className="text-xs text-ink/50 mono">WhatsApp Bulk Blast — kirim pesan ke banyak nomor sekaligus</p>
        </div>
        <div className="mono text-xs text-ink/40">maks. 20.000 nomor / pengiriman</div>
      </header>

      {globalError && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="border border-warn text-warn text-sm px-4 py-3 flex items-start justify-between gap-3">
            <span>{globalError}</span>
            <button onClick={() => setGlobalError(null)} className="mono text-xs shrink-0 hover:underline">
              Tutup
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 grid gap-5">
        <ConnectPanel waStatus={waStatus} qr={qr} onLogout={() => runAction(logoutWa)} />
        <UploadPanel onUploaded={handleUploaded} disabled={!waConnected} />
        <ComposePanel
          disabled={!waConnected || !uploadResult}
          campaign={campaign}
          running={running || campaign?.status === 'running' || campaign?.status === 'paused'}
          onSend={(message, delayMs) => runAction(() => handleSend(message, delayMs))}
          onPause={() => runAction(handlePause)}
          onResume={() => runAction(handleResume)}
          onStop={() => runAction(handleStop)}
        />
        <StatusPanel campaign={campaign} log={log} />
      </main>
    </div>
  );
}

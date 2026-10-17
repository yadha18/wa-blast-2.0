import { useState } from 'react';
import { uploadBanner, removeBanner, assetUrl } from '../api';

export default function ComposePanel({ disabled, campaign, onSend, onPause, onResume, onStop, running }) {
  const [message, setMessage] = useState('Halo {{nama}}, ');
  const [delaySec, setDelaySec] = useState(4);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState('');

  async function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file || !campaign?.id) return;
    setBannerError('');
    setBannerBusy(true);
    try {
      const { bannerUrl } = await uploadBanner(campaign.id, file);
      setBannerPreview(assetUrl(bannerUrl));
    } catch (err) {
      setBannerError(err.response?.data?.error || 'Gagal mengunggah banner.');
    } finally {
      setBannerBusy(false);
    }
  }

  async function handleRemoveBanner() {
    if (!campaign?.id) return;
    await removeBanner(campaign.id);
    setBannerPreview(null);
  }

  return (
    <div className={`border border-line p-5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <h2 className="mono text-xs tracking-wide text-ink/60 uppercase">03 — Susun & Kirim</h2>

      <div className="mt-4">
        <label className="text-xs mono text-ink/60 uppercase">Banner (opsional)</label>
        {!bannerPreview ? (
          <label className="mt-2 flex items-center justify-between border border-dashed border-line px-4 py-4 cursor-pointer hover:border-signal transition-colors">
            <div>
              <p className="text-sm">Tambahkan gambar sebagai banner pesan</p>
              <p className="text-xs text-ink/50 mt-1">JPG/PNG/WEBP, maks. 5MB. Terkirim sebagai gambar + caption.</p>
            </div>
            <span className="mono text-xs border border-ink px-3 py-1.5">Pilih Gambar</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerChange} />
          </label>
        ) : (
          <div className="mt-2 flex items-start gap-3 border border-line p-3">
            <img src={bannerPreview} alt="Banner preview" className="w-24 h-24 object-cover border border-line" />
            <div className="flex-1">
              <p className="text-sm text-ink/70">Banner terpasang — akan dikirim sebagai gambar dengan pesan di bawah sebagai caption.</p>
              <button onClick={handleRemoveBanner} className="mt-2 text-xs mono border border-line px-3 py-1 hover:border-warn hover:text-warn transition-colors">
                Hapus Banner
              </button>
            </div>
          </div>
        )}
        {bannerBusy && <p className="mt-1 text-xs text-ink/50 mono">Mengunggah…</p>}
        {bannerError && <p className="mt-1 text-xs text-warn mono">{bannerError}</p>}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        placeholder="Tulis pesan Anda. Gunakan {{nama}} untuk personalisasi."
        className="mt-4 w-full border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-signal resize-none"
      />
      {bannerPreview && (
        <p className="mt-1 text-xs text-ink/40">Teks di atas akan menjadi caption di bawah gambar (maks. ~1024 karakter oleh WhatsApp).</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs mono text-ink/60">Jeda antar pesan (detik)</label>
        <input
          type="number"
          min={1}
          value={delaySec}
          onChange={(e) => setDelaySec(e.target.value)}
          className="w-16 border border-line bg-transparent px-2 py-1 text-sm mono focus:outline-none focus:border-signal"
        />
        <span className="text-xs text-ink/40">Jeda lebih besar = lebih aman dari pemblokiran akun.</span>
      </div>

      <div className="mt-4 flex gap-2">
        {!running && (
          <button
            onClick={() => onSend(message, Number(delaySec) * 1000)}
            className="mono text-sm bg-ink text-paper px-4 py-2 hover:bg-signalDark transition-colors"
          >
            Mulai Kirim
          </button>
        )}
        {running && campaign?.status === 'running' && (
          <button onClick={onPause} className="mono text-sm border border-ink px-4 py-2 hover:border-warn hover:text-warn transition-colors">
            Jeda
          </button>
        )}
        {running && campaign?.status === 'paused' && (
          <button onClick={onResume} className="mono text-sm border border-signal text-signal px-4 py-2 hover:bg-signal hover:text-paper transition-colors">
            Lanjutkan
          </button>
        )}
        {running && (
          <button onClick={onStop} className="mono text-sm border border-warn text-warn px-4 py-2 hover:bg-warn hover:text-paper transition-colors">
            Hentikan
          </button>
        )}
      </div>
    </div>
  );
}

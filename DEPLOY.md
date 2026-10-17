# Deploy ke Railway (1 service)

Backend dan frontend jalan di **satu service**, satu domain. Tidak perlu CORS, `CLIENT_ORIGIN`, atau `VITE_BACKEND_URL`.

1. Push folder ini ke GitHub (root repo = folder yang berisi `Dockerfile`).
2. Railway → **New Project → Deploy from GitHub repo**. **Root Directory dikosongkan.** Railway otomatis memakai `Dockerfile` dan `railway.json`.
3. Service → **Settings → Volumes → New Volume**, mount path: `/data`.
4. Tab **Variables**: tambahkan `DATA_DIR=/data`. (Sudah default di Dockerfile, tapi set eksplisit agar jelas.)
5. **Settings → Networking → Generate Domain**, lalu buka URL-nya dan scan QR.

## Cek di Deploy Logs
```
[Config] DATA_DIR OK — dapat ditulis: /data
[Config] Menyajikan frontend dari /app/client/dist
WA Bulk Blast server running ...
```
Kalau muncul `DATA_DIR TIDAK BISA DITULIS`, volume belum ter-mount di `/data`.

## Catatan
- Pakai **satu replica saja**: sesi WhatsApp tidak boleh dijalankan dari dua instance sekaligus.
- Service harus selalu hidup (plan berbayar), karena koneksi WhatsApp harus terus terbuka.
- Hapus variabel lama kalau ada: `RAILPACK_BUILD_APT_PACKAGES`, `RAILWAY_BUILD_APT_PACKAGES`, `VITE_BACKEND_URL`.
- Setelah Putuskan/logout, QR baru muncul otomatis; tidak perlu hapus sesi manual.

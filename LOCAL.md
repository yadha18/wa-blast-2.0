# Jalankan Lokal (tanpa Railway)

Syarat: **Node.js 22.13 atau lebih baru** (`node -v`).

```bash
npm install          # install concurrently (root)
npm run setup        # install dependency server + client
npm run dev          # jalankan backend (:4000) + frontend (:5173)
```

Buka http://localhost:5173 lalu scan QR.

- Tidak perlu file `.env`. Data (sesi WA, database, banner) tersimpan di folder `server/`.
- Reset login WhatsApp: hapus folder `server/sessions/`, restart.
- Jangan set `VITE_BACKEND_URL` untuk lokal; Vite proxy sudah meneruskan `/api` dan `/socket.io` ke backend.

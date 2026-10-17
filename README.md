# Dispatch — WA Bulk Blast

Aplikasi web untuk mengirim pesan WhatsApp secara massal dari daftar nomor di Excel.

**Alur kerja:**
1. Scan QR untuk menghubungkan akun WhatsApp (via Baileys, tanpa API resmi).
2. Unggah file Excel/CSV berisi nomor HP (kolom `No.HP`, opsional `Nama`).
3. Sistem memvalidasi & menormalisasi setiap nomor (format Indonesia `62xxxxxxxxxx`).
4. Susun pesan (mendukung `{{nama}}` untuk personalisasi) dan kirim.
5. Status terkirim/gagal per nomor tampil real-time di layar.
6. Maksimum **20.000 baris per file** — dibatasi di level validasi upload agar sistem tidak keberatan.

## Struktur Proyek

```
wa-blast/
├── server/     # Express + Baileys + SQLite (backend)
└── client/     # React + Vite + Tailwind (frontend)
```

## Menjalankan Secara Lokal

### 1. Backend

```bash
cd server
npm install
npm start
```

Server berjalan di `http://localhost:4000`. Saat pertama kali dijalankan, sesi WhatsApp belum ada — QR code akan otomatis dikirim ke frontend via Socket.io begitu server siap.

Session login WhatsApp disimpan di folder `server/sessions/` (jangan commit ke git — sudah di-ignore).

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

Buka `http://localhost:5173`, scan QR yang muncul dengan WhatsApp di HP (Perangkat Tertaut → Tautkan Perangkat).

## Format File Excel

| No.HP        | Nama       |
|--------------|------------|
| 081234567890 | Budi       |
| +62812xxxxxx | Siti       |
| 6281299xxxxx | (kosong)   |

- Kolom nomor bisa bernama: `No.HP`, `Nomor`, `Phone`, `WhatsApp`, `HP`, `Telepon`.
- Format `08xx`, `+62xx`, atau `62xx` semuanya otomatis dinormalisasi.
- Kolom `Nama` opsional, dipakai untuk personalisasi `{{nama}}` di pesan.

## ⚠️ Catatan Penting

- **Baileys adalah library tidak resmi** yang meniru WhatsApp Web. Ini melanggar Ketentuan Layanan WhatsApp dan akun berisiko **diblokir/dibanned**, terutama untuk volume besar dan pesan yang terdeteksi sebagai spam. Untuk penggunaan bisnis jangka panjang dan skala besar, pertimbangkan migrasi ke **WhatsApp Business Platform (Cloud API)** resmi dari Meta.
- Untuk memperkecil risiko pemblokiran saat memakai Baileys:
  - Gunakan jeda antar pesan yang wajar (default 4 detik + jitter acak, sudah diterapkan di sistem).
  - Hindari mengirim ke nomor yang belum pernah berinteraksi dalam jumlah besar sekaligus.
  - Jangan kirim konten identik ke ribuan nomor tanpa variasi/personalisasi.
  - Pertimbangkan mengirim secara bertahap (batch), bukan sekaligus 20.000 di menit yang sama — meskipun sistem ini mengizinkan hingga 20.000 baris per file, Anda tetap bisa menjeda/melanjutkan proses kapan saja dari tombol "Jeda"/"Lanjutkan".
- Nomor diverifikasi terdaftar di WhatsApp (`onWhatsApp` check) sebelum pengiriman — nomor yang tidak terdaftar otomatis ditandai gagal, bukan dikirim membabi buta.
- Ini dirancang untuk **single-instance server** (status proses pengiriman disimpan di memori). Untuk skala/production yang lebih besar (multi-server, antrian job, retry otomatis), pertimbangkan menambahkan message queue (BullMQ/Redis).

## Tech Stack

- **Backend:** Node.js (≥22.13), Express, Socket.io, Baileys, SQLite (`node:sqlite` bawaan Node — tanpa native module), Multer, xlsx
- **Frontend:** React, Vite, Tailwind CSS, socket.io-client, axios

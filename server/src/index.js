import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

import './db/index.js';
import { initWhatsApp, getWhatsApp } from './whatsapp.js';
import uploadRouter from './routes/upload.js';
import campaignRouter from './routes/campaign.js';
import waRouter from './routes/wa.js';
import { DATA_DIR } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
// Comma-separated list so both a local dev origin and a deployed frontend
// origin can be allowed at once, e.g. "http://localhost:5173,https://app.vercel.app"
// Trailing slashes are stripped — "https://x.app/" vs "https://x.app" is the
// single most common cause of CORS silently blocking every request, since
// the browser's Origin header never has a trailing slash but it's an easy
// typo to make when pasting a URL from the browser bar into Railway.
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

console.log('[Config] ALLOWED_ORIGINS (CORS):', ALLOWED_ORIGINS);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
});

app.set('io', io);

// Logs every incoming request with its Origin header. Without this there is
// no way to tell, from the server side, whether a request from the frontend
// ever actually arrived — a request blocked by CORS still reaches Express
// (the browser just refuses to hand the response back to JS afterwards), so
// this line firing or not firing is the fastest way to tell "request never
// arrived" apart from "request arrived but the response got blocked".
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl} — Origin: ${req.headers.origin || '(tidak ada)'}`);
  next();
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

app.use('/api/upload', uploadRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/wa', waRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Production: serve the built React app from this same server, so frontend
// and API share one origin (no CORS, no VITE_BACKEND_URL needed).
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  console.log('[Config] Menyajikan frontend dari', CLIENT_DIST);
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Anything that reaches here matched no route above.
app.use((req, res) => {
  console.warn(`[HTTP] 404 tidak ada route untuk ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route tidak ditemukan' });
});

// Catches errors thrown/passed to next() anywhere above (including from
// multer, e.g. file-too-large) so the client always gets a JSON error
// response instead of a request that hangs with no reply at all.
app.use((err, req, res, next) => {
  console.error(`[HTTP] Error tak tertangani pada ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan di server' });
});

io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected:', socket.id, '— Origin:', socket.handshake.headers.origin);
  // The QR is emitted only once when WhatsApp generates it. A browser that
  // connects (or reconnects) afterwards would never receive it, so push the
  // current status + QR to every new socket immediately.
  const wa = getWhatsApp();
  if (wa) socket.emit('wa:status', wa.getStatus());
});

initWhatsApp(io);

httpServer.listen(PORT, () => {
  console.log(`WA Bulk Blast server running on http://localhost:${PORT}`);
});

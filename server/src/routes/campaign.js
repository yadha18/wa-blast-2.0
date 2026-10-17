import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';
import { getWhatsApp } from '../whatsapp.js';
import { toWhatsAppJid } from '../utils/phoneValidator.js';
import { DATA_DIR } from '../config.js';

const BANNER_DIR = path.join(DATA_DIR, 'uploads', 'banners');
fs.mkdirSync(BANNER_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: BANNER_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — keep banners light for fast bulk delivery
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Format gambar harus JPG, PNG, atau WEBP'));
    }
    cb(null, true);
  },
});

const router = Router();

// In-memory run-control per campaign (paused/stopped flags).
// Fine for a single-instance server as specified in the brief.
const runControl = new Map();

function fillTemplate(template, contact) {
  return template.replaceAll('{{nama}}', contact.name || '').replaceAll('{{name}}', contact.name || '');
}

router.get('/', (req, res) => {
  const campaigns = db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 100`).all();
  res.json(campaigns);
});

router.get('/:id', (req, res) => {
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign tidak ditemukan' });
  res.json(campaign);
});

router.get('/:id/contacts', (req, res) => {
  const { status } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize) || 100, 500);
  const offset = (page - 1) * pageSize;

  let query = `SELECT * FROM contacts WHERE campaign_id = ?`;
  const params = [req.params.id];
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  query += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const contacts = db.prepare(query).all(...params);
  res.json({ page, pageSize, contacts });
});

router.post('/:id/banner', (req, res) => {
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign tidak ditemukan' });

  bannerUpload.single('banner')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah gambar' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File gambar tidak ditemukan' });
    }

    // Remove any previous banner file for this campaign to avoid orphaned files
    if (campaign.banner_path) {
      const oldPath = path.join(BANNER_DIR, path.basename(campaign.banner_path));
      fs.unlink(oldPath, () => {});
    }

    const relativePath = path.join('banners', req.file.filename);
    db.prepare(`UPDATE campaigns SET banner_path = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(relativePath, req.params.id);

    res.json({ bannerUrl: `/uploads/${relativePath.replace(/\\/g, '/')}` });
  });
});

router.delete('/:id/banner', (req, res) => {
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign tidak ditemukan' });

  if (campaign.banner_path) {
    const oldPath = path.join(BANNER_DIR, path.basename(campaign.banner_path));
    fs.unlink(oldPath, () => {});
  }
  db.prepare(`UPDATE campaigns SET banner_path = NULL, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ removed: true });
});

router.post('/:id/send', async (req, res) => {
  const campaignId = req.params.id;
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign tidak ditemukan' });

  const wa = getWhatsApp();
  if (!wa || wa.getStatus().status !== 'connected') {
    return res.status(409).json({ error: 'WhatsApp belum terhubung. Silakan scan QR terlebih dahulu.' });
  }

  if (campaign.status === 'running') {
    return res.status(409).json({ error: 'Campaign sudah berjalan.' });
  }

  const delayMs = Math.max(parseInt(req.body?.delayMs) || 3000, 1000);
  const message = req.body?.message || campaign.message;

  db.prepare(`UPDATE campaigns SET status = 'running', message = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(message, campaignId);

  runControl.set(campaignId, { paused: false, stopped: false });

  res.json({ started: true, delayMs });

  // Fire and forget async worker - progress pushed via socket.io
  runCampaign(campaignId, message, delayMs, req.app.get('io')).catch((err) => {
    console.error('Campaign worker error:', err);
    db.prepare(`UPDATE campaigns SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(campaignId);
  });
});

router.post('/:id/pause', (req, res) => {
  const ctrl = runControl.get(req.params.id);
  if (!ctrl) return res.status(409).json({ error: 'Campaign tidak sedang berjalan' });
  ctrl.paused = true;
  db.prepare(`UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ paused: true });
});

router.post('/:id/resume', (req, res) => {
  const ctrl = runControl.get(req.params.id);
  if (!ctrl) return res.status(409).json({ error: 'Campaign tidak memiliki proses aktif untuk dilanjutkan' });
  ctrl.paused = false;
  db.prepare(`UPDATE campaigns SET status = 'running', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ resumed: true });
});

router.post('/:id/stop', (req, res) => {
  const ctrl = runControl.get(req.params.id);
  if (ctrl) ctrl.stopped = true;
  res.json({ stopping: true });
});

async function runCampaign(campaignId, message, delayMs, io) {
  const wa = getWhatsApp();
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(campaignId);
  const contacts = db
    .prepare(`SELECT * FROM contacts WHERE campaign_id = ? AND is_valid = 1 AND status = 'pending' ORDER BY id ASC`)
    .all(campaignId);

  const updateContact = db.prepare(
    `UPDATE contacts SET status = ?, error_message = ?, sent_at = datetime('now') WHERE id = ?`
  );
  const bumpCounter = db.prepare(
    `UPDATE campaigns SET sent = sent + ?, failed = failed + ?, updated_at = datetime('now') WHERE id = ?`
  );

  let bannerBuffer = null;
  if (campaign.banner_path) {
    const fullPath = path.join(BANNER_DIR, '..', campaign.banner_path);
    try {
      bannerBuffer = fs.readFileSync(fullPath);
    } catch (err) {
      console.error('[Campaign] Gagal membaca file banner, akan dikirim sebagai teks saja:', err.message);
    }
  }

  for (const contact of contacts) {
    const ctrl = runControl.get(campaignId);
    if (!ctrl || ctrl.stopped) break;

    while (ctrl.paused) {
      await sleep(1000);
      if (ctrl.stopped) break;
    }
    if (ctrl.stopped) break;

    const jid = toWhatsAppJid(contact.normalized_number);
    const personalizedMessage = fillTemplate(message, contact);
    const result = bannerBuffer
      ? await wa.sendImage(jid, bannerBuffer, personalizedMessage)
      : await wa.sendText(jid, personalizedMessage);

    if (result.success) {
      updateContact.run('sent', null, contact.id);
      bumpCounter.run(1, 0, campaignId);
    } else {
      updateContact.run('failed', result.error, contact.id);
      bumpCounter.run(0, 1, campaignId);
    }

    const updated = db.prepare(`SELECT sent, failed, total FROM campaigns WHERE id = ?`).get(campaignId);
    io.emit('campaign:progress', {
      campaignId,
      contactId: contact.id,
      number: contact.normalized_number,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      ...updated,
    });

    await sleep(delayMs + Math.floor(Math.random() * 500)); // small jitter to look less bot-like
  }

  const ctrl = runControl.get(campaignId);
  const finalStatus = ctrl?.stopped ? 'paused' : 'done';
  db.prepare(`UPDATE campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(finalStatus, campaignId);
  io.emit('campaign:done', { campaignId, status: finalStatus });
  runControl.delete(campaignId);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default router;

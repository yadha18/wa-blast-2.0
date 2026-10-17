import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { parseExcelBuffer, MAX_ROWS } from '../utils/excelParser.js';
import { normalizePhone } from '../utils/phoneValidator.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan. Unggah file .xlsx atau .csv.' });
  }

  const campaignName = (req.body.name || `Campaign ${new Date().toISOString()}`).slice(0, 200);
  const message = req.body.message || '';

  let rows;
  try {
    rows = parseExcelBuffer(req.file.buffer);
  } catch (err) {
    const statusCode = err.code === 'ROW_LIMIT_EXCEEDED' ? 413 : 400;
    return res.status(statusCode).json({ error: err.message });
  }

  const campaignId = uuidv4();
  const insertCampaign = db.prepare(
    `INSERT INTO campaigns (id, name, message, status, total) VALUES (?, ?, ?, 'draft', ?)`
  );
  const insertContact = db.prepare(
    `INSERT INTO contacts (campaign_id, raw_number, normalized_number, name, is_valid, invalid_reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = (rows) => {
    let validCount = 0;
    let invalidCount = 0;
    // node:sqlite has no db.transaction() helper (unlike better-sqlite3) —
    // wrap the batch insert in an explicit transaction manually so a
    // mid-batch failure doesn't leave a partially-inserted campaign behind.
    db.exec('BEGIN');
    try {
      insertCampaign.run(campaignId, campaignName, message, rows.length);
      for (const row of rows) {
        const { valid, reason, normalized } = normalizePhone(row.rawPhone);
        if (valid) validCount++; else invalidCount++;
        insertContact.run(
          campaignId,
          String(row.rawPhone ?? ''),
          normalized,
          String(row.name ?? ''),
          valid ? 1 : 0,
          reason,
          valid ? 'pending' : 'invalid'
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { validCount, invalidCount };
  };

  const { validCount, invalidCount } = insertMany(rows);

  const preview = db
    .prepare(`SELECT raw_number, normalized_number, name, is_valid, invalid_reason FROM contacts WHERE campaign_id = ? LIMIT 50`)
    .all(campaignId);

  res.json({
    campaignId,
    total: rows.length,
    valid: validCount,
    invalid: invalidCount,
    maxRows: MAX_ROWS,
    preview,
  });
});

export default router;

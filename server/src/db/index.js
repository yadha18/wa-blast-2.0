import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, 'data.sqlite');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  banner_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | running | paused | done | failed
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  raw_number TEXT,
  normalized_number TEXT,
  name TEXT,
  is_valid INTEGER NOT NULL DEFAULT 0,
  invalid_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | invalid | skipped
  error_message TEXT,
  sent_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(campaign_id, status);
`);

// Lightweight migration for databases created before banner_path existed.
const existingColumns = db.prepare(`PRAGMA table_info(campaigns)`).all().map((c) => c.name);
if (!existingColumns.includes('banner_path')) {
  db.exec(`ALTER TABLE campaigns ADD COLUMN banner_path TEXT`);
}

export default db;

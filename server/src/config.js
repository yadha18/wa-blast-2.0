import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * All persistent state (WhatsApp session, SQLite DB, uploaded banners) lives
 * under DATA_DIR. Locally this defaults to the project root so nothing extra
 * is needed. On Railway, attach a Volume and set DATA_DIR to its mount path
 * (e.g. /data) so this survives restarts/redeploys — Railway's regular
 * filesystem is wiped on every deploy.
 */
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');

/**
 * Fails loudly and immediately at startup if DATA_DIR isn't actually
 * writable, instead of letting individual upload requests fail later with a
 * vague, easy-to-miss error. This is the single most common deploy issue:
 * DATA_DIR pointing at a path with no Volume attached, or a Volume mounted
 * with permissions the container's user can't write to.
 */
export function assertDataDirWritable() {
  const probePath = path.join(DATA_DIR, '.write-test');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(probePath, 'ok');
    fs.unlinkSync(probePath);
    console.log(`[Config] DATA_DIR OK — dapat ditulis: ${DATA_DIR}`);
  } catch (err) {
    console.error(`[Config] ❌ DATA_DIR TIDAK BISA DITULIS: ${DATA_DIR}`);
    console.error(`[Config] Error asli: ${err.code || ''} ${err.message}`);
    console.error(
      '[Config] Kemungkinan penyebab: (1) Volume belum di-attach di Railway, ' +
      '(2) DATA_DIR di env var tidak sama persis dengan mount path Volume-nya, ' +
      '(3) izin tulis Volume tidak cocok dengan user container. ' +
      'Upload Excel/banner dan penyimpanan sesi WhatsApp TIDAK akan berfungsi sampai ini diperbaiki.'
    );
    throw err;
  }
}

// Runs the moment this module is first imported (i.e. before db/index.js
// gets to open the SQLite file) — ESM import statements always execute
// fully before the importing file's own top-level code, so this can't be
// deferred to index.js without risking a cryptic native SQLite error firing
// first instead of this clear diagnostic.
assertDataDirWritable();

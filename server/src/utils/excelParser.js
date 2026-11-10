import XLSX from 'xlsx';
import { normalizePhone } from './phoneValidator.js';

const MAX_ROWS = 20000;
const HEADER_SCAN_ROWS = 10;

// Header keywords, matched against the header with spaces/punctuation removed
// ("No. HP" -> "nohp", "Nomor WhatsApp" -> "nomorwhatsapp").
const PHONE_KEYWORDS = ['nohp', 'nomorhp', 'nomor', 'phone', 'handphone', 'hp', 'telepon', 'telp', 'tlp', 'whatsapp', 'wa', 'mobile', 'msisdn', 'kontak', 'contact'];
const NAME_KEYWORDS = ['nama', 'name'];

const squash = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** "Nama Pelanggan" -> "nama_pelanggan" (the name usable as {{nama_pelanggan}}). */
export function toVariableKey(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cellToText(v) {
  if (v === null || v === undefined) return '';
  // Whole numbers print in full (no 6.28E+11) for values below 1e21.
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

function headerScore(cell, keywords) {
  const h = squash(cell);
  if (!h) return 0;
  if (keywords.includes(h)) return 3; // exact
  if (keywords.some((k) => k.length >= 3 && h.includes(k))) return 2; // contains, e.g. "nomorteleponaktif"
  return 0;
}

function findColumn(headers, keywords, exclude = new Set()) {
  let best = -1;
  let bestScore = 0;
  headers.forEach((h, i) => {
    if (exclude.has(i)) return;
    const score = headerScore(h, keywords);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

/**
 * Parses an uploaded Excel/CSV buffer into rows of { rawPhone, name, vars }.
 * - Header row is auto-detected within the first rows (title rows above it are fine).
 * - Phone/name columns are matched fuzzily ("No. HP", "Nomor Telepon", "Nama Pelanggan"...).
 * - If no phone header is found, the column that mostly holds phone-like values is used.
 * - Every column becomes a template variable, e.g. {{kota}}.
 */
export function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel tidak memiliki sheet.');

  const grid = XLSX.utils
    .sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true, blankrows: false })
    .map((r) => r.map(cellToText));

  if (grid.length === 0) throw new Error('File Excel kosong atau tidak terbaca.');

  // 1. Find the header row: first row (within the top N) containing a phone header.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(HEADER_SCAN_ROWS, grid.length); i++) {
    if (findColumn(grid[i], PHONE_KEYWORDS) >= 0) { headerIdx = i; break; }
  }

  let headers;
  let dataRows;
  let phoneCol;

  if (headerIdx >= 0) {
    headers = grid[headerIdx];
    dataRows = grid.slice(headerIdx + 1);
    phoneCol = findColumn(headers, PHONE_KEYWORDS);
  } else {
    // 2. No recognizable header: choose the column with the most valid phone numbers.
    const width = Math.max(...grid.map((r) => r.length));
    const sample = grid.slice(0, 200);
    let bestCol = -1;
    let bestCount = 0;
    for (let c = 0; c < width; c++) {
      const count = sample.filter((r) => normalizePhone(r[c]).valid).length;
      if (count > bestCount) { bestCol = c; bestCount = count; }
    }
    if (bestCol < 0) {
      throw new Error(
        'Kolom nomor HP tidak ditemukan. Beri judul kolom seperti "No.HP", "Nomor", atau "Phone" di baris pertama.'
      );
    }
    phoneCol = bestCol;
    // Treat row 1 as a header only if its phone cell is not itself a phone number.
    const firstLooksLikeHeader = !normalizePhone(grid[0][phoneCol]).valid;
    headers = firstLooksLikeHeader ? grid[0] : [];
    dataRows = firstLooksLikeHeader ? grid.slice(1) : grid;
  }

  dataRows = dataRows.filter((r) => r.some((c) => c !== ''));

  if (dataRows.length === 0) throw new Error('Tidak ada baris data di bawah judul kolom.');

  if (dataRows.length > MAX_ROWS) {
    const err = new Error(
      `Jumlah baris (${dataRows.length}) melebihi batas maksimum ${MAX_ROWS} per pengiriman. ` +
      `Silakan pecah file menjadi beberapa batch.`
    );
    err.code = 'ROW_LIMIT_EXCEEDED';
    throw err;
  }

  const nameCol = findColumn(headers, NAME_KEYWORDS, new Set([phoneCol]));

  // Variable keys per column (unique, skip empty headers).
  const keyByCol = new Map();
  const used = new Set();
  headers.forEach((h, c) => {
    let key = toVariableKey(h);
    if (!key) return;
    let unique = key;
    for (let n = 2; used.has(unique); n++) unique = `${key}_${n}`;
    used.add(unique);
    keyByCol.set(c, unique);
  });

  const variables = [...keyByCol.values()];
  if (nameCol >= 0 && !used.has('nama')) variables.unshift('nama');

  const rows = dataRows.map((r) => {
    const vars = {};
    keyByCol.forEach((key, c) => { vars[key] = r[c] ?? ''; });
    return {
      rawPhone: r[phoneCol] ?? '',
      name: nameCol >= 0 ? (r[nameCol] ?? '') : '',
      vars,
    };
  });

  return {
    rows,
    meta: {
      phoneColumn: headers[phoneCol] || `Kolom ${phoneCol + 1}`,
      nameColumn: nameCol >= 0 ? headers[nameCol] : null,
      variables,
    },
  };
}

export { MAX_ROWS };

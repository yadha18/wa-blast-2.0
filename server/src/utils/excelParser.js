import XLSX from 'xlsx';

const MAX_ROWS = 20000;

/**
 * Parses an uploaded Excel/CSV file buffer into an array of { name, phone } rows.
 * Accepts flexible column headers: looks for a column named like
 * "no.hp" / "no_hp" / "phone" / "nomor" / "whatsapp" for the number,
 * and "nama" / "name" for an optional name.
 */
export function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki sheet.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('File Excel kosong atau tidak terbaca.');
  }

  if (rows.length > MAX_ROWS) {
    const err = new Error(
      `Jumlah baris (${rows.length}) melebihi batas maksimum ${MAX_ROWS} per pengiriman. ` +
      `Silakan pecah file menjadi beberapa batch.`
    );
    err.code = 'ROW_LIMIT_EXCEEDED';
    throw err;
  }

  const phoneKeys = ['no.hp', 'no_hp', 'nohp', 'no hp', 'phone', 'nomor', 'whatsapp', 'wa', 'hp', 'telepon', 'telp'];
  const nameKeys = ['nama', 'name'];

  const headerRow = Object.keys(rows[0] || {});
  const normalizedHeaders = headerRow.reduce((acc, key) => {
    acc[key.toString().trim().toLowerCase()] = key;
    return acc;
  }, {});

  const phoneColumn = phoneKeys.map(k => normalizedHeaders[k]).find(Boolean) || headerRow[0];
  const nameColumn = nameKeys.map(k => normalizedHeaders[k]).find(Boolean);

  if (!phoneColumn) {
    throw new Error('Tidak dapat menemukan kolom nomor HP. Pastikan ada kolom bernama "No.HP", "Nomor", atau "Phone".');
  }

  return rows.map(row => ({
    rawPhone: row[phoneColumn],
    name: nameColumn ? row[nameColumn] : '',
  }));
}

export { MAX_ROWS };

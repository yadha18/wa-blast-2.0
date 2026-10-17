/**
 * Validates & normalizes phone numbers to WhatsApp JID-ready international format
 * (no +, no spaces, country code prefixed). Defaults to Indonesia (62) when a
 * local "0" prefixed number is given.
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) {
    return { valid: false, reason: 'Nomor kosong', normalized: null };
  }

  // Coerce numbers (e.g. Excel reading "081234" as numeric) to string safely
  let value = String(raw).trim();

  if (!value) {
    return { valid: false, reason: 'Nomor kosong', normalized: null };
  }

  // Strip everything except digits and leading +
  value = value.replace(/[^\d+]/g, '');
  value = value.replace(/(?!^)\+/g, ''); // remove any non-leading +

  let hasPlus = value.startsWith('+');
  let digits = value.replace(/^\+/, '');

  if (!/^\d+$/.test(digits)) {
    return { valid: false, reason: 'Mengandung karakter non-numerik', normalized: null };
  }

  // Normalize Indonesian local formats
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8') && !hasPlus && digits.length <= 12) {
    // e.g. "812345..." without leading 0 or country code
    digits = '62' + digits;
  }

  if (digits.length < 9 || digits.length > 15) {
    return { valid: false, reason: `Panjang nomor tidak valid (${digits.length} digit)`, normalized: null };
  }

  // Basic sanity: Indonesian mobile numbers after 62 should start with 8
  if (digits.startsWith('62') && digits[2] !== '8') {
    return { valid: false, reason: 'Bukan format nomor seluler Indonesia (harus diawali 8 setelah 62)', normalized: null };
  }

  return { valid: true, reason: null, normalized: digits };
}

export function toWhatsAppJid(normalizedNumber) {
  return `${normalizedNumber}@s.whatsapp.net`;
}

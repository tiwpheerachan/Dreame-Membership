// ============================================================
// Thai phone number normalization
//
// User-typed phones come in many formats:
//   "081-234-5678" / "0812345678" / "+66812345678" / "66812345678"
//   "081 234 5678" / "081.234.5678" / "(081) 234-5678"
//
// We canonicalize to E.164 (+66xxxxxxxxx) for:
//   - Supabase Auth (requires E.164)
//   - storing in users.phone (single canonical form for dedup)
//   - sending via SMS provider (E.164 routes correctly to TH carriers)
// ============================================================

export class PhoneError extends Error {
  constructor(message: string) {
    super(message); this.name = 'PhoneError'
  }
}

// Strip everything that's not a digit or a leading +
function stripFormatting(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Preserve a single leading +, drop the rest of non-digit characters
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * Normalize a Thai phone number to E.164 (+66xxxxxxxxx).
 * Throws `PhoneError` if the input is unmistakably not a TH mobile.
 *
 *   "0812345678"   → "+66812345678"
 *   "+66812345678" → "+66812345678"
 *   "66812345678"  → "+66812345678"
 *   "081-234-5678" → "+66812345678"
 */
export function normalizeThaiPhone(raw: string): string {
  const cleaned = stripFormatting(raw)
  if (!cleaned) throw new PhoneError('phone is empty')

  // Already E.164 with +66 prefix
  if (cleaned.startsWith('+66')) {
    const local = cleaned.slice(3)
    if (local.length !== 9) throw new PhoneError('invalid TH mobile length after +66')
    if (!/^[689]/.test(local)) throw new PhoneError('TH mobile must start with 6, 8 or 9')
    return `+66${local}`
  }

  // 66-prefixed without + (e.g. user typed "66812345678")
  if (cleaned.startsWith('66') && cleaned.length === 11) {
    const local = cleaned.slice(2)
    if (!/^[689]/.test(local)) throw new PhoneError('TH mobile must start with 6, 8 or 9')
    return `+66${local}`
  }

  // Local Thai format starting with 0 (e.g. "0812345678")
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    const local = cleaned.slice(1)
    if (!/^[689]/.test(local)) throw new PhoneError('TH mobile must start with 06, 08 or 09')
    return `+66${local}`
  }

  // Other countries — not supported in MVP. We can extend later, but
  // for now reject so we don't accidentally bill SMS to international numbers.
  throw new PhoneError('only Thai mobile numbers are supported')
}

/**
 * Pretty-print E.164 (+66xxxxxxxxx) back as a Thai local format for UI display.
 *   "+66812345678" → "081-234-5678"
 */
export function formatThaiPhoneForDisplay(e164: string): string {
  if (!e164.startsWith('+66') || e164.length !== 12) return e164
  const local = '0' + e164.slice(3)
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
}

/** Best-effort check: caller can pre-validate before hitting the server. */
export function isValidThaiMobile(raw: string): boolean {
  try { normalizeThaiPhone(raw); return true } catch { return false }
}

export const FIN_REGEX = /^[A-HJ-NP-Z0-9]{7}$/
export const SERIAL_NUMBER_REGEX = /^[A-Z]{2}\d{7}$/

const DIGIT_LOOKALIKE_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '8': 'B', '5': 'S', '2': 'Z', '6': 'G' }
const LETTER_LOOKALIKE_TO_DIGIT: Record<string, string> = { O: '0', I: '1', B: '8', S: '5', Z: '2', G: '6' }

function stripNoise(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * FIN is 7 alnum chars that must never contain I or O. Only the guaranteed-invalid
 * I/O characters are rewritten (to 1/0); other ambiguous confusions are left as-is
 * rather than guessed, per the "do not silently change uncertain results" rule.
 */
export function normalizeFin(raw: string): string | null {
  const cleaned = stripNoise(raw)
  if (cleaned.length !== 7) return null
  const fixed = cleaned.replace(/I/g, '1').replace(/O/g, '0')
  return FIN_REGEX.test(fixed) ? fixed : null
}

/**
 * Serial is 2 letters + 7 digits, so each position's expected type is known and
 * OCR lookalikes can be safely corrected positionally.
 */
export function normalizeSerial(raw: string): string | null {
  const cleaned = stripNoise(raw)
  if (cleaned.length !== 9) return null

  const letters = cleaned
    .slice(0, 2)
    .split('')
    .map((ch) => (/[A-Z]/.test(ch) ? ch : DIGIT_LOOKALIKE_TO_LETTER[ch] ?? ch))
    .join('')
  const digits = cleaned
    .slice(2)
    .split('')
    .map((ch) => (/[0-9]/.test(ch) ? ch : LETTER_LOOKALIKE_TO_DIGIT[ch] ?? ch))
    .join('')

  const fixed = letters + digits
  return SERIAL_NUMBER_REGEX.test(fixed) ? fixed : null
}

/** Accepts a value only if it appears identically in at least `minCount` of the readings. */
export function pickConsensusValue(values: Array<string | null>, minCount: number): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  for (const [value, count] of counts) {
    if (count >= minCount) return value
  }
  return null
}

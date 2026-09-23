export interface ParsedIdCard {
  fin: string | null
  seriyaNomre: string | null
  adi: string | null
  soyadi: string | null
  dogumTarixi: string | null
  raw: string
}

const FIN_RE = /\b[A-Z0-9]{7}\b/
const SERIYA_NOMRE_RE = /\b[A-Z]{2}\d{7}\b/
const DATE_RE = /\b\d{2}[./]\d{2}[./]\d{4}\b/
const NAME_LINE_RE = /^[A-ZƏĞÇŞİÖÜ][A-ZƏĞÇŞİÖÜ'-]*$/
const LABEL_WORDS = ['ADI', 'SOYADI', 'FIN', 'SERİYA', 'SERIYA', 'DOĞUM', 'DOGUM', 'AZƏRBAYCAN', 'REPUBLIKASI']

function findLabelValue(lines: string[], labels: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const upper = line.toUpperCase()
    const matchedLabel = labels.find((label) => upper.includes(label))
    if (!matchedLabel) continue

    const afterLabel = line.slice(upper.indexOf(matchedLabel) + matchedLabel.length).replace(/^[:\s./]+/, '').trim()
    if (afterLabel) return afterLabel

    const nextLine = lines[i + 1]?.trim()
    if (nextLine && !labels.some((label) => nextLine.toUpperCase().includes(label))) return nextLine
  }
  return null
}

// Fallback: pick standalone all-caps name lines (no labels) when label-based lookup finds nothing.
function findNameLines(lines: string[]): string[] {
  return lines
    .map((line) => line.toUpperCase())
    .filter((line) => NAME_LINE_RE.test(line) && !LABEL_WORDS.some((word) => line.includes(word)))
}

export function parseIdCard(text: string): ParsedIdCard {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const finMatch = text.match(new RegExp(`FIN[:\\s]*(${FIN_RE.source})`, 'i')) ?? text.match(FIN_RE)
  const seriyaMatch = text.match(SERIYA_NOMRE_RE)
  const dateMatches = [...text.matchAll(new RegExp(DATE_RE.source, 'g'))]

  const labelSoyadi = findLabelValue(lines, ['SOYADI', 'SURNAME', 'LAST NAME'])
  const labelAdi = findLabelValue(lines, ['ADI', 'GIVEN NAME', 'FIRST NAME'])
  const nameLines = labelSoyadi && labelAdi ? [] : findNameLines(lines)

  return {
    fin: finMatch ? finMatch[1] ?? finMatch[0] : null,
    seriyaNomre: seriyaMatch ? seriyaMatch[0] : null,
    adi: labelAdi ?? nameLines[1] ?? null,
    soyadi: labelSoyadi ?? nameLines[0] ?? null,
    dogumTarixi: dateMatches.length > 0 ? dateMatches[0][0] : null,
    raw: text,
  }
}

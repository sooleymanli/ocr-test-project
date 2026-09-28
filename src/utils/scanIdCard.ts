import { CONFIDENCE_THRESHOLD, FIELD_CROP_REGIONS, OCR_UPSCALE, type FractionalRect } from '../config/idCardScan'
import { INK_THRESHOLD, REGION_LABELS, type RegionKey } from '../config/identityCardRegions'
import { cropFractionalRegion, normalizeCardFrame, preprocessForOcr } from './imagePipeline'
import { recognizeRegion } from './ocrEngine'
import { cleanNameField } from './parseFullName'
import { normalizeFin, normalizeSerial } from './validators'

export interface FieldScanResult {
  value: string | null
  confident: boolean
}

export interface ScanIdCardResult {
  fin: FieldScanResult
  serial: FieldScanResult
  fullName: FieldScanResult
  previewImage: string
  allText: string
}

const NAME_KEYS = ['givenName', 'surname', 'patronymic'] as const

async function readRegion(card: HTMLCanvasElement, key: RegionKey) {
  const crop = cropFractionalRegion(card, FIELD_CROP_REGIONS[key], OCR_UPSCALE)
  try {
    return await recognizeRegion(preprocessForOcr(crop, INK_THRESHOLD), key)
  } finally {
    crop.width = 0
    crop.height = 0
  }
}

function firstValid(text: string, normalize: (raw: string) => string | null): string | null {
  for (const candidate of [text, ...text.split(/\s+/)]) {
    const value = normalize(candidate)
    if (value) return value
  }
  return null
}

/** OCRs only the five calibrated field regions of a captured card image. */
export async function scanIdCardImage(image: ImageBitmap | HTMLCanvasElement, guideRect: FractionalRect): Promise<ScanIdCardResult> {
  const source = document.createElement('canvas')
  source.width = image.width
  source.height = image.height
  const ctx = source.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.drawImage(image, 0, 0)

  const card = normalizeCardFrame(source, guideRect)
  source.width = 0
  source.height = 0
  const previewImage = card.toDataURL('image/jpeg', 0.92)
  try {
    const keys = Object.keys(FIELD_CROP_REGIONS) as RegionKey[]
    const readings = {} as Record<RegionKey, { text: string; score: number }>
    for (const key of keys) readings[key] = await readRegion(card, key)

    const trusted = (key: RegionKey) => readings[key].score >= CONFIDENCE_THRESHOLD
    const fin = trusted('fin') ? firstValid(readings.fin.text, normalizeFin) : null
    const serial = trusted('serial') ? firstValid(readings.serial.text, normalizeSerial) : null
    const names = NAME_KEYS.map((key) => cleanNameField(readings[key].text))
    const fullName = names.filter(Boolean).join(' ')

    return {
      fin: { value: fin, confident: fin !== null },
      serial: { value: serial, confident: serial !== null },
      fullName: { value: fullName || null, confident: names.every(Boolean) && NAME_KEYS.every(trusted) },
      previewImage,
      allText: keys.map((key) => `${REGION_LABELS[key]}: ${readings[key].text}`).join('\n'),
    }
  } finally {
    card.width = 0
    card.height = 0
  }
}

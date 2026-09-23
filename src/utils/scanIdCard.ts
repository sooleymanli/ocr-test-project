import type { RecognizeResult } from 'tesseract.js'
import {
  BURST_FRAME_COUNT,
  BURST_FRAME_INTERVAL_MS,
  CONFIDENCE_THRESHOLD,
  FIELD_CROP_REGIONS,
  REQUIRED_CONSENSUS_COUNT,
  type FractionalRect,
} from '../config/idCardScan'
import { captureVideoFrame, cropFractionalRegion, normalizeCardFrame, preprocessForOcr } from './imagePipeline'
import { getOcrEngine } from './ocrEngine'
import { normalizeFin, normalizeSerial, pickConsensusValue } from './validators'

export interface FieldScanResult {
  value: string | null
  confident: boolean
}

export interface ScanIdCardResult {
  fin: FieldScanResult
  serial: FieldScanResult
  previewImage: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function bestReading(result: RecognizeResult): { text: string; score: number } | null {
  const text = result.data.text.trim()
  if (!text) return null
  return { text, score: result.data.confidence / 100 }
}

/**
 * Captures a short burst of frames from the live video, crops the FIN and serial
 * regions from each, runs OCR independently per field, and only accepts a value
 * once it is read consistently (see REQUIRED_CONSENSUS_COUNT) across the burst.
 */
export async function scanIdCard(video: HTMLVideoElement, guideRect: FractionalRect): Promise<ScanIdCardResult> {
  const ocr = await getOcrEngine()

  const finReadings: Array<string | null> = []
  const serialReadings: Array<string | null> = []
  let previewImage = ''

  for (let attempt = 0; attempt < BURST_FRAME_COUNT; attempt++) {
    const frame = captureVideoFrame(video)
    const card = normalizeCardFrame(frame, guideRect)
    if (!previewImage) previewImage = card.toDataURL('image/jpeg', 0.92)

    const finCanvas = preprocessForOcr(cropFractionalRegion(card, FIELD_CROP_REGIONS.fin))
    const serialCanvas = preprocessForOcr(cropFractionalRegion(card, FIELD_CROP_REGIONS.serial))

    const finResult = await ocr.recognize(finCanvas)
    const serialResult = await ocr.recognize(serialCanvas)

    const finReading = bestReading(finResult)
    const serialReading = bestReading(serialResult)

    finReadings.push(
      finReading && finReading.score >= CONFIDENCE_THRESHOLD ? normalizeFin(finReading.text) : null,
    )
    serialReadings.push(
      serialReading && serialReading.score >= CONFIDENCE_THRESHOLD ? normalizeSerial(serialReading.text) : null,
    )

    if (attempt < BURST_FRAME_COUNT - 1) await delay(BURST_FRAME_INTERVAL_MS)
  }

  const finValue = pickConsensusValue(finReadings, REQUIRED_CONSENSUS_COUNT)
  const serialValue = pickConsensusValue(serialReadings, REQUIRED_CONSENSUS_COUNT)

  return {
    fin: { value: finValue, confident: finValue !== null },
    serial: { value: serialValue, confident: serialValue !== null },
    previewImage,
  }
}

/** Runs the same field OCR + normalization pipeline against a single still image (gallery upload fallback). */
export async function scanIdCardImage(imageBitmap: ImageBitmap, guideRect: FractionalRect): Promise<ScanIdCardResult> {
  const ocr = await getOcrEngine()

  const source = document.createElement('canvas')
  source.width = imageBitmap.width
  source.height = imageBitmap.height
  const ctx = source.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.drawImage(imageBitmap, 0, 0)

  const card = normalizeCardFrame(source, guideRect)
  const previewImage = card.toDataURL('image/jpeg', 0.92)

  const finCanvas = preprocessForOcr(cropFractionalRegion(card, FIELD_CROP_REGIONS.fin))
  const serialCanvas = preprocessForOcr(cropFractionalRegion(card, FIELD_CROP_REGIONS.serial))

  const finResult = await ocr.recognize(finCanvas)
  const serialResult = await ocr.recognize(serialCanvas)

  const finReading = bestReading(finResult)
  const serialReading = bestReading(serialResult)

  const finValue = finReading && finReading.score >= CONFIDENCE_THRESHOLD ? normalizeFin(finReading.text) : null
  const serialValue =
    serialReading && serialReading.score >= CONFIDENCE_THRESHOLD ? normalizeSerial(serialReading.text) : null

  return {
    fin: { value: finValue, confident: finValue !== null },
    serial: { value: serialValue, confident: serialValue !== null },
    previewImage,
  }
}

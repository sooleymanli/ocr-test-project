import { createWorker, PSM, type Worker } from 'tesseract.js'
import type { RegionKey } from '../config/identityCardRegions'

let workerPromise: Promise<Worker> | null = null
let queue: Promise<unknown> = Promise.resolve()

const IDENTIFIER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const NAME_CHARS = "ABCÇDEƏFGĞHXIİJKQLMNOÖPRSŞTUÜVYZWabcçdeəfgğhxıijkqlmnoöprsştuüvyzw -'’"

/** Lazily creates a single reused tesseract.js worker for the whole app. */
function getOcrEngine(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('aze+eng')
      .catch((err) => {
        workerPromise = null
        throw err
      })
  }
  return workerPromise
}

/** Reads one single-line field; jobs are queued so per-field parameters never mix. */
export function recognizeRegion(canvas: HTMLCanvasElement, key: RegionKey): Promise<{ text: string; score: number }> {
  const isIdentifier = key === 'fin' || key === 'serial'
  const job = queue.then(async () => {
    const ocr = await getOcrEngine()
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: isIdentifier ? IDENTIFIER_CHARS : NAME_CHARS,
      preserve_interword_spaces: isIdentifier ? '0' : '1',
    })
    const { data } = await ocr.recognize(canvas)
    return { text: data.text.trim(), score: data.confidence / 100 }
  })
  queue = job.catch(() => undefined)
  return job
}


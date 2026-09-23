import { createWorker, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

/** Lazily creates a single reused tesseract.js worker for the whole app. */
export function getOcrEngine(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng')
      .then(async (worker) => {
        await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' })
        return worker
      })
      .catch((err) => {
        workerPromise = null
        throw err
      })
  }
  return workerPromise
}


import { PaddleOCR } from '@paddleocr/paddleocr-js'

let enginePromise: ReturnType<typeof PaddleOCR.create> | null = null

/** Lazily creates a single reused PaddleOCR instance (WASM backend, Web Worker) for the whole app. */
export function getOcrEngine() {
  if (!enginePromise) {
    enginePromise = PaddleOCR.create({
      textDetectionModelName: 'PP-OCRv5_mobile_det',
      textRecognitionModelName: 'PP-OCRv5_mobile_rec',
      worker: true,
      ortOptions: {
        backend: 'wasm',
      },
    }).catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

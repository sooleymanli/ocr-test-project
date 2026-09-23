import { NORMALIZED_CARD_HEIGHT, NORMALIZED_CARD_WIDTH, type FractionalRect } from '../config/idCardScan'

/** Draws the current video frame onto a canvas at the video's native resolution. */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Crops the region under the on-screen card guide (in source pixel coordinates) and
 * resizes it to a fixed normalized size so downstream crop regions stay consistent.
 */
export function normalizeCardFrame(source: HTMLCanvasElement, guideRect: FractionalRect): HTMLCanvasElement {
  const sx = guideRect.x * source.width
  const sy = guideRect.y * source.height
  const sw = guideRect.width * source.width
  const sh = guideRect.height * source.height

  const canvas = document.createElement('canvas')
  canvas.width = NORMALIZED_CARD_WIDTH
  canvas.height = NORMALIZED_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Crops a fractional sub-region (e.g. the FIN or serial field) out of the normalized card canvas. */
export function cropFractionalRegion(card: HTMLCanvasElement, rect: FractionalRect): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rect.width * card.width)
  canvas.height = Math.round(rect.height * card.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.drawImage(
    card,
    rect.x * card.width,
    rect.y * card.height,
    rect.width * card.width,
    rect.height * card.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

/** Grayscale + contrast stretch + light sharpen, to improve OCR legibility on small text crops. */
export function preprocessForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  // Grayscale
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Contrast stretch based on observed min/max
  let min = 255
  let max = 0
  for (const value of gray) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const range = Math.max(max - min, 1)

  // Simple 3x3 sharpen kernel applied after contrast-stretching
  const stretched = new Uint8ClampedArray(gray.length)
  for (let i = 0; i < gray.length; i++) {
    stretched[i] = ((gray[i] - min) / range) * 255
  }

  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let k = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sx = Math.min(width - 1, Math.max(0, x + kx))
          const sy = Math.min(height - 1, Math.max(0, y + ky))
          sum += stretched[sy * width + sx] * kernel[k]
          k++
        }
      }
      const idx = (y * width + x) * 4
      const value = Math.min(255, Math.max(0, sum))
      data[idx] = value
      data[idx + 1] = value
      data[idx + 2] = value
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas blob-a çevrilmədi'))
    }, 'image/png')
  })
}

/**
 * Maps the on-screen guide frame's viewport rectangle to a fractional rectangle in the
 * video's native (source) pixel space, accounting for `object-fit: cover` scaling/cropping.
 */
export function computeGuideFractionInVideo(
  video: HTMLVideoElement,
  frameRect: DOMRect,
  containerRect: DOMRect,
): FractionalRect {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  const scale = Math.max(containerRect.width / videoWidth, containerRect.height / videoHeight)
  const displayedWidth = videoWidth * scale
  const displayedHeight = videoHeight * scale
  const offsetX = (displayedWidth - containerRect.width) / 2
  const offsetY = (displayedHeight - containerRect.height) / 2

  const relativeLeft = frameRect.left - containerRect.left
  const relativeTop = frameRect.top - containerRect.top

  const sourceX = (relativeLeft + offsetX) / scale
  const sourceY = (relativeTop + offsetY) / scale
  const sourceWidth = frameRect.width / scale
  const sourceHeight = frameRect.height / scale

  return {
    x: sourceX / videoWidth,
    y: sourceY / videoHeight,
    width: sourceWidth / videoWidth,
    height: sourceHeight / videoHeight,
  }
}

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
export function cropFractionalRegion(card: HTMLCanvasElement, rect: FractionalRect, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rect.width * card.width * scale))
  canvas.height = Math.max(1, Math.round(rect.height * card.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')
  ctx.imageSmoothingQuality = 'high'
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

// Channel spread above this is treated as colored (pink background, red/blue print), never as black ink.
const MAX_INK_CHROMA = 70

function percentile(histogram: Uint32Array, total: number, fraction: number): number {
  const target = total * fraction
  let count = 0
  for (let value = 0; value < histogram.length; value++) {
    count += histogram[value]
    if (count >= target) return value
  }
  return histogram.length - 1
}

/**
 * Keeps only dark, uncolored pixels (the black data print) and whitens everything else,
 * so lighter gray field titles and the colored background are not read.
 * `inkThreshold` (0-1) is where the cut sits between the darkest ink and the paper tone.
 */
export function preprocessForOcr(canvas: HTMLCanvasElement, inkThreshold: number): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D konteksti alınmadı')

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const total = width * height

  const luminance = new Uint8ClampedArray(total)
  const histogram = new Uint32Array(256)
  for (let i = 0; i < total; i++) {
    const value = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    luminance[i] = value
    histogram[luminance[i]]++
  }

  const ink = percentile(histogram, total, 0.01)
  const paper = percentile(histogram, total, 0.5)
  const cutoff = ink + (paper - ink) * inkThreshold

  for (let i = 0; i < total; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const value = luminance[i] <= cutoff && chroma <= MAX_INK_CHROMA ? 0 : 255
    data[i * 4] = value
    data[i * 4 + 1] = value
    data[i * 4 + 2] = value
    data[i * 4 + 3] = 255
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

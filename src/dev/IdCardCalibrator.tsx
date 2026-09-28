import { useCallback, useEffect, useRef, useState } from 'react'
import { OCR_UPSCALE } from '../config/idCardScan'
import { IDENTITY_CARD_REGIONS, REGION_LABELS, type CropRegion, type RegionKey } from '../config/identityCardRegions'
import { recognizeRegion } from '../utils/ocrEngine'
import { cropFractionalRegion, preprocessForOcr } from '../utils/imagePipeline'

interface OcrReading {
  text: string
  score: number
}

const REGION_KEYS = Object.keys(IDENTITY_CARD_REGIONS) as RegionKey[]

const HANDLE_SIZE = 28

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clampRegion(region: CropRegion): CropRegion {
  const width = Math.max(0.02, clamp01(region.width))
  const height = Math.max(0.02, clamp01(region.height))
  return {
    x: clamp01(Math.min(region.x, 1 - width)),
    y: clamp01(Math.min(region.y, 1 - height)),
    width,
    height,
  }
}

/** Dev-only tool for visually calibrating the FIN/serial crop rectangles against a sample card photo. */
function IdCardCalibrator({ initialImageUrl }: { initialImageUrl?: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null)
  const [regions, setRegions] = useState<Record<RegionKey, CropRegion>>(IDENTITY_CARD_REGIONS)
  const [readings, setReadings] = useState(
    () => Object.fromEntries(REGION_KEYS.map((key) => [key, null])) as Record<RegionKey, OcrReading | 'pending' | 'error' | null>,
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const previewCanvasRefs = useRef<Partial<Record<RegionKey, HTMLCanvasElement | null>>>({})
  const dragState = useRef<{
    key: RegionKey
    mode: 'move' | 'resize'
    startX: number
    startY: number
    startRegion: CropRegion
  } | null>(null)

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
  }

  const runOcrForRegion = useCallback(async (key: RegionKey, region: CropRegion) => {
    const image = imageRef.current
    if (!image || !image.naturalWidth) return

    setReadings((prev) => ({ ...prev, [key]: 'pending' }))
    try {
      const source = document.createElement('canvas')
      source.width = image.naturalWidth
      source.height = image.naturalHeight
      const sourceCtx = source.getContext('2d')
      if (!sourceCtx) throw new Error('no-context')
      sourceCtx.drawImage(image, 0, 0)

      const cropCanvas = cropFractionalRegion(source, region, OCR_UPSCALE)
      source.width = 0
      source.height = 0

      const previewCanvas = previewCanvasRefs.current[key]
      if (previewCanvas) {
        previewCanvas.width = cropCanvas.width
        previewCanvas.height = cropCanvas.height
        previewCanvas.getContext('2d')?.drawImage(cropCanvas, 0, 0)
      }

      const { text, score } = await recognizeRegion(preprocessForOcr(cropCanvas), key)
      cropCanvas.width = 0
      cropCanvas.height = 0

      setReadings((prev) => ({
        ...prev,
        [key]: text ? { text, score } : 'error',
      }))
    } catch {
      setReadings((prev) => ({ ...prev, [key]: 'error' }))
    }
  }, [])

  function handlePointerDown(key: RegionKey, mode: 'move' | 'resize', event: React.PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    dragState.current = { key, mode, startX: event.clientX, startY: event.clientY, startRegion: regions[key] }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragState.current
    const container = containerRef.current
    if (!drag || !container) return

    const rect = container.getBoundingClientRect()
    const dxFrac = (event.clientX - drag.startX) / rect.width
    const dyFrac = (event.clientY - drag.startY) / rect.height

    setRegions((prev) => {
      const next = { ...drag.startRegion }
      if (drag.mode === 'move') {
        next.x = next.x + dxFrac
        next.y = next.y + dyFrac
      } else {
        next.width = next.width + dxFrac
        next.height = next.height + dyFrac
      }
      return { ...prev, [drag.key]: clampRegion(next) }
    })
  }

  function handlePointerUp() {
    const drag = dragState.current
    dragState.current = null
    if (drag) void runOcrForRegion(drag.key, regions[drag.key])
  }

  async function handleCopyConfig() {
    const body = (Object.keys(regions) as RegionKey[])
      .map((key) => {
        const r = regions[key]
        return `  ${key}: {\n    x: ${r.x.toFixed(3)},\n    y: ${r.y.toFixed(3)},\n    width: ${r.width.toFixed(3)},\n    height: ${r.height.toFixed(3)},\n  },`
      })
      .join('\n')
    const text = `export const IDENTITY_CARD_REGIONS = {\n${body}\n} satisfies Record<string, CropRegion>`
    await navigator.clipboard.writeText(text)
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 1500)
  }

  return (
    <div className="calibrator">
      <h2>ID kart bölgə kalibrasiyası (yalnız development)</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {imageUrl && (
        <>
          <div
            ref={containerRef}
            className="calibrator-canvas"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Reference image only used for calibration, not user-facing */}
            <img
              ref={imageRef}
              src={imageUrl}
              className="calibrator-image"
              alt="Kalibrasiya üçün nümunə kart"
              onLoad={() => REGION_KEYS.forEach((key) => void runOcrForRegion(key, regions[key]))}
            />

            {(Object.keys(regions) as RegionKey[]).map((key) => {
              const r = regions[key]
              return (
                <div
                  key={key}
                  className="calibrator-rect"
                  style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}
                  onPointerDown={(e) => handlePointerDown(key, 'move', e)}
                >
                  <span className="calibrator-rect-label">{REGION_LABELS[key]}</span>
                  <div
                    className="calibrator-rect-handle"
                    style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
                    onPointerDown={(e) => handlePointerDown(key, 'resize', e)}
                  />
                </div>
              )
            })}
          </div>

          <div className="calibrator-panels">
            {(Object.keys(regions) as RegionKey[]).map((key) => {
              const r = regions[key]
              const reading = readings[key]
              return (
                <div key={key} className="calibrator-panel">
                  <h3>{REGION_LABELS[key]}</h3>
                  <p>
                    x: {r.x.toFixed(3)} y: {r.y.toFixed(3)} w: {r.width.toFixed(3)} h: {r.height.toFixed(3)}
                  </p>
                  <canvas
                    ref={(el) => {
                      previewCanvasRefs.current[key] = el
                    }}
                    className="calibrator-preview"
                  />
                  <p className="calibrator-ocr">
                    {reading === 'pending' && 'OCR işləyir...'}
                    {reading === 'error' && 'OCR alınmadı'}
                    {reading && typeof reading === 'object' && `"${reading.text}" (${Math.round(reading.score * 100)}%)`}
                    {!reading && 'Bölgəni tərpədin ki, OCR işə düşsün'}
                  </p>
                </div>
              )
            })}
          </div>

          <button type="button" className="btn btn-primary" onClick={handleCopyConfig}>
            {copyStatus === 'copied' ? 'Kopyalandı!' : 'Konfiqurasiyanı kopyala'}
          </button>
        </>
      )}
    </div>
  )
}

export default IdCardCalibrator

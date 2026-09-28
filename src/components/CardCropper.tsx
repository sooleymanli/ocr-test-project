import { useRef, useState } from 'react'
import { IDENTITY_CARD_REGIONS, type CropRegion, type RegionKey } from '../config/identityCardRegions'

// ID-1 card ratio; must match NORMALIZED_CARD_WIDTH / NORMALIZED_CARD_HEIGHT so calibrated regions line up.
const CARD_ASPECT = 1.586
const MIN_WIDTH_PX = 80

type Corner = 'nw' | 'ne' | 'sw' | 'se'
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const REGION_KEYS = Object.keys(IDENTITY_CARD_REGIONS) as RegionKey[]

interface CardCropperProps {
  imageUrl: string
  rect: CropRegion
  onChange: (rect: CropRegion) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function fitCardRect(rect: CropRegion, width: number, height: number): CropRegion {
  let w = rect.width * width
  let h = rect.height * height
  const cx = (rect.x + rect.width / 2) * width
  const cy = (rect.y + rect.height / 2) * height
  if (w / h > CARD_ASPECT) w = h * CARD_ASPECT
  else h = w / CARD_ASPECT
  const scale = Math.min(1, width / w, height / h)
  w *= scale
  h *= scale
  const x = clamp(cx - w / 2, 0, width - w)
  const y = clamp(cy - h / 2, 0, height - h)
  return { x: x / width, y: y / height, width: w / width, height: h / height }
}

function percentStyle(rect: CropRegion) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

/** Lets the user frame the card exactly on a still photo before OCR runs. */
function CardCropper({ imageUrl, rect, onChange }: CardCropperProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | Corner; startX: number; startY: number; start: CropRegion } | null>(null)
  const [loaded, setLoaded] = useState(false)

  function handlePointerDown(mode: 'move' | Corner, event: React.PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    stageRef.current?.setPointerCapture(event.pointerId)
    drag.current = { mode, startX: event.clientX, startY: event.clientY, start: rect }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const current = drag.current
    const stage = stageRef.current
    if (!current || !stage) return

    const bounds = stage.getBoundingClientRect()
    const W = bounds.width
    const H = bounds.height
    const start = current.start
    const sx = start.x * W
    const sy = start.y * H
    const sw = start.width * W
    const sh = start.height * H
    let x: number
    let y: number
    let w: number

    if (current.mode === 'move') {
      w = sw
      x = clamp(sx + event.clientX - current.startX, 0, W - sw)
      y = clamp(sy + event.clientY - current.startY, 0, H - sh)
    } else {
      const east = current.mode.endsWith('e')
      const south = current.mode.startsWith('s')
      const ax = east ? sx : sx + sw
      const ay = south ? sy : sy + sh
      const px = clamp(event.clientX - bounds.left, 0, W)
      const py = clamp(event.clientY - bounds.top, 0, H)
      const maxW = Math.min(east ? W - ax : ax, (south ? H - ay : ay) * CARD_ASPECT)
      w = clamp(Math.max(Math.abs(px - ax), Math.abs(py - ay) * CARD_ASPECT), Math.min(MIN_WIDTH_PX, maxW), maxW)
      x = east ? ax : ax - w
      y = south ? ay : ay - w / CARD_ASPECT
    }

    onChange({ x: x / W, y: y / H, width: w / W, height: w / CARD_ASPECT / H })
  }

  function handlePointerUp() {
    drag.current = null
  }

  return (
    <div className="cropper">
      <p className="cropper-hint">Vəsiqənin kənarlarını çərçivənin kənarlarına uyğunlaşdırın</p>
      <div
        ref={stageRef}
        className="cropper-stage"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={imageUrl}
          alt="Çəkilmiş şəkil"
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget
            onChange(fitCardRect(rect, image.naturalWidth, image.naturalHeight))
            setLoaded(true)
          }}
        />
        {loaded && (
          <>
            <div className="cropper-shade">
              <div className="cropper-shade-hole" style={percentStyle(rect)} />
            </div>
            <div className="cropper-rect" style={percentStyle(rect)} onPointerDown={(event) => handlePointerDown('move', event)}>
              {REGION_KEYS.map((key) => (
                <div key={key} className="cropper-field" style={percentStyle(IDENTITY_CARD_REGIONS[key])} />
              ))}
              {CORNERS.map((corner) => (
                <div
                  key={corner}
                  className={`cropper-handle cropper-handle-${corner}`}
                  onPointerDown={(event) => handlePointerDown(corner, event)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CardCropper

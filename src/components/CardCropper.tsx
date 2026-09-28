import { useRef, useState } from 'react'
import { IDENTITY_CARD_REGIONS, type CropRegion, type RegionKey } from '../config/identityCardRegions'

const MIN_SIZE_PX = 40

type Handle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
const HANDLES: Handle[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
const REGION_KEYS = Object.keys(IDENTITY_CARD_REGIONS) as RegionKey[]

interface CardCropperProps {
  imageUrl: string
  rect: CropRegion
  onChange: (rect: CropRegion) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampRect(rect: CropRegion): CropRegion {
  const x = clamp(rect.x, 0, 1)
  const y = clamp(rect.y, 0, 1)
  return { x, y, width: clamp(rect.width, 0.05, 1 - x), height: clamp(rect.height, 0.05, 1 - y) }
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
  const drag = useRef<{ mode: 'move' | Handle; startX: number; startY: number; start: CropRegion } | null>(null)
  const [loaded, setLoaded] = useState(false)

  function handlePointerDown(mode: 'move' | Handle, event: React.PointerEvent) {
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
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    let left = start.x * W
    let top = start.y * H
    let right = left + start.width * W
    let bottom = top + start.height * H

    if (current.mode === 'move') {
      const w = right - left
      const h = bottom - top
      left = clamp(left + dx, 0, W - w)
      top = clamp(top + dy, 0, H - h)
      right = left + w
      bottom = top + h
    } else {
      const mode = current.mode
      if (mode.includes('w')) left = clamp(left + dx, 0, right - MIN_SIZE_PX)
      if (mode.includes('e')) right = clamp(right + dx, left + MIN_SIZE_PX, W)
      if (mode.includes('n')) top = clamp(top + dy, 0, bottom - MIN_SIZE_PX)
      if (mode.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIZE_PX, H)
    }

    onChange({ x: left / W, y: top / H, width: (right - left) / W, height: (bottom - top) / H })
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
          onLoad={() => {
            onChange(clampRect(rect))
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
              {HANDLES.map((handle) => (
                <div
                  key={handle}
                  className={`cropper-handle cropper-handle-${handle}`}
                  onPointerDown={(event) => handlePointerDown(handle, event)}
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

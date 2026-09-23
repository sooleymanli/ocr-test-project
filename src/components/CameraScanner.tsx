import { useEffect, useRef, useState } from 'react'

interface CameraScannerProps {
  onCapture: (imageDataUrl: string) => void
  onClose: () => void
}

function CameraScanner({ onCapture, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setError('Kameraya giriş mümkün olmadı. İcazələri yoxlayın.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true">
      {error ? (
        <p className="scanner-error">{error}</p>
      ) : (
        <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
      )}
      <canvas ref={canvasRef} className="scanner-canvas-hidden" />

      <div className="scanner-guide">
        <div className="scanner-guide-frame" />
        <p className="scanner-guide-text">Telefonu üfüqi tutub vəsiqəni çərçivə içinə yerləşdirin</p>
      </div>

      <div className="scanner-controls">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Ləğv et
        </button>
        <button type="button" className="btn btn-primary" onClick={handleCapture} disabled={!!error}>
          Şəkil çək
        </button>
      </div>
    </div>
  )
}

export default CameraScanner

import { useCallback, useEffect, useRef, useState } from 'react'
import { IDENTITY_CARD_REGIONS } from '../config/identityCardRegions'
import { computeGuideFractionInVideo } from '../utils/imagePipeline'
import { scanIdCard, scanIdCardImage, type ScanIdCardResult } from '../utils/scanIdCard'

interface CameraScannerProps {
  onScanned: (result: ScanIdCardResult) => void
  onClose: () => void
}

type CameraState = 'idle' | 'starting' | 'live' | 'scanning' | 'unsupported' | 'denied' | 'error'

function CameraScanner({ onScanned, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => stopStream, [stopStream])

  // The <video> element only mounts once cameraState is 'live', so attach the
  // stream here (after it exists in the DOM) instead of right after getUserMedia resolves.
  useEffect(() => {
    if (cameraState === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraState])

  const handleStartCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setErrorMessage('Bu brauzer kameraya girişi dəstəkləmir. Qalereyadan şəkil yükləyə bilərsiniz.')
      return
    }

    setCameraState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraState('live')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraState('denied')
        setErrorMessage('Kameraya icazə verilmədi. Brauzer ayarlarından icazə verin və ya qalereyadan şəkil yükləyin.')
      } else {
        setCameraState('error')
        setErrorMessage('Kameraya giriş mümkün olmadı. Qalereyadan şəkil yükləyə bilərsiniz.')
      }
    }
  }, [])

  // Open the camera as soon as the scanner is shown, matching the "tap scan → camera opens" expectation.
  useEffect(() => {
    const timer = setTimeout(() => void handleStartCamera(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCapture() {
    const video = videoRef.current
    const frame = frameRef.current
    if (!video || !frame) return

    setCameraState('scanning')
    try {
      const guideRect = computeGuideFractionInVideo(video, frame.getBoundingClientRect(), video.getBoundingClientRect())
      const result = await scanIdCard(video, guideRect)
      stopStream()
      onScanned(result)
    } catch {
      setCameraState('live')
      setErrorMessage('Skan zamanı xəta baş verdi. Yenidən cəhd edin.')
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setCameraState('scanning')
    try {
      const bitmap = await createImageBitmap(file)
      const result = await scanIdCardImage(bitmap, { x: 0, y: 0, width: 1, height: 1 })
      bitmap.close()
      stopStream()
      onScanned(result)
    } catch {
      setCameraState(streamRef.current ? 'live' : 'idle')
      setErrorMessage('Şəkil oxunarkən xəta baş verdi. Yenidən cəhd edin.')
    }
  }

  function handleClose() {
    stopStream()
    onClose()
  }

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true">
      <div className="scanner-viewport">
        {cameraState === 'live' || cameraState === 'scanning' ? (
          <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
        ) : (
          <div className="scanner-placeholder">
            {errorMessage && <p className="scanner-error">{errorMessage}</p>}
          </div>
        )}

        {(cameraState === 'live' || cameraState === 'scanning') && (
          <div className="scanner-guide">
            <div ref={frameRef} className="scanner-guide-frame">
              <div
                className="scanner-field-hint"
                style={{
                  left: `${IDENTITY_CARD_REGIONS.serialNumber.x * 100}%`,
                  top: `${IDENTITY_CARD_REGIONS.serialNumber.y * 100}%`,
                  width: `${IDENTITY_CARD_REGIONS.serialNumber.width * 100}%`,
                  height: `${IDENTITY_CARD_REGIONS.serialNumber.height * 100}%`,
                }}
              >
                <span>Seriya</span>
              </div>
              <div
                className="scanner-field-hint"
                style={{
                  left: `${IDENTITY_CARD_REGIONS.fin.x * 100}%`,
                  top: `${IDENTITY_CARD_REGIONS.fin.y * 100}%`,
                  width: `${IDENTITY_CARD_REGIONS.fin.width * 100}%`,
                  height: `${IDENTITY_CARD_REGIONS.fin.height * 100}%`,
                }}
              >
                <span>FİN</span>
              </div>
            </div>
            <div className="scanner-guide-hints">
              <p>Şəxsiyyət vəsiqəsini çərçivəyə yerləşdirin</p>
              <p>FİN və seriya nömrəsini işarələnmiş sahələrə uyğunlaşdırın</p>
              <p>Vəsiqəni sabit saxlayın</p>
            </div>
          </div>
        )}

        {cameraState === 'scanning' && (
          <div className="scanner-scanning-badge">Analiz edilir...</div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="scanner-file-input"
        onChange={handleFileUpload}
      />

      <div className="scanner-controls">
        <button type="button" className="btn btn-secondary" onClick={handleClose}>
          Ləğv et
        </button>

        {cameraState === 'idle' || cameraState === 'unsupported' || cameraState === 'denied' || cameraState === 'error' ? (
          <button type="button" className="btn btn-primary" onClick={handleStartCamera}>
            Kameranı başlat
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCapture}
            disabled={cameraState !== 'live'}
          >
            Şəkil çək
          </button>
        )}

        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Qalereyadan yüklə
        </button>
      </div>
    </div>
  )
}

export default CameraScanner

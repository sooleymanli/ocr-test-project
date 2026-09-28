import { useCallback, useEffect, useRef, useState } from 'react'
import { captureVideoFrame, computeGuideFractionInVideo } from '../utils/imagePipeline'
import { scanIdCardImage, type ScanIdCardResult } from '../utils/scanIdCard'

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
  const operationRef = useRef(0)
  const busyRef = useRef(false)

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => {
    operationRef.current++
    stopStream()
  }, [stopStream])

  // The <video> element only mounts once cameraState is 'live', so attach the
  // stream here (after it exists in the DOM) instead of right after getUserMedia resolves.
  useEffect(() => {
    if (cameraState === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => {
        stopStream()
        setCameraState('error')
        setErrorMessage('Kamera başladılmadı. Yenidən cəhd edin və ya qalereyadan şəkil yükləyin.')
      })
    }
  }, [cameraState, stopStream])

  async function handleCapture() {
    const video = videoRef.current
    const frame = frameRef.current
    if (busyRef.current || cameraState !== 'live' || !video || !frame || !videoReady) return

    busyRef.current = true
    const operation = ++operationRef.current
    let snapshot: HTMLCanvasElement | null = null
    try {
      const guideRect = computeGuideFractionInVideo(video, frame.getBoundingClientRect(), video.getBoundingClientRect())
      snapshot = captureVideoFrame(video)
      setCapturedImage(snapshot.toDataURL('image/jpeg', 0.92))
      setCameraState('scanning')
      setErrorMessage(null)
      stopStream()
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (operation !== operationRef.current) return
      const result = await scanIdCardImage(snapshot, guideRect)
      if (operation === operationRef.current) onScanned(result)
    } catch {
      if (operation === operationRef.current) {
        setErrorMessage('Şəkil oxunarkən xəta baş verdi. Yenidən cəhd edin.')
        setCameraState('error')
      }
    } finally {
      if (snapshot) {
        snapshot.width = 0
        snapshot.height = 0
      }
      if (operation === operationRef.current) busyRef.current = false
    }
  }

  const handleStartCamera = useCallback(async () => {
    if (busyRef.current) return
    const operation = ++operationRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setErrorMessage('Bu brauzer kameraya girişi dəstəkləmir. Qalereyadan şəkil yükləyə bilərsiniz.')
      return
    }

    setCameraState('starting')
    setVideoReady(false)
    setCapturedImage(null)
    setErrorMessage(null)
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      if (operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setCameraState('live')
    } catch (err) {
      if (operation !== operationRef.current) return
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraState('denied')
        setErrorMessage('Kameraya icazə verilmədi. Brauzer ayarlarından icazə verin və ya qalereyadan şəkil yükləyin.')
      } else {
        setCameraState('error')
        setErrorMessage('Kameraya giriş mümkün olmadı. Qalereyadan şəkil yükləyə bilərsiniz.')
      }
    }
  }, [stopStream])

  // Open the camera as soon as the scanner is shown, matching the "tap scan → camera opens" expectation.
  useEffect(() => {
    const timer = setTimeout(() => void handleStartCamera(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyRef.current) return

    busyRef.current = true
    const operation = ++operationRef.current
    setCameraState('scanning')
    setCapturedImage(null)
    setErrorMessage(null)
    stopStream()
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file)
      if (operation !== operationRef.current) return
      const result = await scanIdCardImage(bitmap, { x: 0, y: 0, width: 1, height: 1 })
      if (operation === operationRef.current) onScanned(result)
    } catch {
      if (operation === operationRef.current) {
        setCameraState('error')
        setErrorMessage('Şəkil oxunarkən xəta baş verdi. Yenidən cəhd edin.')
      }
    } finally {
      bitmap?.close()
      if (operation === operationRef.current) busyRef.current = false
    }
  }

  function handleClose() {
    operationRef.current++
    stopStream()
    onClose()
  }

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true">
      <div className="scanner-viewport">
        {cameraState === 'live' ? (
          <video ref={videoRef} className="scanner-video" autoPlay playsInline muted onLoadedData={() => setVideoReady(true)} />
        ) : cameraState === 'scanning' && capturedImage ? (
          <img className="scanner-video" src={capturedImage} alt="Çəkilmiş şəkil" />
        ) : (
          <div className="scanner-placeholder">
            {errorMessage && <p className="scanner-error">{errorMessage}</p>}
          </div>
        )}

        {cameraState === 'live' && (
          <div className="scanner-guide">
            <div ref={frameRef} className="scanner-guide-frame" />
            <div className="scanner-guide-hints">
              <p>Şəxsiyyət vəsiqəsini çərçivəyə yerləşdirin</p>
              <p>İşığın kifayət qədər olduğuna əmin olun</p>
              <p>Vəsiqəni sabit saxlayın</p>
            </div>
          </div>
        )}

        {cameraState === 'scanning' && (
          <div className="scanner-scanning-badge" role="status">
            <progress aria-label="Şəkil oxunur" />
            <span>Şəkil oxunur...</span>
          </div>
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

        {cameraState === 'live' && (
          <button type="button" className="btn btn-primary" onClick={handleCapture} disabled={!videoReady}>
            Şəkil çək
          </button>
        )}

        {cameraState === 'idle' || cameraState === 'unsupported' || cameraState === 'denied' || cameraState === 'error' ? (
          <button type="button" className="btn btn-primary" onClick={handleStartCamera}>
            Kameranı başlat
          </button>
        ) : null}

        <button type="button" className="btn btn-secondary" disabled={cameraState === 'scanning' || cameraState === 'starting'} onClick={() => fileInputRef.current?.click()}>
          Qalereyadan yüklə
        </button>
      </div>
    </div>
  )
}

export default CameraScanner

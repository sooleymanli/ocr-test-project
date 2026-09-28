import { useCallback, useEffect, useRef, useState } from 'react'
import type { CropRegion } from '../config/identityCardRegions'
import { captureVideoFrame, computeGuideFractionInVideo } from '../utils/imagePipeline'
import { scanIdCardImage, type ScanIdCardResult } from '../utils/scanIdCard'
import CardCropper from './CardCropper'

interface CameraScannerProps {
  onScanned: (result: ScanIdCardResult) => void
  onClose: () => void
}

type CameraState = 'idle' | 'starting' | 'live' | 'cropping' | 'scanning' | 'unsupported' | 'denied' | 'error'
type CapturedSource = HTMLCanvasElement | ImageBitmap

const DEFAULT_CROP: CropRegion = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }

function releaseSource(source: CapturedSource | null) {
  if (source instanceof HTMLCanvasElement) {
    source.width = 0
    source.height = 0
  } else {
    source?.close()
  }
}

function CameraScanner({ onScanned, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<CapturedSource | null>(null)
  const operationRef = useRef(0)
  const busyRef = useRef(false)

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cropRect, setCropRect] = useState<CropRegion>(DEFAULT_CROP)
  const [videoReady, setVideoReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const clearCapture = useCallback(() => {
    releaseSource(sourceRef.current)
    sourceRef.current = null
    setCapturedImage(null)
  }, [])

  useEffect(() => () => {
    operationRef.current++
    stopStream()
    releaseSource(sourceRef.current)
    sourceRef.current = null
  }, [stopStream])

  useEffect(() => () => {
    if (capturedImage?.startsWith('blob:')) URL.revokeObjectURL(capturedImage)
  }, [capturedImage])

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

  function handleCapture() {
    const video = videoRef.current
    const frame = frameRef.current
    if (busyRef.current || cameraState !== 'live' || !video || !frame || !videoReady) return

    try {
      const guideRect = computeGuideFractionInVideo(video, frame.getBoundingClientRect(), video.getBoundingClientRect())
      const snapshot = captureVideoFrame(video)
      clearCapture()
      sourceRef.current = snapshot
      setCropRect(guideRect)
      setCapturedImage(snapshot.toDataURL('image/jpeg', 0.92))
      setErrorMessage(null)
      setCameraState('cropping')
      stopStream()
    } catch {
      setErrorMessage('Şəkil çəkilə bilmədi. Yenidən cəhd edin.')
    }
  }

  async function handleRead() {
    const source = sourceRef.current
    if (busyRef.current || cameraState !== 'cropping' || !source) return

    busyRef.current = true
    const operation = ++operationRef.current
    setCameraState('scanning')
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (operation !== operationRef.current) return
      const result = await scanIdCardImage(source, cropRect)
      if (operation !== operationRef.current) return
      clearCapture()
      onScanned(result)
    } catch {
      if (operation === operationRef.current) {
        setErrorMessage('Şəkil oxunarkən xəta baş verdi. Yenidən cəhd edin.')
        setCameraState('cropping')
      }
    } finally {
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
    clearCapture()
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
  }, [clearCapture, stopStream])

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
    setErrorMessage(null)
    stopStream()
    try {
      const bitmap = await createImageBitmap(file)
      if (operation !== operationRef.current) {
        bitmap.close()
        return
      }
      clearCapture()
      sourceRef.current = bitmap
      setCropRect(DEFAULT_CROP)
      setCapturedImage(URL.createObjectURL(file))
      setCameraState('cropping')
    } catch {
      if (operation === operationRef.current) {
        setCameraState('error')
        setErrorMessage('Şəkil açılmadı. Başqa şəkil seçin.')
      }
    } finally {
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
        ) : (cameraState === 'cropping' || cameraState === 'scanning') && capturedImage ? (
          <div className={cameraState === 'scanning' ? 'scanner-crop scanner-crop-busy' : 'scanner-crop'}>
            <CardCropper imageUrl={capturedImage} rect={cropRect} onChange={setCropRect} />
            {cameraState === 'cropping' && errorMessage && <p className="scanner-error">{errorMessage}</p>}
          </div>
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

        {cameraState === 'cropping' && (
          <>
            <button type="button" className="btn btn-secondary" onClick={handleStartCamera}>
              Yenidən çək
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRead}>
              Oxu
            </button>
          </>
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

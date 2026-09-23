import { useCallback, useState } from 'react'
import { createWorker } from 'tesseract.js'
import CameraScanner from './components/CameraScanner'
import ResultModal from './components/ResultModal'
import { parseIdCard, type ParsedIdCard } from './utils/parseIdCard'
import './App.css'

type Stage = 'idle' | 'scanning' | 'result'

function App() {
  const [stage, setStage] = useState<Stage>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedIdCard | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  const runOcr = useCallback(async (imageDataUrl: string) => {
    setIsProcessing(true)
    setParsed(null)
    setOcrError(null)
    try {
      const worker = await createWorker('aze+eng')
      const { data } = await worker.recognize(imageDataUrl)
      await worker.terminate()
      setParsed(parseIdCard(data.text))
    } catch (err) {
      console.error('OCR failed', err)
      setOcrError(err instanceof Error ? err.message : 'Mətn tanınarkən xəta baş verdi')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  function handleCapture(imageDataUrl: string) {
    setCapturedImage(imageDataUrl)
    setStage('result')
    void runOcr(imageDataUrl)
  }

  function handleClose() {
    setStage('idle')
    setCapturedImage(null)
    setParsed(null)
    setOcrError(null)
  }

  function handleRetry() {
    setCapturedImage(null)
    setParsed(null)
    setOcrError(null)
    setStage('scanning')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Şəxsiyyət Vəsiqəsi Skaneri</h1>
        <p>Vəsiqəni kamera ilə çəkin, məlumatlar avtomatik oxunsun</p>
      </header>

      <main className="app-main">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setStage('scanning')}>
          Şəxsiyyət vəsiqəsini skan et
        </button>
      </main>

      {stage === 'scanning' && <CameraScanner onCapture={handleCapture} onClose={() => setStage('idle')} />}

      {stage === 'result' && capturedImage && (
        <ResultModal
          imageDataUrl={capturedImage}
          parsed={parsed}
          isProcessing={isProcessing}
          ocrError={ocrError}
          onClose={handleClose}
          onRetry={handleRetry}
        />
      )}
    </div>
  )
}

export default App

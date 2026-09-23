import { useState } from 'react'
import CameraScanner from './components/CameraScanner'
import ResultModal from './components/ResultModal'
import type { ScanIdCardResult } from './utils/scanIdCard'
import './App.css'

type Stage = 'idle' | 'scanning' | 'result'

interface ConfirmedValues {
  fin: string
  serial: string
}

function App() {
  const [stage, setStage] = useState<Stage>('idle')
  const [scanResult, setScanResult] = useState<ScanIdCardResult | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedValues | null>(null)

  function handleScanned(result: ScanIdCardResult) {
    setScanResult(result)
    setStage('result')
  }

  function handleClose() {
    setStage('idle')
    setScanResult(null)
  }

  function handleRetry() {
    setScanResult(null)
    setStage('scanning')
  }

  function handleConfirm(values: ConfirmedValues) {
    setConfirmed(values)
    setScanResult(null)
    setStage('idle')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Şəxsiyyət Vəsiqəsi Skaneri</h1>
        <p>Vəsiqəni kamera ilə çəkin, FİN və seriya nömrəsi avtomatik oxunsun</p>
      </header>

      <main className="app-main">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => {
            setConfirmed(null)
            setStage('scanning')
          }}
        >
          Şəxsiyyət vəsiqəsini skan et
        </button>

        {confirmed && (
          <dl className="confirmed-summary">
            <div className="modal-field">
              <dt>FİN</dt>
              <dd>{confirmed.fin}</dd>
            </div>
            <div className="modal-field">
              <dt>Seriya nömrə</dt>
              <dd>{confirmed.serial}</dd>
            </div>
          </dl>
        )}
      </main>

      {stage === 'scanning' && <CameraScanner onScanned={handleScanned} onClose={() => setStage('idle')} />}

      {stage === 'result' && scanResult && (
        <ResultModal result={scanResult} onRetry={handleRetry} onConfirm={handleConfirm} onClose={handleClose} />
      )}
    </div>
  )
}

export default App

import type { ParsedIdCard } from '../utils/parseIdCard'

interface ResultModalProps {
  imageDataUrl: string
  parsed: ParsedIdCard | null
  isProcessing: boolean
  ocrError: string | null
  onClose: () => void
  onRetry: () => void
}

const FIELDS: Array<{ key: keyof Omit<ParsedIdCard, 'raw'>; label: string }> = [
  { key: 'adi', label: 'Adı' },
  { key: 'soyadi', label: 'Soyadı' },
  { key: 'fin', label: 'FİN' },
  { key: 'seriyaNomre', label: 'Seriya nömrə' },
  { key: 'dogumTarixi', label: 'Doğum tarixi' },
]

function ResultModal({ imageDataUrl, parsed, isProcessing, ocrError, onClose, onRetry }: ResultModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Bağla">
          ×
        </button>

        <h2>Skan nəticəsi</h2>

        <img src={imageDataUrl} alt="Çəkilmiş şəxsiyyət vəsiqəsi" className="modal-preview" />

        {isProcessing ? (
          <p className="modal-status">Mətn tanınır, gözləyin...</p>
        ) : ocrError ? (
          <p className="modal-status modal-status-error">{ocrError}</p>
        ) : (
          <>
            <dl className="modal-fields">
              {FIELDS.map(({ key, label }) => (
                <div key={key} className="modal-field">
                  <dt>{label}</dt>
                  <dd>{parsed?.[key] ?? '—'}</dd>
                </div>
              ))}
            </dl>

            {parsed?.raw && (
              <details className="modal-raw">
                <summary>Tanınan tam mətn</summary>
                <pre>{parsed.raw}</pre>
              </details>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Yenidən çək
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultModal

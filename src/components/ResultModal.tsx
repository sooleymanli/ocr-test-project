import { useState } from 'react'
import { FIN_REGEX, SERIAL_NUMBER_REGEX } from '../utils/validators'
import type { ScanIdCardResult } from '../utils/scanIdCard'

interface ResultModalProps {
  result: ScanIdCardResult
  onRetry: () => void
  onConfirm: (values: { fin: string; serial: string }) => void
  onClose: () => void
  onCalibrate?: (imageUrl: string) => void
}

function ResultModal({ result, onRetry, onConfirm, onClose, onCalibrate }: ResultModalProps) {
  const [fin, setFin] = useState(result.fin.value ?? '')
  const [serial, setSerial] = useState(result.serial.value ?? '')

  const finValid = FIN_REGEX.test(fin)
  const serialValid = SERIAL_NUMBER_REGEX.test(serial)
  const anyUncertain = !result.fin.confident || !result.serial.confident

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Bağla">
          ×
        </button>

        <h2>Skan nəticəsi</h2>

        <img src={result.previewImage} alt="Çəkilmiş şəxsiyyət vəsiqəsi" className="modal-preview" />

        {anyUncertain && (
          <p className="modal-status modal-status-warning">
            Bəzi məlumatlar dəqiq oxunmadı. Zəhmət olmasa yoxlayın və ya yenidən çəkin.
          </p>
        )}

        <div className="modal-fields modal-fields-editable">
          <label className="modal-field-editable">
            <span>FİN {!result.fin.confident && <em className="modal-uncertain-tag">qeyri-dəqiq</em>}</span>
            <input
              value={fin}
              onChange={(e) => setFin(e.target.value.toUpperCase())}
              maxLength={7}
              className={finValid ? '' : 'input-invalid'}
              placeholder="0000000"
            />
          </label>

          <label className="modal-field-editable">
            <span>Seriya nömrə {!result.serial.confident && <em className="modal-uncertain-tag">qeyri-dəqiq</em>}</span>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value.toUpperCase())}
              maxLength={9}
              className={serialValid ? '' : 'input-invalid'}
              placeholder="AA0000000"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Yenidən çək
          </button>
          {onCalibrate && (
            <button type="button" className="btn btn-secondary" onClick={() => onCalibrate(result.previewImage)}>
              Bu şəkillə kalibrasiya et
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!finValid || !serialValid}
            onClick={() => onConfirm({ fin, serial })}
          >
            Təsdiqlə
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultModal

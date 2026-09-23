// Calibratable configuration for the Azerbaijani ID card scanner.
// All crop rectangles are fractions (0-1) of the normalized card canvas, so they
// can be re-tuned without touching the scanning logic.
import { IDENTITY_CARD_REGIONS, type CropRegion } from './identityCardRegions'

/** Standard ID-1 card aspect ratio (85.6mm x 53.98mm), normalized to a fixed pixel size for cropping. */
export const NORMALIZED_CARD_WIDTH = 1013
export const NORMALIZED_CARD_HEIGHT = 638

export type FractionalRect = CropRegion

/** Crop regions for each field, as fractions of the normalized card canvas. Tune via IdCardCalibrator. */
export const FIELD_CROP_REGIONS: Record<'fin' | 'serial', FractionalRect> = {
  serial: IDENTITY_CARD_REGIONS.serialNumber,
  fin: IDENTITY_CARD_REGIONS.fin,
}

/** Minimum OCR confidence (0-1) to trust a single reading. */
export const CONFIDENCE_THRESHOLD = 0.6

/** How many burst frames are captured and analyzed per scan attempt. */
export const BURST_FRAME_COUNT = 3

/** Delay between burst frames in milliseconds. */
export const BURST_FRAME_INTERVAL_MS = 180

/** A value is accepted only if the same normalized value appears in at least this many frames. */
export const REQUIRED_CONSENSUS_COUNT = 2

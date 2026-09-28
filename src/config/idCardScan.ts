// Calibratable configuration for the Azerbaijani ID card scanner.
// All crop rectangles are fractions (0-1) of the normalized card canvas, so they
// can be re-tuned without touching the scanning logic.
import { IDENTITY_CARD_REGIONS, type CropRegion } from './identityCardRegions'

/** Standard ID-1 card aspect ratio (85.6mm x 53.98mm), normalized to a fixed pixel size for cropping. */
export const NORMALIZED_CARD_WIDTH = 1013
export const NORMALIZED_CARD_HEIGHT = 638

export type FractionalRect = CropRegion

/** Crop regions for each field, as fractions of the normalized card canvas. Tune via IdCardCalibrator. */
export const FIELD_CROP_REGIONS = IDENTITY_CARD_REGIONS

/** Minimum OCR confidence (0-1) to trust a single reading. */
export const CONFIDENCE_THRESHOLD = 0.6

/** Field crops are enlarged before OCR; Tesseract is more accurate on taller glyphs. */
export const OCR_UPSCALE = 2

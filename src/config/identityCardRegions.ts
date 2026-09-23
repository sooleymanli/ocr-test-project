export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Normalized (0-1) crop rectangles for the Azerbaijani ID card fields, measured against
 * the reference card image (new-format "ŞƏXSİYYƏT VƏSİQƏSİ / IDENTITY CARD").
 * Calibrate further with `src/dev/IdCardCalibrator.tsx` against real captured photos.
 */
export const IDENTITY_CARD_REGIONS = {
  serialNumber: {
    x: 0.337,
    y: 0.688,
    width: 0.270,
    height: 0.088,
  },
  fin: {
    x: 0.620,
    y: 0.692,
    width: 0.222,
    height: 0.090,
  },
} satisfies Record<string, CropRegion>



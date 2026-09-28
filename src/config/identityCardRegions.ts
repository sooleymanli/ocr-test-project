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
  surname: {
    x: 0.337,
    y: 0.202,
    width: 0.357,
    height: 0.080,
  },
  givenName: {
    x: 0.335,
    y: 0.326,
    width: 0.360,
    height: 0.079,
  },
  patronymic: {
    x: 0.334,
    y: 0.453,
    width: 0.361,
    height: 0.075,
  },
  serial: {
    x: 0.337,
    y: 0.699,
    width: 0.284,
    height: 0.071,
  },
  fin: {
    x: 0.630,
    y: 0.696,
    width: 0.313,
    height: 0.078,
  },
} satisfies Record<string, CropRegion>
export type RegionKey = keyof typeof IDENTITY_CARD_REGIONS

export const REGION_LABELS: Record<RegionKey, string> = {
  surname: 'Soyad',
  givenName: 'Ad',
  patronymic: 'Ata adı',
  serial: 'Seriya',
  fin: 'FİN',
}




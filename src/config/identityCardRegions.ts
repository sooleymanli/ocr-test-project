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
    x: 0.349,
    y: 0.202,
    width: 0.357,
    height: 0.080,
  },
  givenName: {
    x: 0.348,
    y: 0.333,
    width: 0.360,
    height: 0.079,
  },
  patronymic: {
    x: 0.348,
    y: 0.450,
    width: 0.361,
    height: 0.075,
  },
  serial: {
    x: 0.351,
    y: 0.702,
    width: 0.248,
    height: 0.064,
  },
  fin: {
    x: 0.626,
    y: 0.701,
    width: 0.260,
    height: 0.067,
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




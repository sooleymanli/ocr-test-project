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
    x: 0.348,
    y: 0.155,
    width: 0.358,
    height: 0.133,
  },
  givenName: {
    x: 0.349,
    y: 0.293,
    width: 0.315,
    height: 0.109,
  },
  patronymic: {
    x: 0.347,
    y: 0.408,
    width: 0.366,
    height: 0.119,
  },
  serial: {
    x: 0.350,
    y: 0.687,
    width: 0.255,
    height: 0.096,
  },
  fin: {
    x: 0.630,
    y: 0.681,
    width: 0.343,
    height: 0.108,
  },
} satisfies Record<string, CropRegion>
export const INK_THRESHOLD = 0.45

export type RegionKey = keyof typeof IDENTITY_CARD_REGIONS

export const REGION_LABELS: Record<RegionKey, string> = {
  surname: 'Soyad',
  givenName: 'Ad',
  patronymic: 'Ata adı',
  serial: 'Seriya',
  fin: 'FİN',
}




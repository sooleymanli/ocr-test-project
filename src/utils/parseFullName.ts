const FIELD_LABEL =
  /(?<!\p{L})(?:ATAS[Iİ]N[Iİ]N AD[Iİ]|ATA AD[Iİ]|SOYAD[Iİ]|SURNAME|LAST NAME|GIVEN NAMES?|FIRST NAME|PATRONYMIC|FATHER'?S NAME|AD[Iİ])(?!\p{L})/giu

/** Cleans the OCR text of a single calibrated name line (surname, given name or patronymic). */
export function cleanNameField(text: string): string {
  return text
    .normalize('NFC')
    .replace(FIELD_LABEL, ' ')
    .replace(/[^\p{L}'’-]+/gu, ' ')
    .split(' ')
    .filter((word) => word.replace(/['’-]/g, '').length >= 2)
    .join(' ')
    .toLocaleUpperCase('az-AZ')
}
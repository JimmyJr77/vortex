import { normalizePhoneNumber, PHONE_FORMAT_ERROR, PHONE_NUMBER_PATTERN } from '../../backend/phoneNumbers.js'

/** Format a complete number or add separators as its digits are entered. */
export function formatPhoneNumber(value: string): string {
  const complete = normalizePhoneNumber(value)
  if (complete) return complete

  // Keep unsupported entries editable and visibly invalid. Truncating them
  // could turn a mistyped or international number into a different contact.
  if (!/^[0-9().\s-]*$/.test(value)) return value
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Strip separators at boundaries that need digits, such as SMS setup. */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Format stored numbers without changing unsupported legacy contact details. */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  return normalizePhoneNumber(phone) ?? phone?.trim() ?? ''
}

export function isCompletePhoneNumber(value: string): boolean {
  return normalizePhoneNumber(value) !== null
}

export { PHONE_FORMAT_ERROR }
export const PHONE_INPUT_PATTERN = PHONE_NUMBER_PATTERN
export const PHONE_INPUT_PLACEHOLDER = '###-###-####'

/** US phone input mask: xxx-xxx-xxxx (10 digits). */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Strip non-digits for API payloads. */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Format stored phone values for controlled inputs. */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  return formatPhoneNumber(phone)
}

export const PHONE_INPUT_MAX_LENGTH = 12

export const PHONE_INPUT_PLACEHOLDER = '###-###-####'

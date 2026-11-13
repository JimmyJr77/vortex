export const PHONE_NUMBER_PATTERN = '[0-9]{3}-[0-9]{3}-[0-9]{4}'
export const PHONE_FORMAT_ERROR = 'Enter a 10-digit phone number (###-###-####).'

const phoneCharacters = /^\+?[0-9().\s-]+$/

/** Return the local ten digits of a complete North American phone number. */
export function getPhoneDigits(value) {
  if (typeof value !== 'string') return null
  const phone = value.trim()
  if (!phoneCharacters.test(phone)) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 && !phone.startsWith('+') ? digits : null
}

export function normalizePhoneNumber(value) {
  const digits = getPhoneDigits(value)
  return digits ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null
}

export function normalizeOptionalPhoneNumber(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null
  const phone = normalizePhoneNumber(value)
  if (phone) return phone
  throw Object.assign(new TypeError(PHONE_FORMAT_ERROR), { status: 400, statusCode: 400 })
}

/** Preserve an unchanged legacy phone. New values must always be valid. */
export function normalizeUpdatedPhoneNumber(value, current) {
  if (value === undefined) return current
  if (typeof value === 'string' && typeof current === 'string' && value.trim() && value.trim() === current.trim()) {
    return normalizePhoneNumber(value) ?? current
  }
  return normalizeOptionalPhoneNumber(value)
}

/** A partial phone search must also work against numbers stored with separators. */
export function phoneSearchPattern(value) {
  const query = value.trim()
  if (!phoneCharacters.test(query)) return null
  const digits = getPhoneDigits(query) ?? query.replace(/\D/g, '')
  return digits.length >= 3 ? `%${digits}%` : null
}

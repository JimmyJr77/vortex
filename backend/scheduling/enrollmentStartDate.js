const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeEnrollmentStartDate(value) {
  const date = String(value ?? '').trim()
  if (!DATE_ONLY_RE.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null
  return date
}

export function requireEnrollmentStartDate(value) {
  const date = normalizeEnrollmentStartDate(value)
  if (!date) {
    const error = new Error('Enrollment start date is required.')
    error.code = 'ENROLLMENT_START_DATE_REQUIRED'
    throw error
  }
  return date
}

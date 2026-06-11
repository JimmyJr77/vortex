/**
 * Date utility functions for handling date-only values (DOB, event dates, etc.)
 * These functions treat dates as calendar dates without timezone conversion
 */

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/

/** True when value is safe for `<input type="date">`. */
export function isValidDateInputValue(value: string | null | undefined): value is string {
  return Boolean(value && DATE_INPUT_RE.test(value))
}

/** Safe value for `<input type="date">` — never returns NaN or other invalid strings. */
export function dateInputValue(date: string | null | undefined): string {
  const formatted = formatDateForInput(date)
  return isValidDateInputValue(formatted) ? formatted : ''
}

function toLocalDateParts(date: Date): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function formatLocalDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Legacy API strings like "Wed Jul 01" / "Tue Sep 01" (no year). */
function parseWeekdayMonthDayString(dateString: string): Date | null {
  const match = dateString.trim().match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})$/)
  if (!match) return null

  const [, monthName, dayStr] = match
  const day = Number(dayStr)
  if (!Number.isFinite(day)) return null

  const now = new Date()
  let year = now.getFullYear()
  let candidate = new Date(`${monthName} ${day}, ${year}`)
  if (Number.isNaN(candidate.getTime())) return null

  // Prefer the nearest upcoming occurrence for scheduling-style dates.
  const daysAgo = (now.getTime() - candidate.getTime()) / 86_400_000
  if (daysAgo > 45) {
    const nextYearCandidate = new Date(`${monthName} ${day}, ${year + 1}`)
    if (!Number.isNaN(nextYearCandidate.getTime())) {
      candidate = nextYearCandidate
    }
  }

  return new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate())
}

/**
 * Parse a date-only string (YYYY-MM-DD) as a local date, not UTC
 * This prevents the "off by one day" issue when displaying dates
 */
export function parseDateOnly(dateString: string | null | undefined): Date | null {
  if (!dateString) return null

  const trimmed = String(dateString).trim()
  if (!trimmed || trimmed.includes('NaN')) return null

  // If already in YYYY-MM-DD format, parse as local date
  if (DATE_INPUT_RE.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const weekdayParsed = parseWeekdayMonthDayString(trimmed)
  if (weekdayParsed) return weekdayParsed

  // Try to parse other formats
  try {
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) return null

    // ISO datetime only (not weekday strings like "Tue Sep 01")
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const [year, month, day] = trimmed.split('T')[0].split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    // For other formats, use the date but extract year/month/day to avoid timezone issues
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  } catch {
    return null
  }
}

/**
 * Format a date-only string for HTML date input (YYYY-MM-DD)
 * Always returns YYYY-MM-DD format regardless of input format
 */
export function formatDateForInput(date: string | null | undefined): string {
  if (!date) return ''

  const trimmed = String(date).trim()
  if (!trimmed || trimmed.includes('NaN')) return ''
  if (DATE_INPUT_RE.test(trimmed)) return trimmed

  const parsed = parseDateOnly(trimmed)
  const parts = parsed ? toLocalDateParts(parsed) : null
  if (!parts) return ''

  const result = formatLocalDateParts(parts)
  return DATE_INPUT_RE.test(result) ? result : ''
}

/**
 * Format a date-only string for display (locale-aware)
 * Treats the date as a calendar date, not a timestamp
 */
export function formatDateForDisplay(date: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return ''
  
  const parsed = parseDateOnly(date)
  if (!parsed) return ''
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  
  return parsed.toLocaleDateString('en-US', { ...defaultOptions, ...options })
}

/**
 * Format a date-only string for short display (e.g., "Mar 15, 2024")
 */
export function formatDateShort(date: string | null | undefined): string {
  return formatDateForDisplay(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Calculate age from date of birth (date-only string)
 * Handles timezone correctly by treating DOB as a calendar date
 */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  
  const birthDate = parseDateOnly(dateOfBirth)
  if (!birthDate) return null
  
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

/**
 * Check if a date-only value represents an adult (18+ years old)
 */
export function isAdult(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return true // No DOB = assume adult
  
  const age = calculateAge(dateOfBirth)
  return age === null || age >= 18
}

/**
 * Format a timestamp (with time) for display
 * Use this for created_at, updated_at, etc. that have time components
 */
export function formatTimestamp(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return ''
  
  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return ''
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }
  
  return dateObj.toLocaleString('en-US', { ...defaultOptions, ...options })
}

/**
 * Format a timestamp for short display (date only, no time)
 */
export function formatTimestampDate(date: string | Date | null | undefined): string {
  return formatTimestamp(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Get today's date as YYYY-MM-DD string (for date inputs)
 */
export function getTodayDateString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


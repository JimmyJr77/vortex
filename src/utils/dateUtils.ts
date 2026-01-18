/**
 * Date utility functions for handling date-only values (DOB, event dates, etc.)
 * These functions treat dates as calendar dates without timezone conversion
 */

/**
 * Parse a date-only string (YYYY-MM-DD) as a local date, not UTC
 * This prevents the "off by one day" issue when displaying dates
 */
export function parseDateOnly(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  
  // If already in YYYY-MM-DD format, parse as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  
  // Try to parse other formats
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    // If it's an ISO string with time, extract just the date part and parse as local
    if (dateString.includes('T')) {
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
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
  
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  
  // Parse as local date to avoid timezone issues
  const parsed = parseDateOnly(date)
  if (!parsed) return ''
  
  // Format as YYYY-MM-DD
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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


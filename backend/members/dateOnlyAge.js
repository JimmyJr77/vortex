const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/

function daysInMonth(year, month) {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return leapYear ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function calendarDateParts(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    }
  }

  const match = DATE_ONLY_PATTERN.exec(String(value || '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

export function isValidCalendarDate(value) {
  return calendarDateParts(value) != null
}

export function calendarDateInTimeZone(timeZone, nowEpochMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(nowEpochMs)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isAdultOnDate(dateOfBirth, todayDate) {
  const birth = calendarDateParts(dateOfBirth)
  const today = calendarDateParts(todayDate)
  if (!birth || !today) return false

  const cutoffYear = today.year - 18
  if (birth.year !== cutoffYear) return birth.year < cutoffYear
  if (birth.month !== today.month) return birth.month < today.month
  return birth.day <= today.day
}

export function isAdultInTimeZone(dateOfBirth, timeZone, nowEpochMs = Date.now()) {
  return isAdultOnDate(
    dateOfBirth,
    calendarDateInTimeZone(timeZone, nowEpochMs),
  )
}

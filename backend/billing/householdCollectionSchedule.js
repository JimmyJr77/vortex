export const DEFAULT_COLLECTION_DAY = 1

export function validCollectionDay(day) {
  return Number.isInteger(day) && day >= 1 && day <= 31
}

// Days 29–31 fall on the last day of a shorter month. Dates are facility-local
// calendar dates, so no timezone conversion belongs in the month arithmetic.
export function householdCollectionDate(month, collectionDay = DEFAULT_COLLECTION_DAY) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month.slice(0, 7)}-${String(Math.min(collectionDay, lastDay)).padStart(2, '0')}`
}

export function householdCollectionWindow(date, collectionDay = DEFAULT_COLLECTION_DAY) {
  if (date === householdCollectionDate(date, collectionDay)) return 'primary'
  if (collectionDay === DEFAULT_COLLECTION_DAY && date.endsWith('-04')) return 'default_retry'
  return null
}

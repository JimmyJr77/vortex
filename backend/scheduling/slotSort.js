/** Monday-first day order (JS getDay: 0 = Sun … 6 = Sat). */
export const MONDAY_FIRST_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function daySortIndex(dayOfWeek) {
  if (dayOfWeek == null || dayOfWeek === '') return 99
  const n = Number(dayOfWeek)
  const idx = MONDAY_FIRST_DAY_ORDER.indexOf(n)
  return idx >= 0 ? idx : 99
}

export function normalizeDateKey(value) {
  if (value == null || value === '') return null
  const s = String(value).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Active start for sort — TBD last; missing explicit start sorts before dated rows. */
export function activeStartSortKey(activeStart, datesTbd = false) {
  if (datesTbd) return '\uffff'
  const key = normalizeDateKey(activeStart)
  return key ?? '\u0000'
}

function weekLetterKey(letter) {
  const s = String(letter ?? '').trim()
  return s || '\u0000'
}

function startTimeKey(time) {
  if (!time) return '99:99'
  return String(time).slice(0, 5)
}

export function compareOccurrenceRows(a, b) {
  const wa = weekLetterKey(a.weekLetter ?? a.week_letter)
  const wb = weekLetterKey(b.weekLetter ?? b.week_letter)
  if (wa !== wb) return wa.localeCompare(wb)

  const modeA = a.scheduleMode ?? a.schedule_mode ?? 'day'
  const modeB = b.scheduleMode ?? b.schedule_mode ?? 'day'

  if (modeA === 'date' || modeB === 'date') {
    const da = normalizeDateKey(a.specificDate ?? a.specific_date) ?? '9999-99-99'
    const db = normalizeDateKey(b.specificDate ?? b.specific_date) ?? '9999-99-99'
    if (da !== db) return da.localeCompare(db)
  } else {
    const dayDiff =
      daySortIndex(a.dayOfWeek ?? a.day_of_week) - daySortIndex(b.dayOfWeek ?? b.day_of_week)
    if (dayDiff !== 0) return dayDiff
  }

  const stA = startTimeKey(a.startTime ?? a.start_time)
  const stB = startTimeKey(b.startTime ?? b.start_time)
  if (stA !== stB) return stA.localeCompare(stB)

  return Number(a.id ?? 0) - Number(b.id ?? 0)
}

export function sortOccurrenceRows(rows) {
  return [...(rows || [])].sort(compareOccurrenceRows)
}

/** Distinct week letters on day-mode slots (defaults missing letter to A). */
export function uniqueWeekLettersFromRows(rows) {
  const letters = new Set()
  for (const row of rows || []) {
    const mode = row.scheduleMode ?? row.schedule_mode ?? 'day'
    if (mode === 'date') continue
    const letter = String(row.weekLetter ?? row.week_letter ?? 'A').trim() || 'A'
    letters.add(letter)
  }
  return [...letters].sort()
}

/** True when day-mode slots use more than one week letter (e.g. A and B). */
export function rowsHaveMultipleWeekLetters(rows) {
  return uniqueWeekLettersFromRows(rows).length > 1
}

function primaryOccurrence(group) {
  const occs = group.occurrences ?? group._occurrenceRows ?? []
  if (!occs.length) return null
  return sortOccurrenceRows(occs)[0]
}

export function compareSlotGroups(a, b) {
  const activeA = activeStartSortKey(
    a.activeStart ?? a.active_start,
    a.datesTbd ?? a.dates_tbd,
  )
  const activeB = activeStartSortKey(
    b.activeStart ?? b.active_start,
    b.datesTbd ?? b.dates_tbd,
  )
  if (activeA !== activeB) return activeA.localeCompare(activeB)

  const offeringA = Number(a.offeringId ?? a.offering_id ?? 0)
  const offeringB = Number(b.offeringId ?? b.offering_id ?? 0)
  if (offeringA !== offeringB) return offeringA - offeringB

  const pa = primaryOccurrence(a)
  const pb = primaryOccurrence(b)
  if (pa && pb) {
    const occCmp = compareOccurrenceRows(pa, pb)
    if (occCmp !== 0) return occCmp
  }

  return Number(a.id ?? 0) - Number(b.id ?? 0)
}

export function sortSlotGroups(groups) {
  return [...(groups || [])].sort(compareSlotGroups)
}

export function weekBucketKey(group) {
  if ((group.scheduleMode ?? group.schedule_mode ?? 'day') === 'date') return '__dates__'
  const occ = primaryOccurrence(group)
  const letter = occ?.weekLetter ?? occ?.week_letter ?? 'A'
  return String(letter || 'A')
}

export function compareWeekBucketKeys(a, b) {
  if (a === '__dates__' && b !== '__dates__') return 1
  if (b === '__dates__' && a !== '__dates__') return -1
  return a.localeCompare(b)
}

export function groupSlotGroupsByWeek(groups) {
  const sorted = sortSlotGroups(groups)
  const map = new Map()
  for (const group of sorted) {
    const key = weekBucketKey(group)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(group)
  }
  return [...map.entries()].sort(([a], [b]) => compareWeekBucketKeys(a, b))
}

export function weekBucketLabel(key, { multipleWeeks = false } = {}) {
  if (key === '__dates__') return 'Dates'
  if (!multipleWeeks) return 'Schedule'
  return `${key}-Week`
}

export function resolveActiveDatesForSort(slot, form) {
  if (slot.dates_tbd || slot.datesTbd) {
    return { activeStart: null, datesTbd: true }
  }
  const activeStart =
    normalizeDateKey(slot.active_start ?? slot.activeStart) ??
    normalizeDateKey(slot.start_date ?? slot.startDate) ??
    normalizeDateKey(form?.start_date ?? form?.startDate) ??
    null
  return { activeStart, datesTbd: false }
}

export function compareScheduleCatalogOptions(a, b) {
  const offeringA = normalizeDateKey(a.offeringStartDate) ?? '\u0000'
  const offeringB = normalizeDateKey(b.offeringStartDate) ?? '\u0000'
  if (offeringA !== offeringB) return offeringA.localeCompare(offeringB)

  const activeA = activeStartSortKey(a.activeStart, a.datesTbd)
  const activeB = activeStartSortKey(b.activeStart, b.datesTbd)
  if (activeA !== activeB) return activeA.localeCompare(activeB)

  const modeA = a.scheduleMode ?? 'day'
  const modeB = b.scheduleMode ?? 'day'
  if (modeA === 'date' || modeB === 'date') {
    const da = normalizeDateKey(a.specificDate) ?? '9999-99-99'
    const db = normalizeDateKey(b.specificDate) ?? '9999-99-99'
    if (da !== db) return da.localeCompare(db)
  } else {
    const dayA = a.daySort ?? 99
    const dayB = b.daySort ?? 99
    if (dayA !== dayB) return dayA - dayB
  }

  const stA = startTimeKey(a.startTime)
  const stB = startTimeKey(b.startTime)
  if (stA !== stB) return stA.localeCompare(stB)

  return Number(a.slotGroupId) - Number(b.slotGroupId)
}

export function sortScheduleCatalogOptions(options) {
  return [...(options || [])].sort(compareScheduleCatalogOptions)
}

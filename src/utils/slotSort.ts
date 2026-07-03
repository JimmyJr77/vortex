import type { SchedulingSlotGroup, SchedulingTimeSlot } from './schedulingApi'

/** Monday-first day order (JS getDay: 0 = Sun … 6 = Sat). */
export const MONDAY_FIRST_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function daySortIndex(dayOfWeek: number | null | undefined): number {
  if (dayOfWeek == null) return 99
  const idx = MONDAY_FIRST_DAY_ORDER.indexOf(dayOfWeek)
  return idx >= 0 ? idx : 99
}

export function normalizeDateKey(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  const s = String(value).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function activeStartSortKey(
  activeStart: string | null | undefined,
  datesTbd = false,
): string {
  if (datesTbd) return '\uffff'
  const key = normalizeDateKey(activeStart)
  return key ?? '\u0000'
}

type OccurrenceLike = Pick<
  SchedulingTimeSlot,
  'id' | 'scheduleMode' | 'weekLetter' | 'dayOfWeek' | 'specificDate' | 'startTime'
>

function weekLetterKey(letter: string | null | undefined): string {
  const s = String(letter ?? '').trim()
  return s || '\u0000'
}

function startTimeKey(time: string | null | undefined): string {
  if (!time) return '99:99'
  return String(time).slice(0, 5)
}

export function compareOccurrences(a: OccurrenceLike, b: OccurrenceLike): number {
  const wa = weekLetterKey(a.weekLetter)
  const wb = weekLetterKey(b.weekLetter)
  if (wa !== wb) return wa.localeCompare(wb)

  if (a.scheduleMode === 'date' || b.scheduleMode === 'date') {
    const da = normalizeDateKey(a.specificDate) ?? '9999-99-99'
    const db = normalizeDateKey(b.specificDate) ?? '9999-99-99'
    if (da !== db) return da.localeCompare(db)
  } else {
    const dayDiff = daySortIndex(a.dayOfWeek) - daySortIndex(b.dayOfWeek)
    if (dayDiff !== 0) return dayDiff
  }

  const stA = startTimeKey(a.startTime)
  const stB = startTimeKey(b.startTime)
  if (stA !== stB) return stA.localeCompare(stB)

  return a.id - b.id
}

export function sortOccurrences<T extends OccurrenceLike>(rows: T[]): T[] {
  return [...rows].sort(compareOccurrences)
}

function primaryOccurrence(group: SchedulingSlotGroup): OccurrenceLike | null {
  if (!group.occurrences.length) return null
  return sortOccurrences(group.occurrences)[0]
}

export function compareSlotGroups(a: SchedulingSlotGroup, b: SchedulingSlotGroup): number {
  const activeA = activeStartSortKey(a.activeStart, a.datesTbd)
  const activeB = activeStartSortKey(b.activeStart, b.datesTbd)
  if (activeA !== activeB) return activeA.localeCompare(activeB)

  const offeringA = a.offeringId ?? 0
  const offeringB = b.offeringId ?? 0
  if (offeringA !== offeringB) return offeringA - offeringB

  const pa = primaryOccurrence(a)
  const pb = primaryOccurrence(b)
  if (pa && pb) {
    const occCmp = compareOccurrences(pa, pb)
    if (occCmp !== 0) return occCmp
  }

  return a.id - b.id
}

export function sortSlotGroups(groups: SchedulingSlotGroup[]): SchedulingSlotGroup[] {
  return [...groups].sort(compareSlotGroups)
}

export function weekBucketKey(group: SchedulingSlotGroup): string {
  if (group.scheduleMode === 'date') return '__dates__'
  const occ = primaryOccurrence(group)
  return String(occ?.weekLetter || 'A')
}

export function compareWeekBucketKeys(a: string, b: string): number {
  if (a === '__dates__' && b !== '__dates__') return 1
  if (b === '__dates__' && a !== '__dates__') return -1
  return a.localeCompare(b)
}

export function groupSlotGroupsByWeek(
  groups: SchedulingSlotGroup[],
): Array<[string, SchedulingSlotGroup[]]> {
  const sorted = sortSlotGroups(groups)
  const map = new Map<string, SchedulingSlotGroup[]>()
  for (const group of sorted) {
    const key = weekBucketKey(group)
    const list = map.get(key) ?? []
    list.push(group)
    map.set(key, list)
  }
  return [...map.entries()].sort(([a], [b]) => compareWeekBucketKeys(a, b))
}

export function weekBucketLabel(key: string, options?: { multipleWeeks?: boolean }): string {
  if (key === '__dates__') return 'Dates'
  if (options?.multipleWeeks !== true) return 'Schedule'
  return `${key}-Week`
}

export interface ScheduleOptionSortable {
  offeringId?: number | null
  offeringStartDate?: string | null
  activeStart?: string | null
  datesTbd?: boolean
  scheduleMode?: 'day' | 'date'
  specificDate?: string | null
  daySort?: number
  startTime?: string | null
  slotGroupId: number
}

export function compareScheduleOptions(a: ScheduleOptionSortable, b: ScheduleOptionSortable): number {
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

  return a.slotGroupId - b.slotGroupId
}

export function sortScheduleOptions<T extends ScheduleOptionSortable>(options: T[]): T[] {
  return [...options].sort(compareScheduleOptions)
}

import type { PublicAdultBooking, PublicBookingSnapshot, PublicWeeklyClassTime, PublicYouthBooking } from '../src/config/publicBookingSnapshot'
import {
  ADULT_BOOKING_PROGRAM, DEVELOPMENTAL_GYMNASTICS_CATALOG_NAMES, FIT_AND_FLIP_BOOKING_PROGRAM, PUBLIC_API_ORIGIN,
} from '../src/config/publicCatalog'
import { publicEnrollmentPricingOptions, type ProgramPricingOption } from '../src/utils/programPricingOptions'
import { programUsesWeeklyTierPricing } from '../src/utils/weeklyTierPricing'

type CatalogClass = {
  id: number
  displayName: string
  ageMin: number | null
  skillLevel?: string | null
  formId: number | null
  enrollVisible?: boolean
  excludeFromDropIns?: boolean
}

type CatalogProgram = {
  id: number
  displayName: string
  classes: CatalogClass[]
  pricingCostOptions?: ProgramPricingOption[]
  excludeFromDropIns?: boolean
}

type DropInSession = {
  programId: number
  classId: number
  formId: number
  date: string
  startTime: string
  endTime: string
  totalCents: number
  maxParticipants?: number | null
  excludedFromDropIns?: boolean
  allowsFreeTrial?: boolean
  isFull: boolean
}

type SignupClassCatalog = {
  formId: number
  costUnit: string | null
  scheduleOptions: {
    scheduleMode?: string
    datesTbd?: boolean
    priceCents: number | null
    scheduleLabel?: string
    activeStart?: string | null
    offeringStartDate?: string | null
  }[]
}

const easternCalendarDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' })
const isoDate = /^\d{4}-\d{2}-\d{2}$/
const timeOfDay = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayTimeLabel = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) · (\d{2}:\d{2})–(\d{2}:\d{2})$/
const skillOrder = ['early stage', 'beginner', 'intermediate', 'advanced']

function validDate(date: string) {
  const stamp = Date.parse(date)
  return isoDate.test(date) && Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date
}

function validPrice(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isSafeInteger(cents) && cents > 0
}

function publishedClass(item: CatalogClass | null): item is CatalogClass & { formId: number } {
  return item?.enrollVisible === true && typeof item.formId === 'number' && Number.isSafeInteger(item.formId) &&
    Number.isSafeInteger(item.id) && typeof item.displayName === 'string' && item.displayName.trim().length > 0
}

async function readCatalog<T>(path: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, PUBLIC_API_ORIGIN), { signal, redirect: 'error' })
    if (!response.ok) return null
    const body = await response.json() as { success?: boolean; data?: T }
    return body.success === true ? body.data ?? null : null
  } catch {
    return null
  }
}

function readClassSchedule(classId: number, signal: AbortSignal) {
  return readCatalog<SignupClassCatalog>(`/api/signup/catalog/classes/${classId}/offerings?leadRegistration=1`, signal)
}

function datesForClass(sessions: DropInSession[], programId: number, classItem: CatalogClass, checkedOn: string) {
  return sessions.filter(session =>
    session?.programId === programId && session.classId === classItem.id && session.formId === classItem.formId &&
    !session.excludedFromDropIns && session.isFull === false && validDate(session.date) && session.date > checkedOn &&
    validPrice(session.totalCents) && timeOfDay.test(session.startTime) && timeOfDay.test(session.endTime) &&
    session.endTime > session.startTime,
  )
}

function consistentCapacity(sessions: DropInSession[]) {
  const capacity = sessions[0]?.maxParticipants
  return typeof capacity === 'number' && Number.isSafeInteger(capacity) && capacity > 0 &&
    sessions.every(session => session.maxParticipants === capacity) ? capacity : null
}

async function loadAdultBooking(program: CatalogProgram | undefined, dropIns: DropInSession[], checkedOn: string, signal: AbortSignal): Promise<PublicAdultBooking | null> {
  if (!program || !Number.isSafeInteger(program.id) || !Array.isArray(program.classes)) return null
  const adultClass = program.classes.filter(publishedClass).find(item => item.ageMin === 18 && /\btyphoons\b/i.test(item.displayName))
  if (!adultClass) return null

  const options = Array.isArray(program.pricingCostOptions) ? program.pricingCostOptions : []
  const activePrices = options.filter(option => option?.enabled === true && validPrice(option.amountCents))
  const flat = activePrices.length === 1 && activePrices[0].key === 'monthly_flat' ? activePrices[0].amountCents : null
  const recurring = await readClassSchedule(adultClass.id, signal)
  const currentOptions = existingSchedule(recurring, adultClass.formId, checkedOn)
  const recurringTimes = weeklyTimes(currentOptions)
  const monthlyTuitionCents = flat && recurring?.costUnit === 'per_month' &&
    currentOptions.some(option => option.priceCents === flat)
    ? flat : null

  const sessions = datesForClass(dropIns, program.id, adultClass, checkedOn)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

  const first = sessions[0]
  // Give a weekly range only when every published session in it has the same terms.
  const sameWeeklyListing = first && sessions.every((session, index) =>
    Date.parse(session.date) === Date.parse(first.date) + index * millisecondsPerWeek &&
    session.startTime === first.startTime && session.endTime === first.endTime &&
    session.totalCents === first.totalCents && session.allowsFreeTrial === first.allowsFreeTrial,
  )
  const dropIn = first ? {
    firstDate: first.date,
    lastDate: sameWeeklyListing ? sessions[sessions.length - 1].date : first.date,
    startTime: first.startTime,
    endTime: first.endTime,
    priceCents: first.totalCents,
    freeTrial: first.allowsFreeTrial === true,
    maxParticipants: consistentCapacity(sessions),
  } : null

  return recurringTimes.length || monthlyTuitionCents || dropIn ? { checkedOn, recurringTimes, monthlyTuitionCents, dropIn } : null
}

function priceRange(values: unknown[]): [number, number] | null {
  return values.length && values.every(validPrice) ? [Math.min(...values), Math.max(...values)] : null
}

function weeklyTimes(options: SignupClassCatalog['scheduleOptions']): PublicWeeklyClassTime[] {
  const slots = new Map<string, { days: Set<number>; startTime: string; endTime: string }>()
  for (const option of options) {
    const match = option.scheduleLabel?.match(dayTimeLabel)
    // Combined or alternating slots belong in the live schedule where their full terms are shown.
    if (!match) return []
    const [, day, startTime, endTime] = match
    if (!timeOfDay.test(startTime) || !timeOfDay.test(endTime) || startTime >= endTime) return []
    const key = `${startTime}-${endTime}`
    const slot = slots.get(key) ?? { days: new Set<number>(), startTime, endTime }
    slot.days.add(weekdays.indexOf(day))
    slots.set(key, slot)
  }
  return [...slots.values()].map(({ days, startTime, endTime }) => {
    const sorted = [...days].sort((a, b) => a - b)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const label = sorted.length >= 3 && last - first + 1 === sorted.length
      ? `${weekdays[first]}–${weekdays[last]}`
      : sorted.map(day => weekdays[day]).join(', ')
    return { days: label, startTime, endTime }
  })
}

function existingSchedule(catalog: SignupClassCatalog | null, formId: number, checkedOn: string) {
  if (catalog?.formId !== formId || !Array.isArray(catalog.scheduleOptions)) return []
  return catalog.scheduleOptions.filter(option =>
    option?.scheduleMode === 'day' && option.datesTbd === false &&
    (!option.activeStart || (validDate(option.activeStart) && option.activeStart <= checkedOn)) &&
    (!option.offeringStartDate || (validDate(option.offeringStartDate) && option.offeringStartDate <= checkedOn)),
  )
}

async function loadYouthBooking(program: CatalogProgram | undefined, dropIns: DropInSession[], checkedOn: string, signal: AbortSignal): Promise<PublicYouthBooking | null> {
  if (!program || !Number.isSafeInteger(program.id) || !Array.isArray(program.classes)) return null
  const pricingCostOptions = Array.isArray(program.pricingCostOptions) ? program.pricingCostOptions.filter(Boolean) : []
  const showTuition = !programUsesWeeklyTierPricing({ pricingCostOptions }) && !publicEnrollmentPricingOptions(pricingCostOptions).length
  const showDropInCapacity = program.displayName === FIT_AND_FLIP_BOOKING_PROGRAM
  const rank = (item: CatalogClass) => skillOrder.indexOf(item.skillLevel?.toLowerCase() ?? '')
  const classes = program.classes.filter(publishedClass).sort((left, right) =>
    (left.ageMin ?? Infinity) - (right.ageMin ?? Infinity) || rank(left) - rank(right) || left.displayName.localeCompare(right.displayName),
  )
  const rows = await Promise.allSettled(classes.map(async classItem => {
    const catalog = await readClassSchedule(classItem.id, signal)
    const options = existingSchedule(catalog, classItem.formId, checkedOn)
    const times = weeklyTimes(options)
    const monthlyTuition = showTuition && catalog?.costUnit === 'per_month' ? priceRange(options.map(option => option.priceCents)) : null
    const dropInExcluded = (classItem.excludeFromDropIns ?? program.excludeFromDropIns) === true
    const dropInDates = dropInExcluded ? [] : datesForClass(dropIns, program.id, classItem, checkedOn)
    const dropIn = priceRange(dropInDates.map(session => session.totalCents))
    const utcDays = new Set(dropInDates.map(({ date }) => new Date(date).getUTCDay()))
    const dropInDays = weekdays.filter((_, index) => utcDays.has((index + 1) % weekdays.length))
    const dropInCapacity = showDropInCapacity ? consistentCapacity(dropInDates) : null
    if (times.length === 0 && monthlyTuition === null && dropIn === null) return null
    return { formId: classItem.formId, name: classItem.displayName, times, monthlyTuition, dropIn, dropInDays, dropInCapacity, dropInExcluded }
  }))
  const verified = rows.flatMap(row => row.status === 'fulfilled' && row.value ? [row.value] : [])
  return verified.length ? { checkedOn, classes: verified } : null
}

export async function loadPublicBooking(): Promise<PublicBookingSnapshot | null> {
  const signal = AbortSignal.timeout(8000)
  const checkedOn = easternCalendarDate.format(new Date())
  const [catalog, dropIns] = await Promise.all([
    readCatalog<{ programs: CatalogProgram[] }>('/api/public/classes-offered', signal),
    readCatalog<{ sessions: DropInSession[] }>('/api/public/drop-ins', signal),
  ])
  if (!Array.isArray(catalog?.programs)) return null

  const findProgram = (names: readonly string[]) => catalog.programs.find(item => names.includes(item?.displayName))
  const sessions = Array.isArray(dropIns?.sessions) ? dropIns.sessions : []
  const [adult, gymnastics, fitAndFlip] = await Promise.all([
    loadAdultBooking(findProgram([ADULT_BOOKING_PROGRAM]), sessions, checkedOn, signal).catch(() => null),
    loadYouthBooking(findProgram(DEVELOPMENTAL_GYMNASTICS_CATALOG_NAMES), sessions, checkedOn, signal).catch(() => null),
    loadYouthBooking(findProgram([FIT_AND_FLIP_BOOKING_PROGRAM]), sessions, checkedOn, signal).catch(() => null),
  ])
  return adult || gymnastics || fitAndFlip
    ? { '/adult-gymnastics': adult, '/gymnastics': gymnastics, '/fit-and-flip': fitAndFlip } : null
}

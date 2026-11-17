import type { PublicAdultBooking } from '../src/config/publicAdultBooking'
import { ADULT_BOOKING_PROGRAM, PUBLIC_API_ORIGIN } from '../src/config/publicCatalog'

type CatalogProgram = {
  id: number
  displayName: string
  classes: { id: number; displayName: string; ageMin: number | null; formId: number | null; enrollVisible?: boolean }[]
  pricingCostOptions?: { key: string; enabled: boolean; amountCents: number }[]
}

type DropInSession = {
  programId: number
  classId: number
  formId: number
  date: string
  startTime: string
  endTime: string
  totalCents: number
  excludedFromDropIns?: boolean
  allowsFreeTrial?: boolean
  isFull: boolean
}

type SignupClassCatalog = {
  formId: number
  costUnit: string | null
  scheduleOptions: { scheduleMode?: string; datesTbd?: boolean; priceCents: number | null }[]
}

const easternCalendarDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' })
const isoDate = /^\d{4}-\d{2}-\d{2}$/
const timeOfDay = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000

function validDate(date: string) {
  const stamp = Date.parse(date)
  return isoDate.test(date) && Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date
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

export async function loadPublicAdultBooking(): Promise<PublicAdultBooking | null> {
  const signal = AbortSignal.timeout(6000)
  const checkedOn = easternCalendarDate.format(new Date())
  const [catalog, dropIns] = await Promise.all([
    readCatalog<{ programs: CatalogProgram[] }>('/api/public/classes-offered', signal),
    readCatalog<{ sessions: DropInSession[] }>('/api/public/drop-ins', signal),
  ])
  if (!Array.isArray(catalog?.programs)) return null
  const program = catalog.programs.find(item => item?.displayName === ADULT_BOOKING_PROGRAM)
  const adultClass = Array.isArray(program?.classes) && program.classes.find(item =>
    item?.enrollVisible === true && Number.isSafeInteger(item.formId) && Number.isSafeInteger(item.id) &&
    item.ageMin === 18 && /\btyphoons\b/i.test(item.displayName),
  )
  if (!program || !adultClass || !Number.isSafeInteger(program.id)) return null

  const options = Array.isArray(program.pricingCostOptions) ? program.pricingCostOptions : []
  const activePrices = options.filter(option => option?.enabled === true && Number.isSafeInteger(option.amountCents) && option.amountCents > 0)
  const flat = activePrices.length === 1 && activePrices[0].key === 'monthly_flat' ? activePrices[0].amountCents : null
  const recurring = flat && await readCatalog<SignupClassCatalog>(
    `/api/signup/catalog/classes/${adultClass.id}/offerings?leadRegistration=1`, signal,
  )
  const monthlyTuitionCents = recurring && recurring.formId === adultClass.formId && recurring.costUnit === 'per_month' &&
    Array.isArray(recurring.scheduleOptions) && recurring.scheduleOptions.some(option =>
      option?.scheduleMode === 'day' && option.datesTbd === false && option.priceCents === flat)
    ? flat : null

  const sessions = (Array.isArray(dropIns?.sessions) ? dropIns.sessions : []).filter(session =>
    session?.programId === program.id && session.classId === adultClass.id && session.formId === adultClass.formId &&
    !session.excludedFromDropIns && session.isFull === false && validDate(session.date) && session.date > checkedOn &&
    Number.isSafeInteger(session.totalCents) && session.totalCents > 0 &&
    timeOfDay.test(session.startTime) && timeOfDay.test(session.endTime) && session.endTime > session.startTime,
  ).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

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
  } : null

  return monthlyTuitionCents || dropIn ? { checkedOn, monthlyTuitionCents, dropIn } : null
}

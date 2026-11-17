import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../../utils/api'
import { fetchNonmemberDropIns } from '../../utils/dropInApi'
import { formatCents } from '../../utils/money'
import { ADULT_BOOKING_HREF, ADULT_DROP_IN_HREF, isAdultBookingProgram } from '../../utils/publicBookingPrograms'
import { fetchSignupClassCatalog } from '../signup/signupEnrollmentUtils'

export type RecurringPriceClass = {
  classId: number
  formId: number
  groups: { id: number; offeringId?: number | null }[]
}

function isPositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

async function fetchMonthlyTuition({ classId, formId, groups }: RecurringPriceClass, signal: AbortSignal) {
  const catalog = await fetchSignupClassCatalog(getApiUrl(), classId, signal)
  if (catalog.formId !== formId || catalog.costUnit !== 'per_month') return null
  const prices = groups.flatMap(group => {
    const options = catalog.scheduleOptions.filter(option =>
      option.scheduleMode === 'day' && !option.datesTbd && option.slotGroupId === group.id &&
      (option.offeringId ?? null) === (group.offeringId ?? null))
    return options.length ? options.map(({ priceCents }) => priceCents) : [null]
  })
  const [price] = prices
  return isPositivePrice(price) && prices.every(amount => amount === price) ? price : null
}

async function fetchDropInPrices(signal: AbortSignal) {
  const { sessions } = await fetchNonmemberDropIns(signal)
  return sessions.filter(session => isAdultBookingProgram(session.programName) &&
    !session.isFull && !session.excludedFromDropIns).map(session => session.totalCents).filter(isPositivePrice)
}

async function fetchMonthlyPrices(classes: readonly RecurringPriceClass[], signal: AbortSignal) {
  const prices = await Promise.all(classes.map(classItem => fetchMonthlyTuition(classItem, signal)))
  return prices.every(isPositivePrice) ? prices : []
}

function requestPrices(load: (signal: AbortSignal) => Promise<number[]>, publish: (prices: number[]) => void) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  let active = true
  void load(controller.signal).catch(() => []).then(prices => {
    if (active) publish(prices)
  }).finally(() => window.clearTimeout(timeout))
  return () => {
    active = false
    window.clearTimeout(timeout)
    controller.abort()
  }
}

function describePrices(prices: number[], unit: string, fallback: string) {
  if (!prices.length) return fallback
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  return `${formatCents(low)}${low === high ? '' : `–${formatCents(high)}`} ${unit}`
}

export default function AdultGymnasticsPricing({ classes }: { classes: readonly RecurringPriceClass[] | null }) {
  const [requested, setRequested] = useState(false)
  const [monthly, setMonthly] = useState<number[] | null>(null)
  const [dropIn, setDropIn] = useState<number[] | null>(null)

  useEffect(() => {
    if (requested && classes !== null) return requestPrices(signal => fetchMonthlyPrices(classes, signal), setMonthly)
  }, [classes, requested])

  useEffect(() => {
    if (requested) return requestPrices(fetchDropInPrices, setDropIn)
  }, [requested])

  return (
    <details className="np-adult-pricing" id="adult-class-pricing" onToggle={event => {
      if (event.currentTarget.open) setRequested(true)
    }}>
      <summary data-analytics-cta="compare_adult_class_prices" data-analytics-section="adult_class_schedule">
        Compare adult gymnastics prices
      </summary>
      <p>Paid monthly enrollment requires an active annual membership. Membership is optional for drop-ins and eligible free trials. Review fees, first-month adjustments, and any benefits during booking.</p>
      {requested && (
        <dl aria-live="polite" data-prerender-dynamic="">
          <div>
            <dt>Listed base tuition</dt>
            <dd>{monthly ? describePrices(monthly, 'per month', 'See current tuition in enrollment.') : 'Checking current tuition…'}</dd>
          </div>
          <div>
            <dt>Nonmember drop-in</dt>
            <dd>{dropIn ? describePrices(dropIn, 'per class', 'See prices for available dates.') : 'Checking current drop-in prices…'}</dd>
          </div>
        </dl>
      )}
      <div className="np-program-page-actions">
        <Link to={ADULT_BOOKING_HREF} className="np-program-plain-link" data-analytics-cta="browse_classes" data-analytics-section="adult_class_pricing">Review monthly enrollment</Link>
        <Link to={ADULT_DROP_IN_HREF} className="np-program-plain-link" data-analytics-cta="browse_drop_ins" data-analytics-section="adult_class_pricing">Review available drop-in dates</Link>
      </div>
    </details>
  )
}

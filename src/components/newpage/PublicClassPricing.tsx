import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../../utils/api'
import { fetchNonmemberDropIns } from '../../utils/dropInApi'
import { formatCents } from '../../utils/money'
import {
  ADULT_BOOKING_HREF, ADULT_BOOKING_PROGRAM, ADULT_DROP_IN_HREF,
  FIT_AND_FLIP_BOOKING_HREF, FIT_AND_FLIP_BOOKING_PROGRAM, FIT_AND_FLIP_DROP_IN_HREF,
  getScopedDropInProgram,
} from '../../utils/publicBookingPrograms'
import { fetchSignupClassCatalog } from '../signup/signupEnrollmentUtils'

export type RecurringPriceClass = {
  classId: number
  formId: number
  groups: { id: number; offeringId?: number | null }[]
}

type PricingProgram = typeof ADULT_BOOKING_PROGRAM | typeof FIT_AND_FLIP_BOOKING_PROGRAM

const PRICING_DETAILS = {
  [ADULT_BOOKING_PROGRAM]: {
    id: 'adult-class-pricing', label: 'Compare adult gymnastics prices',
    comparisonKey: 'compare_adult_class_prices', scheduleSection: 'adult_class_schedule',
    bookingHref: ADULT_BOOKING_HREF, dropInHref: ADULT_DROP_IN_HREF,
  },
  [FIT_AND_FLIP_BOOKING_PROGRAM]: {
    id: 'fit-flip-class-pricing', label: 'Compare Fit & Flip prices',
    comparisonKey: 'compare_fit_flip_class_prices', scheduleSection: 'fit_flip_schedule',
    bookingHref: FIT_AND_FLIP_BOOKING_HREF, dropInHref: FIT_AND_FLIP_DROP_IN_HREF,
  },
} as const

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

async function fetchDropInPrices(program: PricingProgram, signal: AbortSignal) {
  const { sessions } = await fetchNonmemberDropIns(signal)
  return sessions.filter(session => getScopedDropInProgram(session.programName) === program &&
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

export default function PublicClassPricing({ program, classes }: {
  program: PricingProgram
  classes: readonly RecurringPriceClass[] | null
}) {
  const { id, label, comparisonKey, scheduleSection, bookingHref, dropInHref } = PRICING_DETAILS[program]
  const analyticsSection = id.replaceAll('-', '_')
  const [requested, setRequested] = useState(false)
  const [monthly, setMonthly] = useState<number[] | null>(null)
  const [dropIn, setDropIn] = useState<number[] | null>(null)

  useEffect(() => {
    if (requested && classes !== null) return requestPrices(signal => fetchMonthlyPrices(classes, signal), setMonthly)
  }, [classes, requested])

  useEffect(() => {
    if (requested) return requestPrices(signal => fetchDropInPrices(program, signal), setDropIn)
  }, [program, requested])

  return (
    <details className="np-class-pricing" id={id} onToggle={event => {
      if (event.currentTarget.open) setRequested(true)
    }}>
      <summary data-analytics-cta={comparisonKey} data-analytics-section={scheduleSection}>
        {label}
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
          {program === FIT_AND_FLIP_BOOKING_PROGRAM && (
            <div>
              <dt>Eligible first trial</dt>
              <dd>$0 on qualifying dates</dd>
            </div>
          )}
        </dl>
      )}
      <div className="np-program-page-actions">
        <Link to={bookingHref} className="np-program-plain-link" data-analytics-cta="browse_classes" data-analytics-section={analyticsSection}>Review monthly enrollment</Link>
        <Link to={dropInHref} className="np-program-plain-link" data-analytics-cta="browse_drop_ins" data-analytics-section={analyticsSection}>Review available drop-in dates</Link>
        {program === FIT_AND_FLIP_BOOKING_PROGRAM && (
          <Link to="/fit-and-flip#training-fit" className="np-program-plain-link" data-analytics-cta="free_trial_section" data-analytics-section={analyticsSection}>Find a free Fit &amp; Flip trial</Link>
        )}
      </div>
    </details>
  )
}

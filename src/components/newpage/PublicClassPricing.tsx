import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import { CONTACT_INQUIRY_PATH } from '../../config/contact'
import { getApiUrl } from '../../utils/api'
import { formatCents } from '../../utils/money'
import {
  ADULT_BOOKING_HREF, ADULT_BOOKING_PROGRAM, ADULT_DROP_IN_HREF,
  DEVELOPMENTAL_GYMNASTICS_HREF, DEVELOPMENTAL_GYMNASTICS_PROGRAM, DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF,
  FIT_AND_FLIP_BOOKING_HREF, FIT_AND_FLIP_BOOKING_PROGRAM, FIT_AND_FLIP_DROP_IN_HREF,
  getScopedDropInProgram, type RecurringBookingProgram,
} from '../../utils/publicBookingPrograms'
import type { RecurringPriceClass } from './loadPublicRecurringSchedule'

const PRICING_DETAILS = {
  [DEVELOPMENTAL_GYMNASTICS_PROGRAM]: {
    id: 'youth-gymnastics-pricing', label: 'Compare youth gymnastics prices',
    comparisonKey: 'compare_youth_gymnastics_prices', scheduleSection: 'youth_gymnastics_schedule',
    bookingHref: DEVELOPMENTAL_GYMNASTICS_HREF, dropInHref: DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF,
    trial: { href: '/gymnastics#first-visit', label: 'Find a free gymnastics trial' },
  },
  [ADULT_BOOKING_PROGRAM]: {
    id: 'adult-class-pricing', label: 'Compare adult gymnastics prices',
    comparisonKey: 'compare_adult_class_prices', scheduleSection: 'adult_class_schedule',
    bookingHref: ADULT_BOOKING_HREF, dropInHref: ADULT_DROP_IN_HREF,
    trial: null,
  },
  [FIT_AND_FLIP_BOOKING_PROGRAM]: {
    id: 'fit-flip-class-pricing', label: 'Compare Fit & Flip prices',
    comparisonKey: 'compare_fit_flip_class_prices', scheduleSection: 'fit_flip_schedule',
    bookingHref: FIT_AND_FLIP_BOOKING_HREF, dropInHref: FIT_AND_FLIP_DROP_IN_HREF,
    trial: { href: '/fit-and-flip#training-fit', label: 'Find a free Fit & Flip trial' },
  },
} as const

function isPositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

async function fetchMonthlyTuition({ classId, formId, groups }: RecurringPriceClass, signal: AbortSignal) {
  const { fetchSignupClassCatalog } = await import('../signup/signupEnrollmentUtils')
  const catalog = await fetchSignupClassCatalog(getApiUrl(), classId, signal)
  if (catalog.formId !== formId || catalog.costUnit !== 'per_month') return []
  const prices = groups.flatMap(group => {
    const options = catalog.scheduleOptions.filter(option =>
      option.scheduleMode === 'day' && !option.datesTbd && option.slotGroupId === group.id &&
      (option.offeringId ?? null) === (group.offeringId ?? null))
    return options.length ? options.map(({ priceCents }) => priceCents) : [null]
  })
  return prices.every(isPositivePrice) ? prices : []
}

async function fetchDropInPrices(program: RecurringBookingProgram, signal: AbortSignal) {
  const { fetchNonmemberDropIns } = await import('../../utils/dropInApi')
  const { sessions } = await fetchNonmemberDropIns(signal)
  return sessions.filter(session => getScopedDropInProgram(session.programName) === program &&
    !session.isFull && !session.excludedFromDropIns && isPositivePrice(session.totalCents))
    .map(({ classId, totalCents }) => ({ classId, totalCents }))
}

async function fetchMonthlyPrices(classes: readonly RecurringPriceClass[], signal: AbortSignal) {
  const prices = await Promise.allSettled(classes.map(classItem => fetchMonthlyTuition(classItem, signal)))
  return prices.map(result => result.status === 'fulfilled' ? result.value : [])
}

function requestPrices<T>(load: (signal: AbortSignal) => Promise<T[]>, publish: (prices: T[]) => void) {
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
  const amount = `${formatCents(low)}${low === high ? '' : `–${formatCents(high)}`}`
  return unit ? `${amount} ${unit}` : amount
}

export default function PublicClassPricing({ program, classes, usesClassTuition, onOpen }: {
  program: RecurringBookingProgram
  classes: readonly RecurringPriceClass[] | null
  usesClassTuition: boolean
  onOpen: () => void
}) {
  const { id, label, comparisonKey, scheduleSection, bookingHref, dropInHref, trial } = PRICING_DETAILS[program]
  const { hash, key } = useLocation()
  const navigationType = useNavigationType()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const isYouthGymnastics = program === DEVELOPMENTAL_GYMNASTICS_PROGRAM
  const analyticsSection = id.replaceAll('-', '_')
  const [requested, setRequested] = useState(false)
  const [monthly, setMonthly] = useState<number[][] | null>(null)
  const [dropIn, setDropIn] = useState<Awaited<ReturnType<typeof fetchDropInPrices>> | null>(null)
  const uniformClassTuition = monthly?.every(prices => prices.length > 0 && prices.every(price => price === prices[0]))
    ? monthly.map(prices => prices[0]) : []

  useEffect(() => {
    const details = detailsRef.current
    if (hash !== `#${id}` || !details) return

    details.open = true
    if (navigationType === 'PUSH') details.querySelector('summary')?.focus({ preventScroll: true })
  }, [hash, id, key, navigationType])

  useEffect(() => {
    if (requested && classes !== null && usesClassTuition) {
      return requestPrices(signal => fetchMonthlyPrices(classes, signal), setMonthly)
    }
  }, [classes, requested, usesClassTuition])

  useEffect(() => {
    if (requested) return requestPrices(signal => fetchDropInPrices(program, signal), setDropIn)
  }, [program, requested])

  return (
    <details className={`np-class-pricing${isYouthGymnastics ? ' np-youth-gymnastics-pricing' : ''}`} id={id} ref={detailsRef} onToggle={event => {
      if (event.currentTarget.open) {
        onOpen()
        setRequested(true)
      }
    }}>
      <summary data-analytics-cta={comparisonKey} data-analytics-section={scheduleSection}>
        {label}
      </summary>
      {isYouthGymnastics && (
        <p>Compare base tuition for a weekly class and the nonmember price for a single visit. Check the right level for your child before choosing a time.</p>
      )}
      <p>Paid monthly enrollment requires an active annual membership. Membership is optional for drop-ins and eligible free trials. Review fees, first-month adjustments, and any benefits during booking.</p>
      <p>
        To request cancellation of a recurring class, open <strong>Classes</strong> in your Vortex account.
        Under <strong>Enrollments</strong>, choose <strong>Manage enrollment</strong> for the class, then{' '}
        <strong>Request cancellation</strong>. Your enrollment and billing stay active while Billing reviews
        the request. See the <Link to="/terms-of-service" className="underline">Terms of Service</Link> or{' '}
        <Link to={CONTACT_INQUIRY_PATH} className="underline">contact Vortex with questions</Link>.
      </p>
      {isYouthGymnastics && requested && (
        <div aria-live="polite" data-prerender-dynamic="">
          {classes === null ? <p>Checking current class prices…</p> : classes.length ? (
            <table>
              <thead>
                <tr><th scope="col">Class</th><th scope="col">Base monthly tuition</th><th scope="col">Nonmember drop-in</th></tr>
              </thead>
              <tbody>
                {classes.map(({ classId, name, formId, excludeFromDropIns }, index) => (
                  <tr key={formId}>
                    <th scope="row">
                      <Link to={`${bookingHref}&form=${formId}`} data-analytics-cta="browse_classes" data-analytics-section={analyticsSection}>{name}</Link>
                    </th>
                    <td>{usesClassTuition && monthly === null ? 'Checking…' : describePrices(monthly?.[index] ?? [], '', 'See enrollment')}</td>
                    <td>{excludeFromDropIns ? 'Unavailable' : dropIn === null ? 'Checking…' : describePrices(
                      dropIn.filter(session => session.classId === classId).map(session => session.totalCents), '', 'Check dates',
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Check enrollment or available drop-in dates for current prices.</p>}
        </div>
      )}
      {!isYouthGymnastics && requested && (
        <dl aria-live="polite" data-prerender-dynamic="">
          <div>
            <dt>Listed base tuition</dt>
            <dd>{monthly ? describePrices(uniformClassTuition, 'per month', 'See current tuition in enrollment.') : 'Checking current tuition…'}</dd>
          </div>
          <div>
            <dt>Nonmember drop-in</dt>
            <dd>{dropIn ? describePrices(dropIn.map(session => session.totalCents), 'per class', 'See prices for available dates.') : 'Checking current drop-in prices…'}</dd>
          </div>
          {program === FIT_AND_FLIP_BOOKING_PROGRAM && (
            <div>
              <dt>Eligible first trial</dt>
              <dd>$0 on qualifying dates</dd>
            </div>
          )}
        </dl>
      )}
      {isYouthGymnastics && <p>Eligible athletes can book one free trial. The trial finder uses age and gymnastics experience to show the right option.</p>}
      <div className="np-program-page-actions">
        <Link to={bookingHref} className="np-program-plain-link" data-analytics-cta="browse_classes" data-analytics-section={analyticsSection}>Review monthly enrollment</Link>
        <Link to={dropInHref} className="np-program-plain-link" data-analytics-cta="browse_drop_ins" data-analytics-section={analyticsSection}>Review available drop-in dates</Link>
        {trial && (
          <Link to={trial.href} className="np-program-plain-link" data-analytics-cta="free_trial_section" data-analytics-section={analyticsSection}>{trial.label}</Link>
        )}
      </div>
    </details>
  )
}

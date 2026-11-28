import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../../utils/api'
import { formatCents } from '../../utils/money'
import {
  ADULT_BOOKING_HREF, ADULT_BOOKING_PROGRAM, ADULT_DROP_IN_HREF,
  DEVELOPMENTAL_GYMNASTICS_HREF, DEVELOPMENTAL_GYMNASTICS_PROGRAM, DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF,
  FIT_AND_FLIP_BOOKING_HREF, FIT_AND_FLIP_BOOKING_PROGRAM, FIT_AND_FLIP_DROP_IN_HREF,
  getScopedDropInProgram, isYouthGymnasticsDropInClass, type RecurringBookingProgram,
} from '../../utils/publicBookingPrograms'
import type { RecurringClassTimes, RecurringPriceClass } from './loadPublicRecurringSchedule'
import { formatSkillLevel } from '../../utils/classDisplayUtils'
import RecurringRegistrationLink from './RecurringRegistrationLink'
import RecurringBookingTerms from './RecurringBookingTerms'

const PRICING_DETAILS = {
  [DEVELOPMENTAL_GYMNASTICS_PROGRAM]: {
    id: 'youth-gymnastics-pricing',
    bookingHref: DEVELOPMENTAL_GYMNASTICS_HREF, dropInHref: DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF,
    trial: { href: '/gymnastics#first-visit', label: 'Find a free gymnastics trial' },
  },
  [ADULT_BOOKING_PROGRAM]: {
    id: 'adult-class-pricing',
    bookingHref: ADULT_BOOKING_HREF, dropInHref: ADULT_DROP_IN_HREF,
    trial: null,
  },
  [FIT_AND_FLIP_BOOKING_PROGRAM]: {
    id: 'fit-flip-class-pricing',
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

export default function PublicClassPricing({ program, classes, usesClassTuition, loading }: {
  program: RecurringBookingProgram
  classes: readonly RecurringClassTimes[] | null
  usesClassTuition: boolean
  loading: boolean
}) {
  const { id, bookingHref, dropInHref, trial } = PRICING_DETAILS[program]
  const analyticsSection = id.replaceAll('-', '_')
  const dropInButtonHref = program === DEVELOPMENTAL_GYMNASTICS_PROGRAM ? undefined : dropInHref
  const [monthly, setMonthly] = useState<number[][] | null>(null)
  const [dropIn, setDropIn] = useState<Awaited<ReturnType<typeof fetchDropInPrices>> | null>(null)

  useEffect(() => {
    if (classes?.length && usesClassTuition) {
      return requestPrices(signal => fetchMonthlyPrices(classes, signal), setMonthly)
    }
  }, [classes, usesClassTuition])

  useEffect(() => {
    if (classes?.length) return requestPrices(signal => fetchDropInPrices(program, signal), setDropIn)
  }, [classes, program])

  return <div className="np-youth-booking-summary">
    <header className="np-youth-booking-header">
      <h3>Weekly times and prices</h3>
      <p>All times Eastern.</p>
    </header>
    <div className="np-recurring-schedule" data-prerender-dynamic="" aria-live="polite">
      {classes?.length ? <ul className="np-youth-booking-classes">
        {classes.map(({ classId, formId, name, times, skillLevel, skillRequirements, excludeFromDropIns }, index) => {
          const enrollmentHref = `${bookingHref}&form=${formId}`
          const dropInExcluded = excludeFromDropIns || (program === DEVELOPMENTAL_GYMNASTICS_PROGRAM && !isYouthGymnasticsDropInClass(name))
          return <li key={formId}>
            <h4><Link to={enrollmentHref} data-analytics-cta="browse_classes" data-analytics-section={analyticsSection}>{name}</Link></h4>
            {skillLevel && <p className="text-sm">{formatSkillLevel(skillLevel)}</p>}
            {skillRequirements && <details className="np-booking-skill-requirements"><summary>Skill requirements</summary><p>{skillRequirements}</p></details>}
            <ul className="np-youth-booking-times">
              {times.map(({ label, isFull }) => <li key={label}><span>{label}{isFull && <strong className="text-amber-800"> · Full</strong>}</span></li>)}
            </ul>
            <dl className="np-youth-booking-prices">
              <dt>Base monthly tuition</dt><dd>{!usesClassTuition ? 'See registration' : monthly === null ? 'Checking…' : describePrices(monthly[index] ?? [], '', 'See registration')}</dd>
              <dt>Nonmember drop-in</dt><dd>{dropInExcluded ? 'Unavailable' : dropIn === null ? 'Checking…' : describePrices(dropIn.filter(session => session.classId === classId).map(session => session.totalCents), '', 'Check dates')}</dd>
            </dl>
            <RecurringRegistrationLink href={enrollmentHref} className={name} section={analyticsSection} dropInHref={dropInExcluded ? undefined : dropInHref} />
          </li>
        })}
      </ul> : <p>{loading ? 'Checking recurring class times…' : 'Check registration for current class times, prices, and availability.'}</p>}
    </div>
    <footer className="np-youth-booking-footer">
      {classes?.some(({ times }) => times.some(({ isFull }) => isFull)) && <p>If a time is full, check enrollment for another time or waitlist options.</p>}
      <p>Paid monthly enrollment requires an active annual membership. Membership is optional for drop-ins and eligible free trials. Confirm current prices and availability when you register.</p>
      {!classes?.length && <RecurringRegistrationLink href={bookingHref} section={analyticsSection} dropInHref={dropInButtonHref} />}
      <div className="np-program-page-actions">
        <Link to={dropInHref} data-analytics-cta="browse_drop_ins" data-analytics-section={analyticsSection}>Check drop-in dates</Link>
        {trial && <Link to={trial.href} data-analytics-cta="free_trial_section" data-analytics-section={analyticsSection}>{trial.label}</Link>}
      </div>
      <RecurringBookingTerms />
    </footer>
  </div>
}

import { Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import {
  BUSINESS_HOURS, BUSINESS_NAP, GOOGLE_DIRECTIONS_URL, INSIDE_THE_GYM_PATH, PARKING_AND_ACCESSIBILITY_PATH, TEAM_PHONE, TEAM_PHONE_E164,
} from '../../config/contact'
import { publicBookingSnapshot, type PublicAdultBooking } from '../../config/publicBookingSnapshot'
import type { OpenProgramPricingSnapshot } from '../../config/publicPageLoaders'
import { PUBLIC_PROGRAMS, type PublicProgramPath } from '../../config/publicPrograms'
import { trackEvent } from '../../utils/analyticsClient'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import { formatCents } from '../../utils/money'
import { ADULT_DROP_IN_HREF, DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF, FIT_AND_FLIP_DROP_IN_HREF } from '../../utils/publicBookingPrograms'
import PublicDialog from './PublicDialog'
import PublicRecurringSchedule from './PublicRecurringSchedule'
import YouthBookingSummary from './YouthBookingSummary'
import './PublicProgramPage.css'

const NewPageFreeTrial = lazyWithRetry(() => import('./NewPageFreeTrial'))
const TRIAL_ANCHOR = 'open-free-trial'
const TRIAL_HASH = `#${TRIAL_ANCHOR}`
const sectionTrialAnchor = (sectionId: string) => `${TRIAL_ANCHOR}-${sectionId}`

const HERO_IMAGE_SIZES = [
  '(max-width: 620px) calc(100vw - 44px)',
  '(max-width: 760px) calc(100vw - 56px)',
  '(max-width: 860px) calc(46.34vw - 27.32px)',
  '(max-width: 1150px) calc(46.34vw - 35.12px)',
  '(max-width: 1320px) calc(46.34vw - 54.63px)',
  '(min-width: 1440px) 582px',
  '557px',
].join(', ')

const bookingDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const bookingWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })
const bookingTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

function BookingDate({ date }: { date: string }) {
  return <time dateTime={date}>{bookingDate.format(new Date(date))}</time>
}

function formatBookingTime(time: string) {
  return bookingTime.format(new Date(`1970-01-01T${time}:00Z`))
}

function AdultBookingSummary({ booking }: { booking: PublicAdultBooking }) {
  const { recurringTimes, monthlyTuitionCents, dropIn, checkedOn } = booking
  const weekly = dropIn && dropIn.firstDate !== dropIn.lastDate
  return (
    <div id="adult-booking-summary" className="np-adult-booking-summary">
      <ul>
        {recurringTimes.map(({ days, startTime, endTime }) => (
          <li key={`${startTime}-${endTime}`} className="np-adult-recurring-time">
            <strong>Recurring class</strong> {days}{' '}
            <time dateTime={startTime}>{formatBookingTime(startTime)}</time>–<time dateTime={endTime}>{formatBookingTime(endTime)}</time> Eastern
          </li>
        ))}
        {dropIn && (
          <li>
            <strong>{formatCents(dropIn.priceCents)} per nonmember drop-in.</strong>{' '}
            {weekly ? `Listed ${bookingWeekday.format(new Date(dropIn.firstDate))} drop-ins are ` : 'First listed drop-in at '}
            {formatBookingTime(dropIn.startTime)}–{formatBookingTime(dropIn.endTime)} Eastern
            {weekly ? ' from ' : ' on '}<BookingDate date={dropIn.firstDate} />
            {weekly && <> through <BookingDate date={dropIn.lastDate} /></>}.
            {dropIn.maxParticipants != null && ` Up to ${dropIn.maxParticipants} participants per listed drop-in.`}
            {dropIn.freeTrial && ' These dates accept eligible one-time free trials.'}{' '}
            <Link to={ADULT_DROP_IN_HREF} data-analytics-cta="browse_drop_ins" data-analytics-section="adult_booking_summary">Check drop-in dates</Link>.
          </li>
        )}
        {monthlyTuitionCents !== null && (
          <li><strong>{formatCents(monthlyTuitionCents)} base tuition per month.</strong> Recurring enrollment requires an active annual membership.</li>
        )}
      </ul>
      <p>Catalog checked <BookingDate date={checkedOn} />. Confirm current prices and availability when you book.</p>
    </div>
  )
}

export default function PublicProgramPage({ path, initialPricing }: {
  path: PublicProgramPath
  initialPricing?: OpenProgramPricingSnapshot
}) {
  const program = PUBLIC_PROGRAMS[path]
  const { hash, key } = useLocation()
  const { primaryAction, secondaryAction, recurringSchedule, trial } = program
  const [trialOpen, setTrialOpen] = useState(false)
  const handledTrialLocation = useRef<string | null>(null)
  const restoredPricing = useRef(false)
  const scheduleLayoutSettled = useRef(false)
  const restorePricingVisibility = useRef<(() => void) | null>(null)
  const trialSectionId = trial && (trial.program === 'gymnastics' ? 'first-visit' : 'training-fit')
  const adultBooking = path === '/adult-gymnastics' ? publicBookingSnapshot?.[path] : null
  const youthBooking = path === '/adult-gymnastics' ? null : publicBookingSnapshot?.[path]
  const trialIntentSection = hash === TRIAL_HASH ? 'program' : program.sections
    .find(section => section.trialLabel && hash === `#${sectionTrialAnchor(section.id)}`)
    ?.id.replaceAll('-', '_')

  const handleScheduleLayoutSettled = useCallback(() => {
    scheduleLayoutSettled.current = true
    restorePricingVisibility.current?.()
  }, [])

  useEffect(() => {
    if (!hash && !initialPricing) return
    let cancelPendingRestore: (() => void) | undefined
    const frame = requestAnimationFrame(() => {
      if (initialPricing && !restoredPricing.current) {
        restoredPricing.current = true
        const pricing = document.getElementById(initialPricing.id)
        if (pricing instanceof HTMLDetailsElement) {
          const summary = pricing.querySelector('summary')
          if (summary) {
            pricing.open = true
            if (initialPricing.summaryFocused) summary.focus({ preventScroll: true })
            const shift = summary.getBoundingClientRect().top - initialPricing.summaryViewportTop
            window.scrollBy({ top: shift, behavior: 'instant' })

            if (!scheduleLayoutSettled.current) {
              const position = window.scrollY
              const listeners = new AbortController()
              const cancel = () => {
                listeners.abort()
                restorePricingVisibility.current = null
              }
              cancelPendingRestore = cancel
              for (const type of ['pointerdown', 'wheel', 'keydown', 'focusin']) {
                document.addEventListener(type, cancel, { capture: true, passive: true, signal: listeners.signal })
              }
              window.addEventListener('scroll', () => {
                if (window.scrollY !== position) cancel()
              }, { passive: true, signal: listeners.signal })
              restorePricingVisibility.current = () => {
                cancel()
                if (!pricing.open || !summary.isConnected || window.scrollY !== position) return
                const { x, y, width, height } = summary.getBoundingClientRect()
                const centeredTop = (window.innerHeight - height) / 2
                const targetTop = Math.min(initialPricing.summaryViewportTop, centeredTop)
                if (targetTop >= 0 && y > targetTop) {
                  window.scrollBy({ top: y - targetTop, behavior: 'instant' })
                } else if (!summary.contains(document.elementFromPoint(x + width / 2, y + height / 2))) {
                  window.scrollBy({ top: y - centeredTop, behavior: 'instant' })
                }
              }
            }
            return
          }
        }
      }
      if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelPendingRestore?.()
    }
  }, [hash, initialPricing, key, path])

  const openTrial = useCallback((section: string) => {
    if (!trial) return
    trackEvent('trial_start', path, { properties: { section, program_slug: trial.program } })
    setTrialOpen(true)
  }, [path, trial])

  useEffect(() => {
    if (!trial || !trialIntentSection) {
      if (handledTrialLocation.current !== null) {
        handledTrialLocation.current = null
        setTrialOpen(false)
      }
      return
    }

    // A native click can record the trial intent before React starts.
    const location = key + hash
    if (handledTrialLocation.current === location) return
    handledTrialLocation.current = location
    document.getElementById(hash.slice(1))?.focus({ preventScroll: true })
    openTrial(trialIntentSection)
  }, [hash, key, openTrial, trial, trialIntentSection])

  function activateTrialLink(event: MouseEvent<HTMLAnchorElement>, section: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    openTrial(section)
  }

  function renderSectionTrialLink(sectionId: string, label: string) {
    const anchor = sectionTrialAnchor(sectionId)
    const analyticsSection = sectionId.replaceAll('-', '_')
    return (
      <a
        id={anchor} href={`#${anchor}`} role="button" aria-haspopup="dialog"
        className="np-program-plain-link scroll-mt-24" data-analytics-cta="free_trial" data-analytics-section={analyticsSection}
        onClick={event => activateTrialLink(event, analyticsSection)}
        onKeyDown={event => { if (event.key === ' ') event.preventDefault() }}
        onKeyUp={event => {
          if (event.key !== ' ') return
          event.preventDefault()
          event.currentTarget.click()
        }}
      >
        {label} <ArrowUpRight size={16} aria-hidden="true" />
      </a>
    )
  }

  const schedulePlacementIndex = program.sections.findIndex(section => section.id === recurringSchedule?.afterSection) + 1
  const programSections = program.sections.map(section => (
    <section key={section.id} id={section.id} className="np-program-section">
      <h2 id={section.id === trialSectionId ? TRIAL_ANCHOR : undefined}
        tabIndex={section.id === trialSectionId ? -1 : undefined}>{section.heading}</h2>
      <p>{section.description}</p>
      {section.topics && (
        <div className="np-program-topics">
          {section.topics.map(topic => {
            const links = topic.links ?? (topic.link ? [topic.link] : [])
            return (
              <article key={topic.id} id={topic.id}>
                <h3>{topic.heading}</h3>
                <p>{topic.description}</p>
                {links.length > 0 && (
                  <div className="mt-3 flex flex-col items-start gap-1">
                    {links.map(({ href, label, analyticsKey }) => (
                      <Link key={href} to={href} className="np-program-plain-link" data-analytics-cta={analyticsKey} data-analytics-section={topic.id}>
                        {label} <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      {section.photo && (
        <figure className="np-program-section-photo">
          <img src={section.photo.src} srcSet={section.photo.srcSet} alt={section.photo.alt}
            width={section.photo.width} height={section.photo.height} loading="lazy" decoding="async"
            sizes="auto, (max-width: 620px) calc(100vw - 44px), (max-width: 760px) calc(100vw - 64px), 42rem" />
          <figcaption>{section.photo.caption}</figcaption>
        </figure>
      )}
      {(section.links || section.trialLabel) && (
        <div className="np-program-page-actions">
          {trial && section.trialLabel && renderSectionTrialLink(section.id, section.trialLabel)}
          {section.links?.map(({ href, label, analyticsKey }) => (
            <Link key={href} to={href} className="np-program-plain-link" data-analytics-cta={analyticsKey} data-analytics-section={section.id}>
              {label} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  ))

  return (
    <main id="public-content" className="np-program-page" tabIndex={-1}>
      <section className="np-program-hero">
        <div className="np-container np-program-hero-layout">
          <div className="np-program-hero-copy">
            <nav aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{program.name}</span>
            </nav>
            <h1>{program.heading}</h1>
            <p>{program.intro}</p>
            <div className="np-program-page-actions">
              <Link to={primaryAction.href} className="np-button" data-analytics-cta={primaryAction.analyticsKey} data-analytics-section="program">
                {primaryAction.label} <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              {secondaryAction && (
                <Link to={secondaryAction.href} className="np-program-plain-link" data-analytics-cta={secondaryAction.analyticsKey} data-analytics-section="program">
                  {secondaryAction.label} <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              )}
              {trial && (
                <a href={TRIAL_HASH} className="np-program-plain-link" aria-haspopup="dialog"
                  data-analytics-cta="free_trial" data-analytics-section="program"
                  onClick={event => activateTrialLink(event, 'program')}>
                  {trial.label} <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <picture>
            {program.imageAvifSrcSet && (
              <source type="image/avif" srcSet={program.imageAvifSrcSet} sizes={HERO_IMAGE_SIZES} />
            )}
            <img
              className="np-program-hero-image"
              src={program.image}
              srcSet={program.imageSrcSet}
              sizes={program.imageSrcSet ? HERO_IMAGE_SIZES : undefined}
              alt={program.imageAlt}
              width={program.imageWidth}
              height={program.imageHeight}
              fetchPriority="high"
            />
          </picture>
        </div>
      </section>

      <div className="np-container">
        {programSections.slice(0, schedulePlacementIndex)}

        {recurringSchedule && (
          <section className="np-program-section np-program-schedule" id={recurringSchedule.id} aria-labelledby={`${recurringSchedule.id}-heading`}>
            <h2 id={`${recurringSchedule.id}-heading`}>{recurringSchedule.heading}</h2>
            {recurringSchedule.description && <p>{recurringSchedule.description}</p>}
            {adultBooking && <AdultBookingSummary booking={adultBooking} />}
            {youthBooking && (
              <YouthBookingSummary booking={youthBooking} enrollmentHref={primaryAction.href}
                dropInHref={path === '/gymnastics' ? DEVELOPMENTAL_GYMNASTICS_DROP_IN_HREF : FIT_AND_FLIP_DROP_IN_HREF} />
            )}
            <PublicRecurringSchedule
              key={recurringSchedule.programName}
              programName={recurringSchedule.programName}
              scheduleId={recurringSchedule.id}
              onLayoutSettled={initialPricing ? handleScheduleLayoutSettled : undefined}
            />
            <Link to={primaryAction.href} className="np-program-plain-link" data-analytics-cta={primaryAction.analyticsKey} data-analytics-section={recurringSchedule.id.replaceAll('-', '_')}>
              Check dates and availability <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}

        {programSections.slice(schedulePlacementIndex)}

        <section className="np-program-section np-program-faqs" aria-labelledby="program-faqs-heading">
          <h2 id="program-faqs-heading">Common questions</h2>
          <div className="np-program-questions">
            {program.faqs.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question} <ChevronDown size={18} aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="np-program-visit" aria-labelledby="program-visit-heading">
          <div>
            <h2 id="program-visit-heading">Visit Vortex in Bowie</h2>
            <address>
              {BUSINESS_NAP.name}<br />
              {BUSINESS_NAP.streetAddress}, {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
            </address>
            <div className="np-program-visit-hours">
              <h3>Facility hours</h3>
              <ul>{BUSINESS_HOURS.map(({ label }) => <li key={label}>{label}</li>)}</ul>
            </div>
          </div>
          <div className="np-program-page-actions">
            <a className="np-program-plain-link" href={GOOGLE_DIRECTIONS_URL} data-analytics-cta="get_directions" data-analytics-section="program">
              Get directions <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <Link className="np-program-plain-link" to={PARKING_AND_ACCESSIBILITY_PATH}>
              Parking and accessibility <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <a className="np-program-plain-link" href={`tel:${TEAM_PHONE_E164}`} data-analytics-cta="call" data-analytics-section="program">
              Call {TEAM_PHONE} <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <Link className="np-program-plain-link" to={INSIDE_THE_GYM_PATH} data-analytics-cta="see_inside_the_gym" data-analytics-section="program">
              See inside the Bowie gym <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <nav className="np-program-related" aria-label="Other Vortex programs">
          {program.relatedPaths.map(relatedPath => (
            <Link key={relatedPath} to={relatedPath} className="np-program-plain-link">
              {PUBLIC_PROGRAMS[relatedPath].name} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
      {trial && trialOpen && (
        <PublicDialog className="np-dialog-trial" labelledBy="np-trial-title" onClose={() => setTrialOpen(false)}>
          <Suspense fallback={<div className="np-dialog-content"><h2 id="np-trial-title">Loading trial signup…</h2></div>}>
            <NewPageFreeTrial initialProgram={trial.program} sourcePath={path} onDone={() => setTrialOpen(false)} />
          </Suspense>
        </PublicDialog>
      )}
    </main>
  )
}

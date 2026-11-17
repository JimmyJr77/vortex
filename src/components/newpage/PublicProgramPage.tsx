import { Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import {
  BUSINESS_HOURS, BUSINESS_NAP, GOOGLE_DIRECTIONS_URL, INSIDE_THE_GYM_PATH, PARKING_AND_ACCESSIBILITY_PATH, TEAM_PHONE, TEAM_PHONE_E164,
} from '../../config/contact'
import { publicBookingSnapshot, type PublicAdultBooking } from '../../config/publicBookingSnapshot'
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

function AdultBookingSummary({ booking }: { booking: PublicAdultBooking }) {
  const { monthlyTuitionCents, dropIn, checkedOn } = booking
  const weekly = dropIn && dropIn.firstDate !== dropIn.lastDate
  return (
    <div id="adult-booking-summary" className="np-adult-booking-summary">
      <ul>
        {dropIn && (
          <li>
            <strong>{formatCents(dropIn.priceCents)} per nonmember drop-in.</strong>{' '}
            {weekly ? `Listed ${bookingWeekday.format(new Date(dropIn.firstDate))} drop-ins are ` : 'First listed drop-in at '}
            {bookingTime.format(new Date(`1970-01-01T${dropIn.startTime}:00Z`))}–{bookingTime.format(new Date(`1970-01-01T${dropIn.endTime}:00Z`))} Eastern
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

export default function PublicProgramPage({ path }: { path: PublicProgramPath }) {
  const program = PUBLIC_PROGRAMS[path]
  const { hash, key } = useLocation()
  const { primaryAction, secondaryAction, recurringSchedule, trial } = program
  const [trialOpen, setTrialOpen] = useState(false)
  const adultBooking = path === '/adult-gymnastics' ? publicBookingSnapshot?.[path] : null
  const youthBooking = path === '/adult-gymnastics' ? null : publicBookingSnapshot?.[path]

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, key, path])

  function renderTrialButton(section: string, label = trial?.label) {
    if (!trial || !label) return null
    return (
      <button type="button" className="np-program-plain-link" data-analytics-cta="free_trial" data-analytics-section={section}
        onClick={() => {
          trackEvent('trial_start', path, { properties: { section, program_slug: trial.program } })
          setTrialOpen(true)
        }}>
        {label} <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    )
  }

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
              {renderTrialButton('program')}
            </div>
          </div>
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
        </div>
      </section>

      <div className="np-container">
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
            />
            <Link to={primaryAction.href} className="np-program-plain-link" data-analytics-cta={primaryAction.analyticsKey} data-analytics-section={recurringSchedule.id.replaceAll('-', '_')}>
              Check dates and availability <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}

        {program.sections.map(section => (
          <section key={section.id} id={section.id} className="np-program-section">
            <h2>{section.heading}</h2>
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
            {(section.links || section.trialLabel) && (
              <div className="np-program-page-actions">
                {section.trialLabel && renderTrialButton(section.id.replaceAll('-', '_'), section.trialLabel)}
                {section.links?.map(({ href, label, analyticsKey }) => (
                  <Link key={href} to={href} className="np-program-plain-link" data-analytics-cta={analyticsKey} data-analytics-section={section.id}>
                    {label} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}

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

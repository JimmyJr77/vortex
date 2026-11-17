import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { BUSINESS_NAP, GOOGLE_DIRECTIONS_URL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import { PUBLIC_PROGRAMS, type PublicProgramPath } from '../../config/publicPrograms'
import { ADULT_BOOKING_PROGRAM, FIT_AND_FLIP_BOOKING_PROGRAM } from '../../utils/publicBookingPrograms'
import PublicRecurringSchedule from './PublicRecurringSchedule'
import './PublicProgramPage.css'

const HERO_IMAGE_SIZES = [
  '(max-width: 620px) calc(100vw - 44px)',
  '(max-width: 760px) calc(100vw - 56px)',
  '(max-width: 860px) calc(46.34vw - 27.32px)',
  '(max-width: 1150px) calc(46.34vw - 35.12px)',
  '(max-width: 1320px) calc(46.34vw - 54.63px)',
  '(min-width: 1440px) 582px',
  '557px',
].join(', ')

export default function PublicProgramPage({ path }: { path: PublicProgramPath }) {
  const program = PUBLIC_PROGRAMS[path]
  const { hash } = useLocation()
  const { primaryAction, secondaryAction } = program

  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, path])

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
            </div>
            {path === '/adult-gymnastics' && (
              <PublicRecurringSchedule programName={ADULT_BOOKING_PROGRAM} heading="Recurring class times" />
            )}
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
        {path === '/fit-and-flip' && (
          <section className="np-program-section np-fit-flip-schedule" id="fit-flip-schedule" aria-labelledby="fit-flip-schedule-heading">
            <h2 id="fit-flip-schedule-heading">Recurring Fit &amp; Flip class times</h2>
            <p>Check weekly Cyclones times for ages 8–11 and 12–15. Enrollment shows available spots and start dates.</p>
            <PublicRecurringSchedule programName={FIT_AND_FLIP_BOOKING_PROGRAM} />
            <Link to={primaryAction.href} className="np-program-plain-link" data-analytics-cta={primaryAction.analyticsKey} data-analytics-section="fit_flip_schedule">
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
                {section.topics.map(topic => (
                  <article key={topic.id} id={topic.id}>
                    <h3>{topic.heading}</h3>
                    <p>{topic.description}</p>
                    {topic.link && (
                      <Link to={topic.link.href} className="np-program-plain-link mt-3" data-analytics-cta={topic.link.analyticsKey} data-analytics-section={topic.id}>
                        {topic.link.label} <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
            {section.links && (
              <div className="np-program-page-actions">
                {section.links.map(({ href, label, analyticsKey }) => (
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
          </div>
          <div className="np-program-page-actions">
            <a className="np-program-plain-link" href={GOOGLE_DIRECTIONS_URL} data-analytics-cta="get_directions" data-analytics-section="program">
              Get directions <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a className="np-program-plain-link" href={`tel:${TEAM_PHONE_E164}`} data-analytics-cta="call" data-analytics-section="program">
              Call {TEAM_PHONE} <ArrowUpRight size={16} aria-hidden="true" />
            </a>
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
    </main>
  )
}

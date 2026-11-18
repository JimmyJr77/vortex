import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BUSINESS_FACILITY_PHOTO,
  BUSINESS_HOURS,
  BUSINESS_NAP,
  CONTACT_INQUIRY_ID,
  CONTACT_INQUIRY_PATH,
  GOOGLE_DIRECTIONS_URL,
  GOOGLE_MAPS_URL,
  GOOGLE_REVIEW_URL,
  GYMNASTICS_EQUIPMENT_ID,
  INSIDE_THE_GYM_ID,
  INSIDE_THE_GYM_PATH,
  PARKING_AND_ACCESSIBILITY_ID,
  TEAM_EMAIL,
  TEAM_PHONE,
  TEAM_PHONE_E164,
} from '../config/contact'
import searchPhotos from '../config/publicSearchPhotos.json'
import './ContactLocationPage.css'

const { springFloor, trampoline, strengthEquipment } = searchPhotos.homepageGallery
const { balanceBeams, trainingRings } = searchPhotos.facilityApparatus
const galleryCardSizes = [
  'auto',
  '(max-width: 620px) calc(100vw - 46px)',
  '(max-width: 860px) calc((100vw - 80px) / 2)',
  '(max-width: 1150px) calc((100vw - 118px) / 3)',
  '(max-width: 1439px) calc((min(100vw, 1320px) - 162px) / 3)',
  '404px',
].join(', ')
const apparatusPhotoSizes = [
  'auto',
  '(max-width: 620px) calc(100vw - 46px)',
  '(max-width: 860px) calc((100vw - 80px) / 2)',
  '(max-width: 1150px) calc((100vw - 96px) / 2)',
  '(max-width: 1439px) calc((min(100vw, 1320px) - 138px) / 2)',
  '617px',
].join(', ')
const trainingSpaces = [
  {
    photo: springFloor,
    heading: 'Spring floor and tumbling track',
    detail: 'Young gymnasts work on foundations such as rolls, cartwheels, and handstands in developmental classes.',
    href: '/gymnastics#choose-a-class',
    label: 'Find a youth gymnastics starting class',
  },
  {
    photo: trampoline,
    heading: 'Trampoline and padded training area',
    detail: 'Fit & Flip coaches use trampolines and tumble tracks to teach body shapes and controlled landings.',
    href: '/fit-and-flip#body-control',
    label: 'See how Fit & Flip teaches body control',
  },
  {
    photo: strengthEquipment,
    heading: 'Strength training equipment',
    detail: 'A coach can start with bodyweight movements and add resistance as an athlete gets comfortable repeating the exercise.',
    href: '/fit-and-flip#strength',
    label: 'Explore coached youth strength training',
  },
] as const

function InsideTheGym() {
  return (
    <section id={INSIDE_THE_GYM_ID} aria-labelledby="inside-the-gym-heading"
      className="np-contact-section np-contact-gallery">
      <div className="np-container">
        <div className="np-contact-gallery-intro">
          <div>
            <p className="np-eyebrow">Our training space</p>
            <h2 id="inside-the-gym-heading" className="np-contact-title">Inside the Bowie gym</h2>
          </div>
          <p>
            Before your first visit, <Link to="/read-board#schedule">check the class schedule</Link>
            {' '}and complete any waivers requested during registration. Trying one class?{' '}
            <Link to="/drop-in">See available drop-in dates</Link>.
          </p>
        </div>
        <div className="np-contact-gallery-grid">
          {trainingSpaces.map(({ photo, heading, detail, href, label }) => (
            <article key={photo.src} className="np-contact-card">
              <img {...photo} sizes={galleryCardSizes} width={1600} height={1066} loading="lazy" decoding="async" />
              <div className="np-contact-card-body">
                <h3>{heading}</h3>
                <p>{detail}</p>
                <Link to={href} className="np-contact-action">{label}<ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
            </article>
          ))}
        </div>
        <div id={GYMNASTICS_EQUIPMENT_ID} role="region" aria-labelledby="gymnastics-equipment-heading"
          className="np-contact-apparatus">
          <h3 id="gymnastics-equipment-heading" className="np-contact-subtitle">Balance beams and training rings</h3>
          <div className="np-contact-apparatus-grid">
            <figure className="np-contact-card">
              <img {...balanceBeams} sizes={apparatusPhotoSizes} width={1600} height={1066} loading="lazy" decoding="async" />
              <figcaption>Low practice beams beside the tumbling track.</figcaption>
            </figure>
            <figure className="np-contact-card">
              <img {...trainingRings} sizes={apparatusPhotoSizes} width={1600} height={1066} loading="lazy" decoding="async" />
              <figcaption>Suspended wooden rings above the padded training area.</figcaption>
            </figure>
          </div>
          <p className="np-contact-gallery-note">
            Interested in specific apparatus?{' '}
            <Link to={CONTACT_INQUIRY_PATH}>Ask which equipment your class uses</Link>.
          </p>
        </div>
        <p className="np-contact-gallery-note">Visiting for an adult class?{' '}
          <Link to="/adult-gymnastics#class-format">See what to expect in Typhoons</Link>.
        </p>
      </div>
    </section>
  )
}

interface ContactLocationPageProps {
  onInquireClick: () => void
}

export default function ContactLocationPage({ onInquireClick }: ContactLocationPageProps) {
  const { hash, key } = useLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, key])

  return <div className="np-contact">
    <section className="np-contact-section np-contact-hero">
      <div className="np-container">
        <p className="np-eyebrow">Visit Vortex</p>
        <h1>Contact Vortex Athletics in Bowie, MD</h1>
        <p className="np-contact-intro">
          Questions about <Link to="/gymnastics">youth gymnastics</Link>,{' '}
          <Link to="/fit-and-flip">Fit &amp; Flip youth fitness classes</Link>, or{' '}
          <Link to="/adult-gymnastics">adult gymnastics</Link>?
          {' '}Our team can help with class placement, trials, and enrollment.
        </p>
        <div className="np-contact-actions">
          <button type="button" className="np-button" onClick={onInquireClick}>
            Send an Inquiry <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <a className="np-contact-action" href={GOOGLE_DIRECTIONS_URL} target="_blank" rel="noreferrer" data-analytics-cta="get_directions" data-analytics-section="contact_intro">
            Get directions to Vortex <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <Link className="np-contact-action" to={INSIDE_THE_GYM_PATH}>See inside the gym <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>

    <section className="np-contact-section">
      <div className="np-container">
        <div className="np-contact-info">
          <a className="np-contact-card np-contact-card-body" href={`tel:${TEAM_PHONE_E164}`}>
            <Phone size={24} aria-hidden="true" />
            <h2>Call Vortex</h2>
            <p>{TEAM_PHONE}</p>
          </a>
          <a className="np-contact-card np-contact-card-body" href={`mailto:${TEAM_EMAIL}`}>
            <Mail size={24} aria-hidden="true" />
            <h2>Email Our Team</h2>
            <p>{TEAM_EMAIL}</p>
          </a>
          <a className="np-contact-card np-contact-card-body" href={GOOGLE_DIRECTIONS_URL} target="_blank" rel="noreferrer">
            <MapPin size={24} aria-hidden="true" />
            <h2>Get Directions</h2>
            <address>
              <strong>{BUSINESS_NAP.name}</strong><br />
              {BUSINESS_NAP.streetAddress}<br />
              {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
            </address>
          </a>
          <div className="np-contact-card np-contact-card-body">
            <Clock3 size={24} aria-hidden="true" />
            <h2>Facility Hours</h2>
            <ul>
              {BUSINESS_HOURS.map((slot) => <li key={slot.label}>{slot.label}</li>)}
              <li>Sunday: Closed</li>
            </ul>
          </div>
        </div>
        <section id={PARKING_AND_ACCESSIBILITY_ID} aria-labelledby="parking-and-accessibility-heading" className="np-contact-arrival">
          <h2 id="parking-and-accessibility-heading" className="np-contact-subtitle">Parking and accessibility</h2>
          <p>
            Our Google Maps listing shows wheelchair-accessible parking and a wheelchair-accessible entrance at the gym.{' '}
            <a href={GOOGLE_MAPS_URL}>View the Google Maps listing</a>.
          </p>
          <p>
            For questions about access inside the gym or during class,{' '}
            <a href={`tel:${TEAM_PHONE_E164}`}>call us at {TEAM_PHONE}</a> before your visit.
          </p>
          <p>
            Melford Town Center is in the free Bowie PGC Link service area. Check the{' '}
            <a href="https://www.princegeorgescountymd.gov/departments-offices/public-works-transportation/metro-and-transportation/gopgc/microtransit-pgc-link">
              county’s pickup area and service hours
            </a>{' '}for both directions before booking a ride.
          </p>
        </section>
        <p className="np-contact-review">
          Have you or your child taken a class at Vortex?{' '}
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer">
            Share your experience on Google
          </a>.
        </p>
      </div>
    </section>

    <section className="np-contact-section np-contact-location">
      <div className="np-container np-contact-location-grid">
        <div className="np-contact-location-copy">
          <p className="np-eyebrow">Find us in Bowie</p>
          <h2 className="np-contact-title">Our Bowie gym at Melford Town Center</h2>
          <p>
            Find Vortex at 4961 Tesla Drive, Suite E, near Routes 50 and 3. Families visit our Bowie
            gym from across Prince George&apos;s and Anne Arundel counties.
          </p>
          <p>
            Contact us before visiting if you need help choosing an age group, assessing a skill
            level, confirming current availability, or planning a first class.
          </p>
          <img {...BUSINESS_FACILITY_PHOTO}
            sizes="auto, (max-width: 620px) calc(100vw - 44px), (max-width: 860px) calc(100vw - 56px), 650px"
            loading="lazy" decoding="async"
          />
        </div>
        <div id={CONTACT_INQUIRY_ID} className="np-contact-card np-contact-inquiry">
          <h2 className="np-contact-subtitle">What to include in your inquiry</h2>
          <ul>
            <li>Athlete age and activity of interest</li>
            <li>Current experience level, including complete beginners</li>
            <li>Preferred days or general availability</li>
            <li>Whether you are interested in a trial, drop-in, or ongoing class</li>
          </ul>
          <p>For a gymnastics team evaluation, tell us your child’s current level and which discipline they want to pursue.</p>
          <button type="button" className="np-button" onClick={onInquireClick}>
            Ask Our Team <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
    <InsideTheGym />
  </div>
}

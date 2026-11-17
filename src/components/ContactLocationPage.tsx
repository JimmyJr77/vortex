import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BUSINESS_FACILITY_PHOTO,
  BUSINESS_HOURS,
  BUSINESS_NAP,
  CONTACT_INQUIRY_ID,
  GOOGLE_DIRECTIONS_URL,
  GOOGLE_MAPS_URL,
  GOOGLE_REVIEW_URL,
  INSIDE_THE_GYM_ID,
  INSIDE_THE_GYM_PATH,
  PARKING_AND_ACCESSIBILITY_ID,
  SERVICE_AREAS,
  TEAM_EMAIL,
  TEAM_PHONE,
  TEAM_PHONE_E164,
} from '../config/contact'
import searchPhotos from '../config/publicSearchPhotos.json'

const { springFloor, trampoline, strengthEquipment } = searchPhotos.homepageGallery
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
      className="section-padding scroll-mt-[calc(var(--site-header-height,90px)_+_1rem)] bg-gray-50">
      <div className="container-custom">
        <h2 id="inside-the-gym-heading" className="text-3xl font-display font-bold md:text-4xl">Inside the Bowie gym</h2>
        <p className="mt-4 max-w-2xl text-gray-700">Before your first visit, confirm your class time and complete any required waivers. The photos show the training spaces at our Tesla Drive location.</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trainingSpaces.map(({ photo, heading, detail, href, label }) => (
            <article key={photo.src} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <img {...photo} width={1600} height={1066} loading="lazy" decoding="async" className="h-auto w-full" />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xl font-bold">{heading}</h3>
                <p className="mb-4 mt-2 text-gray-700">{detail}</p>
                <Link to={href} className="mt-auto font-semibold underline underline-offset-4 hover:text-vortex-red">{label}</Link>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-gray-700">Visiting for an adult class?{' '}
          <Link to="/adult-gymnastics#class-format" className="font-semibold underline underline-offset-4 hover:text-vortex-red">See what to expect in Typhoons</Link>.
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

  return <main className="min-h-screen bg-white pt-below-site-header">
    <section className="bg-gradient-to-br from-black via-gray-950 to-red-950 px-4 py-20 text-center text-white">
      <div className="container-custom max-w-4xl">
        <p className="font-bold uppercase tracking-[0.2em] text-red-300">Visit Vortex</p>
        <h1 className="mt-4 text-4xl font-display font-bold md:text-6xl">
          Contact Vortex Athletics in Bowie, MD
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-200 md:text-xl">
          Questions about{' '}
          <Link className="underline underline-offset-4" to="/gymnastics">youth gymnastics</Link>,{' '}
          <Link className="underline underline-offset-4" to="/fit-and-flip">Fit &amp; Flip youth fitness classes</Link>, or{' '}
          <Link className="underline underline-offset-4" to="/adult-gymnastics">adult gymnastics</Link>?
          {' '}Our team can help with class placement, trials, and enrollment.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <button type="button" onClick={onInquireClick} className="rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold text-white hover:bg-red-700">
            Send an Inquiry
          </button>
          <a className="py-2 font-semibold underline underline-offset-4" href={GOOGLE_DIRECTIONS_URL} target="_blank" rel="noreferrer" data-analytics-cta="get_directions" data-analytics-section="contact_intro">Get directions to Vortex</a>
          <Link className="py-2 font-semibold underline underline-offset-4" to={INSIDE_THE_GYM_PATH}>See inside the gym</Link>
        </div>
      </div>
    </section>

    <section className="section-padding">
      <div className="container-custom grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={`tel:${TEAM_PHONE_E164}`}>
          <Phone className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Call Vortex</h2>
          <p className="mt-2 text-gray-700">{TEAM_PHONE}</p>
        </a>
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={`mailto:${TEAM_EMAIL}`}>
          <Mail className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Email Our Team</h2>
          <p className="mt-2 break-words text-gray-700">{TEAM_EMAIL}</p>
        </a>
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={GOOGLE_DIRECTIONS_URL} target="_blank" rel="noreferrer">
          <MapPin className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Get Directions</h2>
          <address className="mt-2 not-italic text-gray-700">
            <strong className="font-semibold">{BUSINESS_NAP.name}</strong><br />
            {BUSINESS_NAP.streetAddress}<br />
            {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
          </address>
        </a>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <Clock3 className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Facility Hours</h2>
          <div className="mt-2 space-y-1 text-gray-700">
            {BUSINESS_HOURS.map((slot) => <p key={slot.label}>{slot.label}</p>)}
            <p>Sunday: Closed</p>
          </div>
        </div>
      </div>
      <section id={PARKING_AND_ACCESSIBILITY_ID} aria-labelledby="parking-and-accessibility-heading"
        className="container-custom mt-8 scroll-mt-[calc(var(--site-header-height,90px)_+_1rem)]">
        <h2 id="parking-and-accessibility-heading" className="text-xl font-bold">Parking and accessibility</h2>
        <p className="mt-2 max-w-2xl text-gray-700">
          Our Google Maps listing shows wheelchair-accessible parking and a wheelchair-accessible entrance at the gym.{' '}
          <a className="font-semibold underline underline-offset-4 hover:text-vortex-red" href={GOOGLE_MAPS_URL}>
            View the Google Maps listing
          </a>.
        </p>
        <p className="mt-2 max-w-2xl text-gray-700">
          For questions about access inside the gym or during class,{' '}
          <a className="font-semibold underline underline-offset-4 hover:text-vortex-red" href={`tel:${TEAM_PHONE_E164}`}>
            call us at {TEAM_PHONE}
          </a> before your visit.
        </p>
      </section>
      <p className="container-custom mt-6 text-sm text-gray-700">
        Have you or your child taken a class at Vortex?{' '}
        <a className="font-semibold underline underline-offset-4 hover:text-vortex-red" href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer">
          Share your experience on Google
        </a>.
      </p>
    </section>

    <section className="section-padding bg-gray-950 text-white">
      <div className="container-custom grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-display font-bold md:text-4xl">Our Bowie gym at Melford Town Center</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-300">
            Find Vortex at 4961 Tesla Drive, Suite E, near Routes 50 and 3. Families visit us from{' '}
            {SERVICE_AREAS.slice(0, 6).join(', ')}, and communities throughout Prince George&apos;s
            and Anne Arundel counties.
          </p>
          <p className="mt-4 leading-relaxed text-gray-300">
            Contact us before visiting if you need help choosing an age group, assessing a skill
            level, confirming current availability, or planning a first class.
          </p>
          <img {...BUSINESS_FACILITY_PHOTO}
            sizes="(min-width: 1024px) 560px, calc(100vw - 48px)"
            className="mt-6 h-auto w-full rounded-2xl" loading="lazy" decoding="async"
          />
        </div>
        <div id={CONTACT_INQUIRY_ID} className="scroll-mt-[calc(var(--site-header-height,90px)_+_1rem)] rounded-3xl bg-white/10 p-8">
          <h2 className="text-2xl font-bold">What to include in your inquiry</h2>
          <ul className="mt-5 space-y-3 text-gray-200">
            <li>• Athlete age and activity of interest</li>
            <li>• Current experience level, including complete beginners</li>
            <li>• Preferred days or general availability</li>
            <li>• Whether you are interested in a trial, drop-in, or ongoing class</li>
          </ul>
          <p className="mt-4 text-sm text-gray-200">For a gymnastics team evaluation, tell us your child’s current level and which discipline they want to pursue.</p>
          <button type="button" onClick={onInquireClick} className="mt-7 rounded-xl bg-white px-7 py-3 font-bold text-vortex-red hover:bg-gray-100">
            Ask Our Team
          </button>
        </div>
      </div>
    </section>
    <InsideTheGym />
  </main>
}

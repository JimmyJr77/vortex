import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import {
  BUSINESS_HOURS,
  BUSINESS_NAP,
  GOOGLE_MAPS_URL,
  SERVICE_AREAS,
  TEAM_EMAIL,
  TEAM_PHONE,
} from '../config/contact'

interface ContactLocationPageProps {
  onInquireClick: () => void
}

const ContactLocationPage = ({ onInquireClick }: ContactLocationPageProps) => (
  <main className="min-h-screen bg-white pt-below-site-header">
    <section className="bg-gradient-to-br from-black via-gray-950 to-red-950 px-4 py-20 text-center text-white">
      <div className="container-custom max-w-4xl">
        <p className="font-bold uppercase tracking-[0.2em] text-red-300">Visit Vortex</p>
        <h1 className="mt-4 text-4xl font-display font-bold md:text-6xl">
          Contact Vortex Athletics in Bowie, MD
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-200 md:text-xl">
          Questions about gymnastics, youth sports performance, ninja, fitness, trials, or
          enrollment? Our team will help your family find the right program and next step.
        </p>
        <button
          type="button"
          onClick={onInquireClick}
          className="mt-8 rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold text-white hover:bg-red-700"
        >
          Send an Inquiry
        </button>
      </div>
    </section>

    <section className="section-padding">
      <div className="container-custom grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={`tel:${TEAM_PHONE}`}>
          <Phone className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Call Vortex</h2>
          <p className="mt-2 text-gray-700">{TEAM_PHONE}</p>
        </a>
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={`mailto:${TEAM_EMAIL}`}>
          <Mail className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Email Our Team</h2>
          <p className="mt-2 break-words text-gray-700">{TEAM_EMAIL}</p>
        </a>
        <a className="rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-vortex-red" href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">
          <MapPin className="h-7 w-7 text-vortex-red" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-black">Get Directions</h2>
          <address className="mt-2 not-italic text-gray-700">
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
    </section>

    <section className="section-padding bg-gray-950 text-white">
      <div className="container-custom grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-display font-bold md:text-4xl">A Bowie gym serving central Maryland</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-300">
            Vortex is located near Routes 50 and 3 in Bowie. Families visit us from{' '}
            {SERVICE_AREAS.slice(0, 6).join(', ')}, and communities throughout Prince George&apos;s
            and Anne Arundel counties.
          </p>
          <p className="mt-4 leading-relaxed text-gray-300">
            Contact us before visiting if you need help choosing an age group, assessing a skill
            level, confirming current availability, or planning a first class.
          </p>
        </div>
        <div className="rounded-3xl bg-white/10 p-8">
          <h2 className="text-2xl font-bold">What to include in your inquiry</h2>
          <ul className="mt-5 space-y-3 text-gray-200">
            <li>• Athlete age and activity of interest</li>
            <li>• Current experience level, including complete beginners</li>
            <li>• Preferred days or general availability</li>
            <li>• Whether you are interested in a trial, drop-in, or ongoing class</li>
          </ul>
          <button type="button" onClick={onInquireClick} className="mt-7 rounded-xl bg-white px-7 py-3 font-bold text-vortex-red hover:bg-gray-100">
            Ask Our Team
          </button>
        </div>
      </div>
    </section>
  </main>
)

export default ContactLocationPage

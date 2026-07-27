import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Instagram,
  MoveUp,
  Route,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSiteEnrollHref } from '../../../utils/enrollSite'

interface TrampolineTumblingGymnasticsPageProps {
  onSignUpClick?: () => void
}

interface EventSection {
  name: string
  shortDescription: string
  explanation: string
  beginnerNote: string
  icon: typeof MoveUp
}

const events: EventSection[] = [
  {
    name: 'Trampoline',
    shortDescription: 'Height, rhythm, and control on a full-size trampoline.',
    explanation:
      'In trampoline, athletes perform skills on one large rectangular trampoline. Competitive routines are made of 10 connected skills, but beginners start much more simply—with straight jumps, body shapes, stopping safely, and learning to stay near the center. As athletes progress, they add flips and twists while maintaining good form and control.',
    beginnerNote:
      'Think of it as learning to bounce with purpose: every takeoff, shape, and landing is planned.',
    icon: MoveUp,
  },
  {
    name: 'Double Mini Trampoline',
    shortDescription: 'A short runway, two powerful contacts, and one controlled landing.',
    explanation:
      'The double mini trampoline is smaller than a full-size trampoline and is approached with a running start. An athlete jumps onto the sloped end, performs one skill on or over the second section, then finishes with a dismount onto a landing mat. The event blends the speed of tumbling with the lift of trampoline.',
    beginnerNote:
      'It is quick and exciting—more like a short vaulting sequence than continuous bouncing.',
    icon: Zap,
  },
  {
    name: 'Power Tumbling',
    shortDescription: 'Fast, connected acrobatics on a long spring runway.',
    explanation:
      'Power tumbling takes place on a long, narrow, spring-assisted track. Athletes connect a series of skills—such as roundoffs, handsprings, flips, and twists—without pausing. Unlike a traditional artistic gymnastics floor routine, there is no music or dance choreography. The focus is on speed, power, clean technique, and a controlled final landing.',
    beginnerNote:
      'Picture a powerful gymnastics floor pass performed down a runway built specifically for tumbling.',
    icon: Route,
  },
]

const TRAMPOLINE_REEL_URL =
  'https://www.instagram.com/reel/DJ7H3ZZCwBT/?utm_source=ig_web_button_share_sheet'
const DOUBLE_MINI_REEL_URL =
  'https://www.instagram.com/reel/DMTtYiwy5TG/?utm_source=ig_web_button_share_sheet'
const POWER_TUMBLING_REEL_URL =
  'https://www.instagram.com/reel/DSS--OEEwLS/?utm_source=ig_web_button_share_sheet'

const EventPhotoWithInstagramBanner = ({
  imageSrc,
  imageAlt,
  eventName,
  href,
}: {
  imageSrc: string
  imageAlt: string
  eventName: string
  href: string
}) => (
  <div className="space-y-3">
    <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="aspect-[3/2] h-full w-full object-cover object-center"
        loading="lazy"
        decoding="async"
      />
    </div>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-orange-400 px-5 py-4 font-bold text-white shadow-lg transition-transform duration-300 hover:scale-[1.01] focus:outline-none focus-visible:ring-4 focus-visible:ring-vortex-red focus-visible:ring-offset-4"
      aria-label={`See ${eventName} in action on Instagram (opens in a new tab)`}
    >
      <span className="flex items-center gap-3">
        <Instagram className="h-6 w-6 shrink-0" aria-hidden />
        See {eventName} in Action on Instagram
      </span>
      <ExternalLink className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </a>
  </div>
)

const TrampolineTumblingGymnasticsPage = ({
  onSignUpClick: _onSignUpClick,
}: TrampolineTumblingGymnasticsPageProps) => {
  const enrollHref = getSiteEnrollHref({ programName: 'Trampoline & Tumbling' })

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-red-950 via-black to-gray-950 pt-below-site-header text-white">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-vortex-red/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="container-custom relative z-10 grid min-h-below-site-header items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="mb-4 font-bold uppercase tracking-[0.22em] text-vortex-red">
              A Gymnastics Discipline
            </p>
            <h1 className="text-5xl font-display font-bold leading-[.95] sm:text-6xl lg:text-7xl">
              Tramp <span className="text-vortex-red">&amp;</span> Tumble
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-relaxed text-gray-200 md:text-2xl">
              Bounce higher. Tumble stronger. Learn to move through the air with confidence and
              control.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to={enrollHref}
                className="inline-flex items-center gap-2 rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-red-700"
              >
                Enroll Now
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center rounded-xl border-2 border-white px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-white/10"
              >
                All Gymnastics Programs
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
          >
            <div className="overflow-hidden rounded-3xl border-2 border-white/20 bg-black shadow-2xl">
              <img
                src="/tramp-tumble-hero.jpg"
                alt="A Vortex athlete performing a tumbling skill on the power tumbling track"
                className="aspect-[3/2] h-full w-full scale-[1.35] object-cover object-center"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-custom mx-auto max-w-5xl">
          <motion.div
            className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm md:p-12"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-vortex-red text-white">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              What is <span className="text-vortex-red">T&amp;T?</span>
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-gray-700">
              <p>
                <strong className="text-black">Tramp &amp; Tumble</strong>—often shortened to{' '}
                <strong className="text-black">T&amp;T</strong>—stands for{' '}
                <strong className="text-black">trampoline and tumbling</strong>. T&amp;T is a
                subdiscipline of gymnastics, just like artistic, rhythmic, acrobatic, and aerobic
                gymnastics.
              </p>
              <p>
                Instead of competing on bars or beam, T&amp;T athletes learn how to create height,
                rotate safely, connect acrobatic skills, and land with control. The sport includes
                three distinct events: Trampoline, Double Mini Trampoline, and Power Tumbling.
                Athletes may train recreationally, compete in one event, or compete in all three.
              </p>
              <p>
                No flipping experience is required to begin. Foundational classes start with safe
                landings, body shapes, coordination, and basic tumbling before athletes move on to
                more advanced skills.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding border-y border-gray-200 bg-gray-100">
        <div className="container-custom">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              Meet the Events
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-6xl">
              Three Ways to <span className="text-vortex-red">Fly</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Each T&amp;T event has its own equipment and rhythm, but all three build air
              awareness, power, body control, and confident landings.
            </p>
          </div>

          <div className="space-y-16 md:space-y-24">
            {events.map((event, index) => {
              const Icon = event.icon
              const reverse = index % 2 === 1

              return (
                <motion.article
                  key={event.name}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className={reverse ? 'lg:order-2' : ''}>
                    {event.name === 'Trampoline' ? (
                      <EventPhotoWithInstagramBanner
                        imageSrc="/trampoline-event.jpg"
                        imageAlt="A Vortex athlete performing an inverted skill above the trampoline"
                        eventName={event.name}
                        href={TRAMPOLINE_REEL_URL}
                      />
                    ) : event.name === 'Double Mini Trampoline' ? (
                      <EventPhotoWithInstagramBanner
                        imageSrc="/double-mini-trampoline.jpg"
                        imageAlt="A Vortex athlete performing a skill above the double mini trampoline"
                        eventName={event.name}
                        href={DOUBLE_MINI_REEL_URL}
                      />
                    ) : event.name === 'Power Tumbling' ? (
                      <EventPhotoWithInstagramBanner
                        imageSrc="/power-tumbling.jpg"
                        imageAlt="A Vortex athlete performing a tumbling skill above the power tumbling track"
                        eventName={event.name}
                        href={POWER_TUMBLING_REEL_URL}
                      />
                    ) : null}
                  </div>
                  <div className={reverse ? 'lg:order-1' : ''}>
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                      <Icon className="h-7 w-7" aria-hidden />
                    </div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                      Event {index + 1}
                    </p>
                    <h3 className="text-4xl font-display font-bold text-black md:text-5xl">
                      {event.name}
                    </h3>
                    <p className="mt-4 text-xl font-semibold leading-relaxed text-gray-800">
                      {event.shortDescription}
                    </p>
                    <p className="mt-5 text-lg leading-relaxed text-gray-600">
                      {event.explanation}
                    </p>
                    <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-white p-5 shadow-sm">
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                      <p className="font-medium leading-relaxed text-gray-700">
                        {event.beginnerNote}
                      </p>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section-padding bg-black text-white">
        <div className="container-custom text-center">
          <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
            One Complete Discipline
          </p>
          <h2 className="mx-auto max-w-4xl text-4xl font-display font-bold md:text-5xl">
            Different Events. Shared Foundations.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300">
            Trampoline teaches athletes to manage height and repeated flight. Double mini teaches
            them to turn a running approach into a quick, powerful sequence. Power tumbling teaches
            them to carry speed through connected skills. Together, the events develop a versatile
            gymnast with strong spatial awareness, coordination, confidence, and body control.
          </p>
          <Link
            to={enrollHref}
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-vortex-red px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-red-700"
          >
            Find a Tramp &amp; Tumble Class
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}

export default TrampolineTumblingGymnasticsPage

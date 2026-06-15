import { motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Sparkles,
  Star,
} from 'lucide-react'
import { SUMMER_CAMP_2026_WEEKS, SUMMER_CAMP_HIGHLIGHTS } from '../data/summerCamp2026'
import { SUMMER_CAMP_FAQS } from '../../../config/summerCampFaqs'
import { ENROLL_PATH } from '../../../config/enrollSites'
import { Link } from 'react-router-dom'


const ACCENT_STYLES = {
  red: {
    border: 'border-vortex-red',
    bg: 'bg-vortex-red',
    text: 'text-vortex-red',
    chip: 'bg-red-100 text-red-900 border-red-300',
    glow: 'shadow-red-500/30',
  },
  blue: {
    border: 'border-blue-600',
    bg: 'bg-blue-600',
    text: 'text-blue-600',
    chip: 'bg-blue-100 text-blue-900 border-blue-300',
    glow: 'shadow-blue-500/30',
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    chip: 'bg-yellow-100 text-yellow-900 border-yellow-400',
    glow: 'shadow-yellow-500/30',
  },
  emerald: {
    border: 'border-emerald-600',
    bg: 'bg-emerald-600',
    text: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    glow: 'shadow-emerald-500/30',
  },
  violet: {
    border: 'border-violet-600',
    bg: 'bg-violet-600',
    text: 'text-violet-600',
    chip: 'bg-violet-100 text-violet-900 border-violet-300',
    glow: 'shadow-violet-500/30',
  },
} as const

const STAR_COLORS = ['text-yellow-400', 'text-blue-500', 'text-vortex-red', 'text-emerald-500']

const REGISTER_NOTE =
  'When registering, do not attempt to select a class. Just register without a class and we will get ahold of you to finish the registration for camp. Thanks! We look forward to seeing your child.'

const FLOATING_STARS: Array<{
  top?: string
  left?: string
  right?: string
  bottom?: string
  size: string
  color: string
  duration: number
  delay: number
  drift: { x: number[]; y: number[] }
}> = [
  { top: '6%', left: '8%', size: 'w-5 h-5 md:w-7 md:h-7', color: STAR_COLORS[0], duration: 7, delay: 0, drift: { x: [0, 14, -10, 0], y: [0, -20, 12, 0] } },
  { top: '18%', right: '10%', size: 'w-4 h-4 md:w-6 md:h-6', color: STAR_COLORS[1], duration: 8.5, delay: 0.4, drift: { x: [0, -16, 8, 0], y: [0, 14, -18, 0] } },
  { top: '42%', left: '4%', size: 'w-6 h-6 md:w-8 md:h-8', color: STAR_COLORS[2], duration: 9, delay: 1, drift: { x: [0, 10, 18, 0], y: [0, 8, -14, 0] } },
  { top: '55%', right: '6%', size: 'w-5 h-5 md:w-7 md:h-7', color: STAR_COLORS[3], duration: 6.5, delay: 0.2, drift: { x: [0, -12, -6, 0], y: [0, -10, 16, 0] } },
  { top: '72%', left: '14%', size: 'w-4 h-4 md:w-5 md:h-5', color: STAR_COLORS[0], duration: 10, delay: 1.5, drift: { x: [0, 8, -14, 0], y: [0, 12, 6, 0] } },
  { top: '28%', left: '42%', size: 'w-3 h-3 md:w-5 md:h-5', color: STAR_COLORS[1], duration: 7.5, delay: 0.8, drift: { x: [0, -8, 12, 0], y: [0, -16, -8, 0] } },
  { top: '12%', right: '28%', size: 'w-5 h-5 md:w-6 md:h-6', color: STAR_COLORS[2], duration: 8, delay: 2, drift: { x: [0, 16, 4, 0], y: [0, 10, -12, 0] } },
  { bottom: '14%', right: '22%', size: 'w-6 h-6 md:w-8 md:h-8', color: STAR_COLORS[3], duration: 9.5, delay: 0.6, drift: { x: [0, -10, 14, 0], y: [0, -8, 10, 0] } },
]

interface SummerCamp2026LandingPageProps {
  onInquireClick?: () => void
}

function FloatingHeroStars({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`} aria-hidden>
      {FLOATING_STARS.map((star, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: star.top,
            left: star.left,
            right: star.right,
            bottom: star.bottom,
          }}
          animate={{
            x: star.drift.x,
            y: star.drift.y,
            rotate: [0, 12, -8, 0],
            opacity: [0.65, 0.95, 0.75, 0.65],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        >
          <Star className={`${star.size} fill-current ${star.color}`} />
        </motion.div>
      ))}
    </div>
  )
}

const SummerCamp2026LandingPage = ({ onInquireClick }: SummerCamp2026LandingPageProps) => {
  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-below-site-header pb-16 md:pb-24">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
            backgroundSize: '12px 12px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-900 to-vortex-red/40" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-vortex-red/20 blur-3xl" />
        <FloatingHeroStars className="z-[1]" />

        <div className="container-custom relative z-10">
          <motion.p
            className="inline-block mb-4 px-4 py-2 bg-yellow-400 text-black font-black text-sm md:text-base uppercase tracking-wider skew-x-[-3deg] shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            It&apos;s not too late!!!
          </motion.p>

          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-black uppercase leading-[0.95] mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-white drop-shadow-[0_2px_0_#000]">Gymnastics</span>
            <br />
            <span className="text-vortex-red drop-shadow-[0_3px_0_#000]">Summer Camp</span>
            <span className="block text-2xl md:text-4xl text-gray-300 font-bold mt-3 normal-case tracking-normal">
              2026 · Ages 6–14
            </span>
          </motion.h1>

          <motion.p
            className="max-w-2xl text-lg md:text-xl text-gray-300 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Vortex Gymnastics Summer Camp 2026 in Bowie, MD serves campers ages 6–14 from Prince
            George&apos;s County, Anne Arundel County, and surrounding areas. Five action-packed
            weeks blend gymnastics, sports, dance, crafts, games, and movies — a new theme every
            week so kids stay moving, learning, and having fun.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Link

              to={ENROLL_PATH}

              className="inline-flex items-center gap-2 bg-vortex-red text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-red-900/50 hover:bg-red-700 hover:scale-[1.02] transition-all"

            >

              Register now
              <ArrowRight className="w-5 h-5" />
            

            </Link>
            {onInquireClick && (
              <button
                type="button"
                onClick={onInquireClick}
                className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all"
              >
                Ask a question
              </button>
            )}
          </motion.div>
          <motion.p
            className="mt-4 max-w-2xl text-xs md:text-sm text-gray-400 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            {REGISTER_NOTE}
          </motion.p>
        </div>
      </section>

      {/* Flyer preview */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-display font-black text-center uppercase mb-8 text-vortex-red">
            Official camp flyer
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <motion.figure
              className="rounded-xl overflow-hidden border-4 border-vortex-red shadow-2xl"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img
                src="/summer-camp-2026-flyer-front.png"
                alt="Vortex Gymnastics Summer Camp 2026 flyer — front with weekly themes"
                width={793}
                height={1024}
                className="w-full h-auto"
                loading="lazy"
              />
              <figcaption className="sr-only">Summer camp flyer front</figcaption>
            </motion.figure>
            <motion.figure
              className="rounded-xl overflow-hidden border-4 border-neutral-200 shadow-2xl"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img
                src="/summer-camp-2026-flyer-back.png"
                alt="Vortex Gymnastics Summer Camp 2026 flyer — back with activity illustrations"
                width={791}
                height={1024}
                className="w-full h-auto"
                loading="lazy"
              />
              <figcaption className="sr-only">Summer camp flyer back</figcaption>
            </motion.figure>
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section className="py-14 bg-neutral-950">
        <div className="container-custom">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl md:text-3xl font-display font-bold">Every week includes</h2>
          </div>
          <ul className="flex flex-wrap gap-3">
            {SUMMER_CAMP_HIGHLIGHTS.map((item, i) => (
              <li
                key={item}
                className={`px-4 py-2 rounded-full font-semibold text-sm border-2 ${
                  i % 4 === 0
                    ? 'bg-vortex-red/20 border-vortex-red text-red-100'
                    : i % 4 === 1
                      ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                      : i % 4 === 2
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-100'
                        : 'bg-emerald-600/20 border-emerald-500 text-emerald-100'
                }`}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="py-16 md:py-20 bg-neutral-200 text-neutral-900">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-display font-black text-center uppercase mb-2 text-black">
            Weekly schedule
          </h2>
          <p className="text-center text-neutral-600 mb-10 max-w-xl mx-auto">
            Pick one week or stack several — each week has its own mix of gymnastics, sports,
            dance, and creative time.
          </p>

          <div className="space-y-6 max-w-4xl mx-auto">
            {SUMMER_CAMP_2026_WEEKS.map((week, index) => {
              const style = ACCENT_STYLES[week.accent]
              return (
                <motion.article
                  key={week.week}
                  className={`bg-white rounded-2xl border-4 ${style.border} p-6 md:p-8 shadow-lg ${style.glow}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: index * 0.06 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <span
                        className={`inline-block px-3 py-1 rounded-md text-white text-sm font-black uppercase ${style.bg}`}
                      >
                        Week {week.week}
                      </span>
                      <h3 className="text-2xl md:text-3xl font-display font-bold mt-2 flex items-center gap-2 text-black">
                        <Calendar className={`w-7 h-7 ${style.text}`} />
                        {week.dates}
                      </h3>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {week.activities.map((activity) => (
                      <li
                        key={activity}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${style.chip}`}
                      >
                        {activity}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="py-16 bg-vortex-red relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
            backgroundSize: '8px 8px',
          }}
        />
        <div className="container-custom relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-black uppercase mb-4 drop-shadow-md">
            Save your spot
          </h2>
          <p className="text-red-100 text-lg mb-8 max-w-lg mx-auto">
            Summer camp spots fill fast. Register online or reach out with questions about ages,
            weeks, or what to bring.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link

              to={ENROLL_PATH}

              className="inline-flex items-center gap-2 bg-black text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-neutral-900 transition-all"

            >

              Enroll on Jackrabbit
              <ArrowRight className="w-5 h-5" />
            

            </Link>
            {onInquireClick && (
              <button
                type="button"
                onClick={onInquireClick}
                className="inline-flex items-center gap-2 bg-white text-vortex-red px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all"
              >
                Inquire
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-14 md:py-16 bg-neutral-100 text-neutral-900">
        <div className="container-custom max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-display font-black text-center uppercase mb-8 text-vortex-red">
            Camp FAQs
          </h2>
          <div className="space-y-4">
            {SUMMER_CAMP_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-neutral-200 bg-white p-6"
              >
                <summary className="cursor-pointer list-none text-lg font-semibold text-black flex items-center justify-between gap-4">
                  {faq.question}
                  <ArrowRight className="w-5 h-5 text-vortex-red shrink-0 transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <p className="mt-4 text-neutral-700 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-14 bg-black border-t border-neutral-800">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto bg-white text-black rounded-2xl border-4 border-vortex-red p-8 md:p-10">
            <h2 className="text-2xl font-display font-bold text-vortex-red mb-6">
              Vortex Gymnastics
            </h2>
            <ul className="space-y-4 text-neutral-800">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-vortex-red shrink-0 mt-0.5" />a
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-vortex-red shrink-0" />a
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-vortex-red shrink-0" />a
              </li>
            </ul>
            <p className="mt-6 text-sm text-neutral-500">
              vortex-gymnastics.com · Summer Camp 2026
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default SummerCamp2026LandingPage

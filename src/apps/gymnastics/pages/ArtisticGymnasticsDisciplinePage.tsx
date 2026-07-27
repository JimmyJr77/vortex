import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Target, Zap, Users, Award, Route, CircleDashed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSiteEnrollHref } from '../../../utils/enrollSite'

interface ApparatusSection {
  name: string
  shortDescription: string
  explanation: string
  beginnerNote: string
  icon: typeof Route
}

const girlsApparatus: ApparatusSection[] = [
  {
    name: 'Vault',
    shortDescription: 'Speed, power, and precision from a short run to a controlled flight.',
    explanation:
      'Vault starts with a strong approach and a committed takeoff. Beginners learn body alignment, block mechanics, and controlled landings before progressions move to rotations and dynamic vaulting combinations.',
    beginnerNote:
      'Think of Vault as fast rhythm and timing: a few precise steps turn into confident skills over time.',
    icon: CircleDashed,
  },
  {
    name: 'Uneven Bars',
    shortDescription: 'Swinging lines, body shapes, and seamless transitions between heights.',
    explanation:
      'Uneven bars training focuses on swing control and handstand awareness. Athletes learn secure grips, cast-offs, transitions, and a landing-ready mindset where control is rewarded over speed.',
    beginnerNote:
      'Success on bars starts with consistency in timing and shoulder strength before advanced kips and releases.',
    icon: Route,
  },
  {
    name: 'Balance Beam',
    shortDescription: 'Tiny surfaces, huge concentration, and clean, elegant transitions.',
    explanation:
      'Beam drills start on a low beam and build balance, posture, and confidence. As athletes improve, they add acro, turns, turns in place, and series work that rewards precision under pressure.',
    beginnerNote:
      'We emphasize confidence and composure first, then layer in difficulty once movement quality is stable.',
    icon: Target,
  },
  {
    name: 'Floor Exercise',
    shortDescription: 'Tumbling combinations with choreography and expressive movement quality.',
    explanation:
      'Floor builds the full-artistic connection between tumbling and performance. Beginners begin with safe landings, jump patterns, and controlled shapes, then progress to connected skills and dance elements for routine composition.',
    beginnerNote:
      'Every routine is built to feel powerful and graceful, not rushed.',
    icon: Zap,
  },
]

const boysApparatus: ApparatusSection[] = [
  {
    name: 'Floor Exercise',
    shortDescription: 'Powerful tumbling combinations and precise rhythm through acrobatic sequences.',
    explanation:
      'Boys floor training emphasizes strength-through-speed and control. Athletes build safe, powerful run-ups and dynamic pass combinations, then layer in amplitude and consistency for event-ready routines.',
    beginnerNote:
      'Master body control and spot-check landings early; consistency comes from repetition done with confidence.',
    icon: Route,
  },
  {
    name: 'Pommel Horse',
    shortDescription: 'Rhythmic circles, handstand control, and continuous momentum.',
    explanation:
      'Pommel horse focuses on shoulder endurance, body alignment, and sustained circular motion. Beginners start with support positions and small patterns before advancing to swings, travels, and dismount prep.',
    beginnerNote:
      'Success here is built from smooth circles, not speed alone.',
    icon: CircleDashed,
  },
  {
    name: 'Still Rings',
    shortDescription: 'Strict control through holds, presses, and release transitions.',
    explanation:
      'Rings training combines static strength with controlled movement quality. Athletes progress through body tension basics, support holds, and ring-specific progressions with a heavy emphasis on shoulder safety.',
    beginnerNote:
      'Build stable rings, solid rings, repeatable holds, and only then add complexity.',
    icon: Target,
  },
  {
    name: 'Vault',
    shortDescription: 'Precision run, explosive takeoff, and dynamic repowering.',
    explanation:
      'Vault for boys emphasizes controlled approach rhythm, explosive blocking, and clean landing mechanics. Athletes develop confidence through drills, then progress to rotations and controlled difficulty.',
    beginnerNote:
      'Strong prep and safe, repeatable entries prevent bad habits and build long-term progression.',
    icon: Zap,
  },
  {
    name: 'Parallel Bars',
    shortDescription: 'Upper-body strength, swing quality, and controlled flight elements.',
    explanation:
      'Parallel bars are about body swing quality and secure hand placements. Training starts with support and kip mechanics before moving into transitions and release timing.',
    beginnerNote:
      'Focus on crisp transitions and shoulder stability to make every repetition safer and cleaner.',
    icon: CircleDashed,
  },
  {
    name: 'Horizontal Bar',
    shortDescription: 'Big swings, giant circles, and advanced release-readiness.',
    explanation:
      'The horizontal bar builds bar speed, swing mechanics, and timing for high-reward movements. Early work is focused on controlled giants, kips, and dismount shape.',
    beginnerNote:
      'We prioritize safe line quality and timing so athletes can progress to advanced skills with confidence.',
    icon: Target,
  },
]

const competitiveTeamDetails = [
  'Both boys and girls can progress into competitive pathways within the Athleticism Accelerator framework.',
  'Teams train with clear progression goals and competition readiness benchmarks by level.',
  'Our coaching team supports all athletes in balancing safety, confidence, and performance growth.',
]

interface ArtisticGymnasticsDisciplinePageProps {
  onSignUpClick?: () => void
}

const ArtisticGymnasticsDisciplinePage = ({
  onSignUpClick: _onSignUpClick,
}: ArtisticGymnasticsDisciplinePageProps) => {
  const enrollHref = getSiteEnrollHref({ programName: 'Artistic Gymnastics' })

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-red-950 via-black to-gray-950 pt-below-site-header text-white">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-vortex-red/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 grid min-h-below-site-header w-full items-center gap-8 px-6 py-16 sm:px-8 lg:grid-cols-[minmax(24rem,.8fr)_minmax(0,1.35fr)] lg:gap-x-8 lg:gap-y-0 lg:py-0 lg:pl-12 lg:pr-0">
          <motion.div
            className="order-1 mx-auto w-full max-w-2xl lg:col-start-1 lg:row-start-1 lg:mx-0 lg:justify-self-end lg:self-end"
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="mb-4 font-bold uppercase tracking-[0.22em] text-vortex-red">
              A Gymnastics Discipline
            </p>
            <h1 className="text-5xl font-display font-bold leading-[.95] sm:text-6xl lg:text-7xl">
              Artistic <span className="text-vortex-red">Gymnastics</span>
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-relaxed text-gray-200 md:text-2xl">
              Build strength, grace, and athletic precision across vault, bars, beam, and floor.
              Artistic gymnastics develops fearless athletes through consistent progression.
            </p>
          </motion.div>

          <motion.div
            className="order-2 w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100vh-var(--site-header-height))] lg:min-h-[42rem]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
          >
            <div className="relative h-full min-h-[24rem] overflow-hidden rounded-3xl border-2 border-white/20 bg-black shadow-2xl lg:rounded-l-3xl lg:rounded-r-none lg:border-y-0 lg:border-r-0">
              <img
                src="/gymnastics.jpeg"
                alt="Artistic gymnastics athlete practicing strength and form"
                className="absolute inset-0 h-full w-full scale-[1.35] object-cover object-center"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </motion.div>

          <motion.div
            className="order-3 mx-auto mt-6 flex w-full max-w-2xl flex-wrap gap-4 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:justify-self-end lg:self-start"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
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
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-5xl">
          <motion.div
            className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-12 shadow-sm"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-vortex-red text-white">
              <Users className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Boys and Girls Competitive Teams
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              Development is tracked across both competitive pathways, with clear progressions for athletes by age, level, and readiness.
            </p>
            <ul className="mt-6 space-y-3 text-lg text-gray-700">
              {competitiveTeamDetails.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      <section className="section-padding border-y border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">What We Train</p>
            <h2 className="text-4xl font-display font-bold text-black md:text-6xl">
              Girls <span className="text-vortex-red">Artistic Apparatus</span> Pathway
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Athleticism starts with strong body control, then sharpens into routine-specific skill sets
              across every Event in Girls Artistic Gymnastics.
            </p>
          </div>

          <div className="space-y-16 md:space-y-24">
            {girlsApparatus.map((event, index) => {
              const Icon = event.icon
              const reverse = index % 2 === 1

              return (
                <motion.article
                  key={event.name}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-0"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6 }}
                >
                  <div
                    className={`order-1 ${
                      reverse ? 'lg:col-start-1' : 'lg:col-start-2'
                    } lg:row-start-1 lg:self-end`}
                  >
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                      <Icon className="h-7 w-7" aria-hidden />
                    </div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                      Apparatus {index + 1}
                    </p>
                    <h3 className="text-4xl font-display font-bold text-black md:text-5xl">
                      {event.name}
                    </h3>
                    <p className="mt-4 text-xl font-semibold leading-relaxed text-gray-800">
                      {event.shortDescription}
                    </p>
                  </div>

                  <div
                    className={`order-2 ${
                      reverse ? 'lg:col-start-2' : 'lg:col-start-1'
                    } lg:row-span-2 lg:row-start-1 lg:self-center`}
                  >
                    <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
                      <img
                        src="/gymnastics.jpeg"
                        alt={`Artistic gymnastics ${event.name} discipline image`}
                        className="aspect-[3/2] h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>

                  <div
                    className={`order-3 ${
                      reverse ? 'lg:col-start-1' : 'lg:col-start-2'
                    } lg:row-start-2 lg:self-start`}
                  >
                    <p className="mt-5 text-lg leading-relaxed text-gray-700">{event.explanation}</p>
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

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              Boys and Men&apos;s Pathway
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-6xl">
              Boys <span className="text-vortex-red">Artistic Apparatus</span> Pathway
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Competitive-ready strength and precision across the six men&apos;s events, built with
              long-term progression and athlete safety in mind.
            </p>
          </div>

          <div className="space-y-16 md:space-y-24">
            {boysApparatus.map((event, index) => {
              const Icon = event.icon
              const reverse = index % 2 === 1

              return (
                <motion.article
                  key={event.name}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-0"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6 }}
                >
                  <div
                    className={`order-1 ${
                      reverse ? 'lg:col-start-1' : 'lg:col-start-2'
                    } lg:row-start-1 lg:self-end`}
                  >
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                      <Icon className="h-7 w-7" aria-hidden />
                    </div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                      Apparatus {index + 1}
                    </p>
                    <h3 className="text-4xl font-display font-bold text-black md:text-5xl">
                      {event.name}
                    </h3>
                    <p className="mt-4 text-xl font-semibold leading-relaxed text-gray-800">
                      {event.shortDescription}
                    </p>
                  </div>

                  <div
                    className={`order-2 ${
                      reverse ? 'lg:col-start-2' : 'lg:col-start-1'
                    } lg:row-span-2 lg:row-start-1 lg:self-center`}
                  >
                    <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
                      <img
                        src="/gymnastics.jpeg"
                        alt={`Artistic gymnastics ${event.name} discipline image`}
                        className="aspect-[3/2] h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>

                  <div
                    className={`order-3 ${
                      reverse ? 'lg:col-start-1' : 'lg:col-start-2'
                    } lg:row-start-2 lg:self-start`}
                  >
                    <p className="mt-5 text-lg leading-relaxed text-gray-700">{event.explanation}</p>
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
          <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">One Complete Discipline</p>
          <h2 className="mx-auto max-w-4xl text-4xl font-display font-bold md:text-5xl">
            Power, Precision, and Expression.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300">
            Artistic athletes learn through progressive difficulty, stronger body control, and refined
            performance quality. Our Athleticism Accelerator progression system helps each gymnast develop
            safely for competitive or developmental goals.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={enrollHref}
              className="inline-flex items-center gap-2 rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold transition-colors hover:bg-red-700"
            >
              Enroll Now
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Award className="h-4 w-4" aria-hidden />
            Competitive readiness for both boys and girls.
          </p>
        </div>
      </section>
    </main>
  )
}

export default ArtisticGymnasticsDisciplinePage

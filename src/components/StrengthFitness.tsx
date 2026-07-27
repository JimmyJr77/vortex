import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  Dumbbell,
  Flame,
  Scale,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react'
import { getSiteEnrollHref } from '../utils/enrollSite'

interface StrengthFitnessProps {
  onSignUpClick?: () => void
}

interface TrainingElement {
  name: string
  shortDescription: string
  explanation: string
  beginnerNote: string
  image: string
  imageAlt: string
  icon: typeof Flame
}

const trainingElements: TrainingElement[] = [
  {
    name: 'Sports Conditioning',
    shortDescription:
      'Build stamina, movement quality, and game-ready conditioning that transfers to every sport.',
    explanation:
      'Conditioning sessions train work capacity without turning practice into random fatigue. Athletes learn pacing, recovery between efforts, and how to keep movement quality high when tired—so fitness shows up in games, meets, and long training days.',
    beginnerNote:
      'Think of it as sport-ready engine work: stronger repeats, cleaner mechanics, and better durability.',
    image: '/multisport.jpeg',
    imageAlt: 'Young athletes completing sports conditioning drills at Vortex',
    icon: Flame,
  },
  {
    name: 'Body Control',
    shortDescription:
      'Develop body control through elite tumbling training on trampolines and mats.',
    explanation:
      'Body control work blends tumbling, coordination, and spatial awareness. Athletes progress from safe shapes and landings into connected skills, learning how to organize the body in the air and on the ground with confidence.',
    beginnerNote:
      'No advanced flipping experience is required—control and safe landings come first.',
    image: '/fit-and-flip.jpeg',
    imageAlt: 'Young athlete performing a flip on a trampoline at Vortex',
    icon: Activity,
  },
  {
    name: 'Speed & Agility',
    shortDescription:
      'Develop faster acceleration, sharper direction changes, and quicker reactions for every sport.',
    explanation:
      'Speed and agility blocks focus on first-step quickness, deceleration, and change-of-direction mechanics. Athletes train posture, footwork, and reactive decisions so they can move fast without losing balance or control.',
    beginnerNote:
      'Speed is coached, not just chased—clean angles and timing create faster athletes.',
    image: '/agility.jpeg',
    imageAlt: 'Athlete completing a cone agility drill at Vortex',
    icon: Wind,
  },
  {
    name: 'Strength & Explosiveness',
    shortDescription:
      'Build force, power, and resilient movement that translate into stronger athletic performance.',
    explanation:
      'Strength and explosiveness sessions develop force production and rate of force development. Athletes learn how to produce power through jumps, throws, and loaded patterns that transfer to sprinting, tumbling, and sport-specific actions.',
    beginnerNote:
      'Power is trained with intent and recovery—quality reps beat exhausted grinding.',
    image: '/strength.jpeg',
    imageAlt: 'Strength and explosiveness training at Vortex Athletics',
    icon: Zap,
  },
  {
    name: 'Mobility & Balance',
    shortDescription: 'Master flexibility, mobility, fluidity, and balance.',
    explanation:
      'Mobility and balance training expand usable range of motion and teach athletes to own positions under control. Better joint mobility and stability support safer skill progressions and more efficient movement in every sport.',
    beginnerNote:
      'Mobility is trained as athletic skill—positions you can control, not just stretch into.',
    image: '/balance.jpeg',
    imageAlt: 'Athlete developing mobility and balance at Vortex',
    icon: Scale,
  },
  {
    name: 'Lifting Fundamentals',
    shortDescription: 'Learn safe and proper techniques for strength training. 8 & up.',
    explanation:
      'Lifting fundamentals teach squat, hinge, push, and pull patterns with technique-first coaching. Athletes build barbell and free-weight literacy so strength work stays safe, progressive, and useful for long-term athletic development.',
    beginnerNote:
      'Available for ages 8 and up. Form and consistency come before load.',
    image: '/lifting-fundamentals.jpeg',
    imageAlt: 'Young athlete practicing a barbell lift at Vortex',
    icon: Dumbbell,
  },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const StrengthFitness = ({ onSignUpClick: _onSignUpClick }: StrengthFitnessProps) => {
  const enrollHref = getSiteEnrollHref({ programName: 'Fit & Flip' })

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
              Foundational Athletic Training
            </p>
            <h1 className="text-5xl font-display font-bold leading-[.95] sm:text-6xl lg:text-7xl">
              Fit <span className="text-vortex-red">&amp;</span> Flip
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-relaxed text-gray-200 md:text-2xl">
              Advanced athletics training with tumbling, coordination, and body control—built on the
              Athleticism Accelerator.
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
                src="/strength.jpeg"
                alt="Strength and explosiveness training at Vortex Athletics"
                className="absolute inset-0 h-full w-full scale-[1.15] object-cover object-center"
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
              to="/read-board#schedule"
              className="inline-flex items-center rounded-xl border-2 border-white px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-white/10"
            >
              View Class Schedule
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-5xl">
          <motion.div
            className="md:rounded-3xl md:border md:border-gray-200 md:bg-gray-50 md:p-12 md:shadow-sm"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-vortex-red text-white">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              What is <span className="text-vortex-red">Fit &amp; Flip?</span>
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-gray-700">
              <p>
                <strong className="text-black">Fit &amp; Flip</strong> is Vortex Athletic&apos;s
                foundational athletics training program. Athletes train in 1.5 hour blocks and combine
                advanced athletics training with tumbling, coordination, and body control.
              </p>
              <p>
                All training is underpinned by our Athleticism Accelerator training philosophy. Fit
                &amp; Flip trains all the below elements. Specialized training blocks also available.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding border-y border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              What We Train
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-6xl">
              Six Elements of <span className="text-vortex-red">Athletic Development</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Each block builds a different athletic quality. Together they create a complete
              foundation for sport, gymnastics, and long-term performance.
            </p>
          </div>

          <div className="space-y-16 md:space-y-24">
            {trainingElements.map((element, index) => {
              const Icon = element.icon
              const reverse = index % 2 === 1

              return (
                <motion.article
                  key={element.name}
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
                      Element {index + 1}
                    </p>
                    <h3 className="text-4xl font-display font-bold text-black md:text-5xl">
                      {element.name}
                    </h3>
                    <p className="mt-4 text-xl font-semibold leading-relaxed text-gray-800">
                      {element.shortDescription}
                    </p>
                  </div>

                  <div
                    className={`order-2 ${
                      reverse ? 'lg:col-start-2' : 'lg:col-start-1'
                    } lg:row-span-2 lg:row-start-1 lg:self-center`}
                  >
                    <div className="overflow-hidden rounded-3xl bg-black shadow-xl">
                      <img
                        src={element.image}
                        alt={element.imageAlt}
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
                    <p className="mt-5 text-lg leading-relaxed text-gray-600">
                      {element.explanation}
                    </p>
                    <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-white p-5 shadow-sm">
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                      <p className="font-medium leading-relaxed text-gray-700">
                        {element.beginnerNote}
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
            One Complete Program
          </p>
          <h2 className="mx-auto max-w-4xl text-4xl font-display font-bold md:text-5xl">
            Different Qualities. Shared Foundations.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300">
            Conditioning builds the engine. Body control organizes movement in space. Speed and
            strength create usable power. Mobility and lifting fundamentals keep progress safe and
            sustainable. Fit &amp; Flip brings those pieces together in focused 1.5 hour blocks.
          </p>
          <Link
            to={enrollHref}
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-vortex-red px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-red-700"
          >
            Find a Fit &amp; Flip Class
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}

export default StrengthFitness

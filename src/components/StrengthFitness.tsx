import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Dumbbell,
  Shield,
  Layers,
  CheckCircle2,
  Activity,
  Zap,
  Sparkles,
} from 'lucide-react'
import { getSiteEnrollHref } from '../utils/enrollSite'

interface StrengthFitnessProps {
  onSignUpClick?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const StrengthFitness = ({ onSignUpClick: _onSignUpClick }: StrengthFitnessProps) => {
  const enrollHref = getSiteEnrollHref({ programName: 'Fit & Flip' })

  const classCategories = [
    {
      title: 'HIIT / Thrash Sessions',
      description:
        'Full-body, high-intensity conditioning for work capacity and resilience.',
    },
    {
      title: 'Olympic Lifting Foundations',
      description:
        'Teaching technique, power generation, and barbell literacy.',
    },
    {
      title: 'Jump & Plyometric Classes',
      description:
        'Vertical, horizontal, and reactive force development.',
    },
    {
      title: 'Rotational & Core Power',
      description:
        'Transfer strength for throwing, striking, cutting, and sprinting.',
    },
    {
      title: 'Strength Foundations',
      description:
        'Squat, hinge, push, pull patterns—done right.',
    },
    {
      title: 'Tumbling Skills',
      description:
        'Focused skill drills for rolls, handsprings, flips, and tumbling progressions.',
      icon: Activity,
    },
    {
      title: 'Sprint Starts',
      description:
        'Explosive starts, acceleration mechanics, and first-step power development.',
      icon: Zap,
    },
  ]

  const targetProfiles = [
    'Athletes and Gymnasts who need specific skill development',
    'Gymnasts needing more lower-body power or general conditioning',
    'Ninja athletes needing rotational strength or posterior-chain work',
    'Field/court athletes needing strength exposure without specialization',
    'Athletes in off-seasons or between competitive cycles',
    'Older athletes preparing for higher training loads',
  ]

  const safetyItems = [
    'Technique-first coaching',
    'Progressive loading',
    'Emphasis on movement quality',
    'No ego lifting',
    'Integration with athlete age, experience, and other training loads',
  ]

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
              Refining the complete athlete. Targeted classes that complement Vortex programs and
              traditional sports by building specific physical capabilities and skills.
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
            className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm md:p-12"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-vortex-red text-white">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Fit &amp; Flip in the <span className="text-vortex-red">Vortex Ecosystem</span>
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-gray-700">
              <p>
                Fit &amp; Flip supports the Vortex training ecosystem with focused classes for
                specialized athletic development. These sessions target specific qualities—strength,
                jumping ability, rotational power, back handsprings, flips, and more—through short,
                intentional training blocks.
              </p>
              <p>
                Designed to supplement gymnastics, ninja, and other sports, Fit &amp; Flip reinforces
                the physical foundations that help athletes progress skills safely, efficiently, and
                with greater confidence.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding border-y border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              How It Fits
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Same DNA. <span className="text-vortex-red">Different Mission.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <motion.article
              className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm md:p-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                <Layers className="h-7 w-7" aria-hidden />
              </div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                Athleticism Accelerator
              </p>
              <h3 className="text-3xl font-display font-bold text-black md:text-4xl">
                Relationship to the Accelerator
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Fit &amp; Flip classes borrow principles from the Accelerator but are not designed to
                deliver full-spectrum athletic development on their own. The Athleticism Accelerator
                is the comprehensive, progressive system; Fit &amp; Flip is modular, focused, and
                selectable.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-gray-50 p-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                <p className="font-medium leading-relaxed text-gray-700">
                  Accelerator = full program. Fit &amp; Flip = targeted skill-specific training blocks.
                </p>
              </div>
            </motion.article>

            <motion.article
              className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm md:p-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                <Activity className="h-7 w-7" aria-hidden />
              </div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                Gymnastics &amp; Ninja
              </p>
              <h3 className="text-3xl font-display font-bold text-black md:text-4xl">
                Relationship to Gymnastics
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Fit &amp; Flip works alongside gymnastics and ninja by zeroing in on specific
                skills—back handsprings, flips, strength for bars, tumbling blocks—in a small-group
                setting. A cost-effective, focused alternative to one-on-one privates.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-gray-50 p-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                <p className="font-medium leading-relaxed text-gray-700">
                  Group focus with private-level targeting—without the full price of individual coaching.
                </p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              Modular Classes
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Class Types &amp; <span className="text-vortex-red">Training Focus</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              These are tools, not linear tracks. Pick what fits your athlete&apos;s goals.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classCategories.map((category, index) => {
              const Icon = ('icon' in category ? category.icon : Dumbbell) ?? Dumbbell
              return (
                <motion.article
                  key={category.title}
                  className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow hover:shadow-md md:p-8"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.55 }}
                  viewport={{ once: true }}
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-black">{category.title}</h3>
                  <p className="mt-3 leading-relaxed text-gray-600">{category.description}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section-padding border-y border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-5xl px-6 sm:px-8">
          <motion.div
            className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm md:p-12"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-vortex-red text-white">
              <Dumbbell className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Who Fit &amp; Flip <span className="text-vortex-red">Supports</span>
            </h2>
            <ul className="mt-8 space-y-4">
              {targetProfiles.map((profile) => (
                <li key={profile} className="flex items-start gap-3 text-lg text-gray-700">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                  <span>{profile}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="mx-auto max-w-5xl px-6 sm:px-8">
          <motion.div
            className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm md:p-12"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <Shield className="h-7 w-7" aria-hidden />
            </div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
              Not a Weight Room Free-for-All
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Safety, Coaching &amp; <span className="text-vortex-red">Intentionality</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              Parents need this. We deliver technique-first coaching with progressive loading and a
              focus on movement quality.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {safetyItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg text-gray-700">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-black text-white">
        <div className="container-custom text-center">
          <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
            Precision Training
          </p>
          <h2 className="mx-auto max-w-4xl text-4xl font-display font-bold md:text-5xl">
            Intentional Training for Modern Athletes
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-300">
            Tumbling, skill work, and strength &amp; conditioning at Vortex isn&apos;t about lifting
            more or just doing more reps. It&apos;s about intentionality and effort. Meticulous
            coaching and a focus on all aspects of body control are critical differentiators.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={enrollHref}
              className="inline-flex items-center gap-2 rounded-xl bg-vortex-red px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-red-700"
            >
              Get Started Today
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              to="/read-board#schedule"
              className="inline-flex items-center rounded-xl border-2 border-white px-10 py-4 text-lg font-bold text-white transition-colors hover:bg-white/10"
            >
              View Class Schedules
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default StrengthFitness

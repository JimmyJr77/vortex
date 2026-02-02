import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Dumbbell,
  Shield,
  Layers,
  CheckCircle,
  Activity,
  Zap,
} from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface StrengthFitnessProps {
  onSignUpClick?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const StrengthFitness = ({ onSignUpClick: _onSignUpClick }: StrengthFitnessProps) => {
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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero / Positioning Section - matches Gymnastics & Athleticism Accelerator style */}
      <section className="relative min-h-screen w-full overflow-hidden pt-20">
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={false}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {}}
          onVideoError={() => {}}
        />
        <div className="container-custom relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-center py-16 text-center">
          <motion.h1
            className="text-4xl font-display font-bold text-white md:text-6xl lg:text-7xl mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Refining the{' '}
            <span className="text-vortex-red">Complete Athlete</span>
          </motion.h1>
          <motion.p
            className="mx-auto max-w-3xl text-xl text-gray-300 md:text-2xl leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Fit & Flip classes compliment Vortex classes and other traditional sports by targeting specific physical capabilities or skills.
          </motion.p>
          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:space-x-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <motion.a
              href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red hover:text-white hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Enroll Now
            </motion.a>
            <Link
              to="/read-board#schedule"
              className="inline-flex items-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
            >
              View Class Schedule
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Flip & Fit Classes in the Vortex Ecosystem */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl mb-4">
              Flip & Fit in the{' '}
              <span className="text-vortex-red">Vortex Ecosystem</span>
            </h2>
            <p className="mx-auto max-w-3xl text-lg text-gray-700 leading-relaxed mb-6">
              Flip & Fit supports the Vortex training ecosystem by offering focused classes for specialized athletic development. These sessions target specific qualities—such as strength, jumping ability, rotational power, back handsprings, flips, and more—through short, intentional training blocks.
            </p>
            <p className="mx-auto max-w-3xl text-lg text-gray-700 leading-relaxed">
              Flip & Fit is designed to supplement gymnastics, ninja, and other sports, reinforcing the physical foundations that help athletes progress skills safely, efficiently, and with greater confidence.
            </p>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              className="rounded-3xl border-2 border-vortex-red bg-black p-8 shadow-lg md:p-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-display font-bold text-white md:text-4xl mb-4">
                Relationship to the Athleticism Accelerator
              </h2>
              <p className="text-xl font-semibold text-vortex-red mb-6">
                &ldquo;Same DNA, Different Mission&rdquo;
              </p>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                Strength & Conditioning classes borrow principles from the Accelerator but are not designed to deliver full-spectrum athletic development on their own. The Athleticism Accelerator is the comprehensive, progressive system; Strength & Conditioning is modular, focused, and selectable.
              </p>
              <div className="flex flex-col gap-4 rounded-xl border-2 border-vortex-red bg-white p-6 md:flex-row md:items-center md:justify-around">
                <div className="flex items-center gap-3">
                  <Layers className="h-10 w-10 text-vortex-red flex-shrink-0" />
                  <div>
                    <p className="font-bold text-black">Accelerator</p>
                    <p className="text-sm text-gray-600">Orchestra — full system</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-10 w-10 text-vortex-red flex-shrink-0" />
                  <div>
                    <p className="font-bold text-black">Flip & Fit Classes</p>
                    <p className="text-sm text-gray-600">Individual instruments — targeted tools</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded-3xl border-2 border-vortex-red bg-black p-8 shadow-lg md:p-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-display font-bold text-white md:text-4xl mb-4">
                Relationship to Gymnastics Classes
              </h2>
              <p className="text-xl font-semibold text-vortex-red mb-6">
                &ldquo;Group focus, private-level targeting&rdquo;
              </p>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                Flip & Fit classes work alongside our gymnastics and ninja programs by zeroing in on specific skills—back handsprings, flips, strength for bars, tumbling blocks—in a small-group setting. They are a cost-effective, focused alternative to one-on-one privates when your athlete is ready to develop specialized movements without the full price of individual coaching.
              </p>
              <div className="flex flex-col gap-4 rounded-xl border-2 border-vortex-red bg-white p-6 md:flex-row md:items-center md:justify-around">
                <div className="flex items-center gap-3">
                  <Activity className="h-10 w-10 text-vortex-red flex-shrink-0" />
                  <div>
                    <p className="font-bold text-black">Gymnastics / Ninja</p>
                    <p className="text-sm text-gray-600">Full curriculum, equipment, progressions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-10 w-10 text-vortex-red flex-shrink-0" />
                  <div>
                    <p className="font-bold text-black">Flip & Fit Classes</p>
                    <p className="text-sm text-gray-600">Targeted skill blocks — affordable alternative to 1‑on‑1s</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Class Types & Training Focus */}
      <section className="section-padding bg-gray-200">
        <div className="container-custom">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl mb-4">
              Class Types & <span className="text-vortex-red">Training Focus</span>
            </h2>
            <p className="text-xl text-gray-600 mb-2">Modular, Purpose-Driven Classes</p>
            <p className="mx-auto max-w-2xl text-lg text-gray-700 leading-relaxed">
              These are tools, not linear tracks. Pick what fits your athlete&apos;s goals.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classCategories.map((category, index) => {
              const Icon = 'icon' in category ? category.icon : Dumbbell
              return (
                <motion.div
                  key={category.title}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-vortex-red">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-black mb-2">
                    {category.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">{category.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Flip and Fit Classes Support */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl mb-4">
              Flip and Fit Classes <span className="text-vortex-red">Support</span>
            </h2>
          </motion.div>

          <ul className="mx-auto max-w-3xl space-y-4">
            {targetProfiles.map((profile, index) => (
              <motion.li
                key={profile}
                className="flex items-start gap-4 rounded-xl bg-gray-50 p-4 border border-gray-200"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <CheckCircle className="h-6 w-6 text-vortex-red flex-shrink-0 mt-0.5" />
                <span className="text-gray-800">{profile}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Safety, Coaching, and Intentionality */}
      <section className="section-padding bg-vortex-red">
        <div className="container-custom">
          <motion.div
            className="mx-auto max-w-4xl rounded-3xl border-2 border-gray-200 bg-white p-8 shadow-lg md:p-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-vortex-red">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-display font-bold text-black md:text-4xl mb-2">
                  Safety, Coaching, and <span className="text-vortex-red">Intentionality</span>
                </h2>
                <p className="text-xl font-semibold text-vortex-red">
                  Not a Weight Room Free-for-All
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Parents need this. We deliver:
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                'Technique-first coaching',
                'Progressive loading',
                'Emphasis on movement quality',
                'No ego lifting',
                'Integration with athlete age, experience, and other training loads',
              ].map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Closing Position Statement */}
      <section className="section-padding bg-white">
        <div className="container-custom text-center">
          <motion.div
            className="mx-auto max-w-4xl"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-display font-bold text-black md:text-4xl mb-6">
              Precision Training for <span className="text-vortex-red">Modern Athletes</span>
            </h2>
            <p className="text-xl text-gray-700 leading-relaxed mb-10">
              Tumbling, skill work, and strength & conditioning at Vortex isn&apos;t about lifting more or just doing more reps. It&apos;s about intentionality and effort. Meticulous coaching and a focus on all aspects of body control are critical differentiators.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex border-2 border-vortex-red bg-vortex-red px-10 py-5 text-lg font-bold text-white rounded-xl transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started Today
              </motion.a>
              <Link
                to="/read-board#schedule"
                className="inline-flex border-2 border-vortex-red bg-transparent px-10 py-5 text-lg font-bold text-vortex-red rounded-xl transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
              >
                View Class Schedules
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default StrengthFitness

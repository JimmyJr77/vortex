import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle } from 'lucide-react'

const HERO_IMAGES = [
  '/campaign_6-12_hero1.jpg',
  '/campaign_6-12_hero2.jpg',
  '/campaign_6-12_hero3.jpg',
  '/campaign_6-12_hero4.jpg',
  '/campaign_6-12_hero5.jpg',
  '/campaign_6-12_hero6.jpg',
  '/campaign_6-12_hero7.jpg',
  '/campaign_6-12_hero8.jpg',
]

const ROTATE_INTERVAL_MS = 5000

interface ArtisticGymnasticsAges6to12LandingProps {
  onSignUpClick?: () => void
}

const JACKRABBIT_URL = 'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

/**
 * Campaign 2: Artistic Gymnastics – Ages 6–12 (Beginner to Advanced)
 * Target: Parents of 6–12 year olds; wants discipline + fun, visible progress, structured advancement
 * Theme: "Build the Athlete. Build the Confidence."
 */
const ArtisticGymnasticsAges6to12Landing = ({ onSignUpClick }: ArtisticGymnasticsAges6to12LandingProps) => {
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const pathwayLevels = [
    {
      className: 'Tornadoes',
      level: 'Foundation Phase',
      focus: 'Precision before progression',
      description: 'Athletes develop alignment, strength positions, flexibility discipline, and clean mechanics. We build control first — difficulty comes later.',
    },
    {
      className: 'Cyclones',
      level: 'Refinement Phase',
      focus: 'Controlled power and resilience',
      description: 'Athletes refine walkovers, handsprings, and strength cycles while learning to train through frustration and correction.',
    },
    {
      className: 'Vortex A4 Elite',
      level: 'Performance Phase',
      focus: 'Execution under pressure',
      description: 'Advanced combinations, explosive power, technical mastery, and elevated accountability define this level.',
    },
  ]

  const vortexDifferent = [
    'Strength before difficulty',
    'Control before speed',
    'Mechanics before tricks',
  ]

  const confidenceTransfer = [
    'Focus',
    'Resilience',
    'Discipline',
    'Body awareness',
    'Injury resistance',
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Hero image rotator */}
        <div className="absolute inset-0 w-full h-full">
          {HERO_IMAGES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
              style={{
                opacity: index === heroIndex ? 1 : 0,
                zIndex: 0,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />
        <div className="absolute inset-0 z-[1]">
          <motion.div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-vortex-red/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-vortex-red/10 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="container-custom relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-center py-16 text-center">
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Serious Skill. <span className="text-vortex-red">Real Progress.</span>
          </motion.h1>
          <motion.p
            className="mx-auto max-w-3xl text-xl md:text-2xl text-gray-300 leading-relaxed mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Artistic & Rhythmic Gymnastics training for ages 6-12 — beginner through elite pathways.
          </motion.p>
          <motion.a
            href={JACKRABBIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Find the Right Level</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </motion.a>

          <motion.div
            className="flex justify-center mt-12"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
              <motion.div
                className="w-1 h-3 bg-vortex-red rounded-full mt-2"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION – Built for Progress. Built Right. (Development-focused, 6–12) */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6 text-center">
              Built for Progress. <span className="text-vortex-red">Built Right.</span>
            </h2>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-8 max-w-2xl mx-auto">
              They may be in elementary school or early middle school, but the development window is now. These are the years when strength, flexibility, body control, and mental discipline take root. You&apos;re not here for open gym. You&apos;re here because you understand something bigger: The athletes who excel are the ones who trained with intention from the start.
            </p>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-10 max-w-2xl mx-auto">
              At Vortex, we don&apos;t sell drop-in play times and we don't just run through the motion with out athletes. We run structured, development-focused environments where every movement has intention. Through a concerted focus from the athlete and the staff, we bring out the best in every athlete.
            </p>

            {/* Triplet – Every X / does Y */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { line: 'Every repetition', sub: 'refines technique.' },
                { line: 'Every progression', sub: 'builds confidence.' },
                { line: 'Every challenge', sub: 'builds resilience.' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-gray-200 rounded-2xl p-6 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <p className="text-xl font-display font-bold text-vortex-red mb-1">{item.line}</p>
                  <p className="text-lg text-gray-700">{item.sub}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xl font-semibold text-vortex-red mb-2">
                <span className="text-black">Developing athletes.</span>{' '}
                <span className="text-vortex-red">Revealing champions.</span>
              </p>
              <p className="text-xl text-gray-700">
                Built correctly from the start.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION – Clear Pathway */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.h2
            className="text-4xl md:text-5xl font-display font-bold text-black mb-4 text-center"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Clear <span className="text-vortex-red">Pathway</span>
          </motion.h2>
          <motion.div
            className="mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              At Vortex, athletes are not grouped strictly by age. Instead, they are placed by readiness. Talent, focus, coachability, and instructional capacity determine progression. Our program follows a structured progression model where foundations are built correctly, mechanics are refined intentionally, and advancement is earned through demonstrated control, strength, and consistency.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pathwayLevels.map((pathLevel, i) => (
              <motion.div
                key={pathLevel.className}
                className="bg-white rounded-2xl p-8 shadow-lg border-2 border-gray-100 hover:border-vortex-red/20 transition-all"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="text-left mb-4">
                  <h3 className="text-2xl font-display font-bold text-black">
                    {pathLevel.className}
                  </h3>
                  <p className="text-vortex-red text-lg font-sans font-normal">
                    {pathLevel.level}
                  </p>
                </div>
                <p className="text-gray-700 leading-relaxed mb-2">
                  <span className="font-bold">Focus:</span> {pathLevel.focus}
                </p>
                <p className="text-gray-700 leading-relaxed">
                  {pathLevel.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION – What Makes Vortex Different */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
              What Makes <span className="text-vortex-red">Vortex</span> Different
            </h2>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-8 max-w-3xl mx-auto">
              The details are what transform Vortex from just another gymnastics studio to a championship caliber program. That starts with fundamentals. Advancement built on weak foundations eventually collapses. When strength, control, and mechanics are developed first, higher-level skills become not just possible, but repeatable, powerful, and safe.
            </p>
            <p className="text-lg text-gray-700 mb-6 text-center">
              We train:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {vortexDifferent.map((item, i) => (
                <li key={i} className="flex items-center gap-3 bg-gray-200 rounded-xl px-6 py-4">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xl text-gray-700 text-center mb-2">
              We don&apos;t rush progress.
            </p>
            <p className="text-xl font-semibold text-center text-vortex-red">
              We build athletes correctly.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION – Confidence Transfer */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
              <span className="text-vortex-red">Confidence</span> Transfer
            </h2>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-8 max-w-3xl mx-auto">
              We push athletes to failure by design. Failure is something we embrace. Athletes learn to fail, reset, analyze, and try again with correction. This cycle of effort, failure, resilience, and refinement builds more than gymnastics skills. It builds a lifetime of discipline, composure, and confidence. Only through this cycle of failure and resilience can these young athletes maximize their talents on and off the mat.
            </p>
            <p className="text-lg text-gray-700 mb-6 text-center">
              Gymnastics improves:
            </p>
            <ul className="flex flex-wrap justify-center gap-4 mb-8">
              {confidenceTransfer.map((item, i) => (
                <li key={i} className="flex items-center gap-2 bg-white rounded-xl px-6 py-4 shadow-md">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xl font-semibold text-center text-vortex-red">
              This is athletic development that transfers to every sport.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION – CTA */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 text-black">
              Ready to build something <span className="text-vortex-red">real?</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <motion.a
                href={JACKRABBIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red border-2 border-vortex-red text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Schedule an Evaluation
              </motion.a>
              {onSignUpClick && (
                <motion.button
                  type="button"
                  onClick={onSignUpClick}
                  className="inline-block border-2 border-vortex-red bg-transparent text-vortex-red px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Have Questions? Inquire
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default ArtisticGymnasticsAges6to12Landing

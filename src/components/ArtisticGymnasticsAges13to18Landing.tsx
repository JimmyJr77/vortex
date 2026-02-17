import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from 'lucide-react'

const HERO_IMAGES = [
  '/campaign_13-18_hero1.jpg',
  '/campaign_13-18_hero2.jpg',
  '/campaign_13-18_hero3.jpg',
  '/campaign_13-18_hero4.jpg',
  '/campaign_13-18_hero5.jpg',
  '/campaign_13-18_hero6.jpg',
]

interface ArtisticGymnasticsAges13to18LandingProps {
  onSignUpClick?: () => void
}

const JACKRABBIT_URL = 'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

/**
 * Campaign 3: Artistic Gymnastics – Ages 13–18 (Advanced)
 * Target: Athletes 13–18 who want real progression
 * Theme: "Train With Purpose."
 */
const ArtisticGymnasticsAges13to18Landing = ({ onSignUpClick }: ArtisticGymnasticsAges13to18LandingProps) => {
  const elevatedFocus = [
    'Power development',
    'Advanced tumbling',
    'Strength cycles',
    'Flexibility mastery',
    'Precision execution',
  ]

  const weDevelop = [
    'Explosive strength',
    'Body control under fatigue',
    'Technical refinement',
    'Competitive confidence',
  ]

  const advancementLevels = [
    {
      title: 'Intermediate refinement',
      description: 'Building on foundations with intentional progress.',
    },
    {
      title: 'Advanced multi-skill combinations',
      description: 'Chaining skills with control and consistency.',
    },
    {
      title: 'Elite-level execution standards',
      description: 'Competition-ready precision and power.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen w-full overflow-hidden pt-20">
        {/* Scrolling images strip — same smooth scroll as /gymnastics hero */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="flex h-full gymnastics-hero-scroll"
            style={{ width: `${HERO_IMAGES.length * 2 * 100}vw` }}
          >
            {[...HERO_IMAGES, ...HERO_IMAGES].map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="h-full flex-shrink-0"
                style={{ width: '100vw', minWidth: '100vw' }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
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
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-10 mx-auto max-w-4xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Advanced artistic gymnastics training for athletes 13–18 who want real progression.
          </motion.h1>
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
            <span>Apply for Evaluation</span>
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

      {/* SECTION – Elevated Standards */}
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
              Elevated <span className="text-vortex-red">Standards</span>
            </h2>
            <p className="text-xl md:text-2xl font-display font-semibold text-gray-800 text-center mb-8">
              This isn&apos;t recreational gymnastics.
            </p>
            <p className="text-lg text-gray-700 mb-6 text-center">
              We focus on:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {elevatedFocus.map((item, i) => (
                <li key={i} className="flex items-center gap-3 bg-gray-200 rounded-xl px-6 py-4">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xl font-semibold text-center text-vortex-red">
              Athletes are expected to train with intent.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION – Why It Matters */}
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
              Why It <span className="text-vortex-red">Matters</span>
            </h2>
            <p className="text-xl font-display font-semibold text-gray-800 text-center mb-8">
              At this age, training must evolve.
            </p>
            <p className="text-lg text-gray-700 mb-6 text-center">
              We develop:
            </p>
            <ul className="flex flex-wrap justify-center gap-4 mb-8">
              {weDevelop.map((item, i) => (
                <li key={i} className="flex items-center gap-2 bg-white rounded-xl px-6 py-4 shadow-md">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xl text-gray-700 text-center">
              This builds both athletic performance and character.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION – Clear Advancement */}
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
              Clear <span className="text-vortex-red">Advancement</span>
            </h2>
            <p className="text-lg text-gray-700 text-center mb-10">
              Athletes progress through structured levels:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              {advancementLevels.map((level, i) => (
                <motion.div
                  key={i}
                  className="bg-gray-200 rounded-2xl p-8 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <h3 className="text-xl font-display font-bold text-vortex-red mb-2">{level.title}</h3>
                  <p className="text-gray-700">{level.description}</p>
                </motion.div>
              ))}
            </div>
            <p className="text-xl font-display font-bold text-black text-center mb-2">
              Vortex Class Categories
            </p>
            <p className="text-xl font-semibold text-center text-vortex-red">
              No guesswork. No stagnation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION – CTA */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 text-black">
              If you&apos;re ready to commit — we&apos;re ready to <span className="text-vortex-red">coach.</span>
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
                Schedule Assessment
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

export default ArtisticGymnasticsAges13to18Landing

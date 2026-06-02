/** Copied for vortex-gymnastics.com — hub original: src/components/Gymnastics.tsx */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import GymnasticsHeroRotatingText, {
  GymnasticsHeroIndicators,
  GYMNASTICS_HERO_SECTION_GAP,
} from '../GymnasticsHeroRotatingText'
import HeroScrollHint from '../HeroScrollHint'
import { useGymnasticsHeroRotation } from '../useGymnasticsHeroRotation'
import { GYMNASTICS_FAQS } from '../../../config/gymnasticsFaqs'
import {
  ArrowRight,
  Sparkles,
  Trophy,
  CheckCircle,
  Heart,
  Music,
  Zap,
  Users,
} from 'lucide-react'

const HERO_IMAGES = [
  '/campaign_early_dev_hero.jpg',
  '/campaign_6-12_hero1.jpg',
  '/campaign_6-12_hero2.jpg',
  '/campaign_6-12_hero3.jpg',
  '/campaign_6-12_hero4.jpg',
  '/campaign_6-12_hero5.jpg',
  '/campaign_6-12_hero6.jpg',
  '/campaign_6-12_hero7.jpg',
  '/campaign_6-12_hero8.jpg',
  '/campaign_13-18_hero1.jpg',
  '/campaign_13-18_hero2.jpg',
  '/campaign_13-18_hero3.jpg',
  '/campaign_13-18_hero4.jpg',
  '/campaign_13-18_hero5.jpg',
  '/campaign_13-18_hero6.jpg',
]

interface GymnasticsProps {
  onSignUpClick?: () => void
  onHighlightsClick?: () => void
}

const heroCtaClass =
  'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:scale-105'

const summerCampHeroCtaClass =
  `${heroCtaClass} border-2 border-yellow-400 bg-yellow-400 text-black font-bold hover:bg-yellow-300 hover:border-yellow-300 shadow-lg`

const Gymnastics = ({ onSignUpClick: _onSignUpClick, onHighlightsClick }: GymnasticsProps) => {
  const { index: heroIndex, slide: heroSlide, slides: heroSlides, setIndex: setHeroIndex } =
    useGymnasticsHeroRotation()

  const disciplines = [
    {
      id: 'artistic',
      title: 'Artistic Gymnastics',
      tagline: 'Master Movement. Build Strength. Elevate Artistry.',
      description:
        'The ultimate foundation of athletic mastery: combining grace, strength, flexibility, coordination, and control into a beautiful expression of human movement. Apparatus: vault, bars, beam, floor.',
      to: '/artistic-gymnastics',
      icon: Sparkles,
      color: 'from-vortex-red to-red-800',
    },
    {
      id: 'acro',
      title: 'Acrobatic Gymnastics (Acro)',
      tagline: 'Balance. Trust. Lift Together.',
      description:
        'Partner and group acrobatics combining balances, lifts, and dynamic skills. Athletes build trust, timing, flexibility, and strength while performing choreographed routines together.',
      to: '/acro-gymnastics',
      icon: Users,
      color: 'from-cyan-600 to-teal-800',
    },
    {
      id: 'rhythmic',
      title: 'Rhythmic Gymnastics',
      tagline: 'Grace in Motion. Strength in Every Line.',
      description:
        'The perfect balance of athletic precision and artistic flow. Athletes learn choreography, flexibility, and apparatus control (ribbon, hoop, ball, clubs, rope) while developing strength and stability.',
      to: '/rhythmic-gymnastics',
      icon: Music,
      color: 'from-purple-600 to-purple-900',
    },
    {
      id: 'trampoline-tumbling',
      title: 'Trampoline & Tumbling',
      tagline: 'Bounce Higher. Land Stronger. Tumble Smarter.',
      description:
        'Mastering air awareness and body control through trampoline, tumbling, and double-mini. Progressive skill development from safe landings and shapes to routine construction and competition.',
      to: '/trampoline-tumbling',
      icon: Zap,
      color: 'from-amber-600 to-amber-900',
    },
    {
      id: 'aerobic',
      title: 'Aerobic Gymnastics',
      tagline: 'Power. Precision. Performance.',
      description:
        'High-energy routines combining dynamic strength, flexibility, and continuous movement. Aerobic gymnastics builds cardiovascular fitness, coordination, and show-stopping group or individual performances.',
      to: '/aerobic-gymnastics',
      icon: Heart,
      color: 'from-rose-600 to-rose-900',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Single keyword-focused H1 for SEO; hero title rotates visually below. */}
      <h1 className="sr-only">Gymnastics Classes in Bowie, MD</h1>
      {/* Desktop: Full screen section with scrolling hero images */}
      <section className="hidden md:block relative min-h-below-site-header w-full overflow-hidden pt-below-site-header">
        {/* Scrolling images strip — nonstop steady scroll */}
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
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />
        <div className="container-custom relative z-10 flex justify-center min-h-below-site-header text-center px-4">
          <div className="w-full max-w-4xl flex flex-col min-h-below-site-header">
            <div
              className={`flex flex-1 flex-col items-center justify-center min-h-0 w-full ${GYMNASTICS_HERO_SECTION_GAP}`}
            >
              <GymnasticsHeroRotatingText
                slideIndex={heroIndex}
                slide={heroSlide}
                titleClassName="text-5xl md:text-7xl font-display font-bold text-white"
                descriptionClassName="text-2xl md:text-3xl text-gray-300 max-w-3xl mx-auto px-2"
              />
              <GymnasticsHeroIndicators
                slideIndex={heroIndex}
                slideCount={heroSlides.length}
                onSelectSlide={setHeroIndex}
              />
              <motion.div
                className="flex flex-col items-center justify-center w-full"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                  {onHighlightsClick && (
                    <motion.button
                      type="button"
                      onClick={onHighlightsClick}
                      className={`${heroCtaClass} border-2 border-white bg-white text-vortex-red hover:bg-white/90`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Highlights
                    </motion.button>
                  )}
                  <motion.a
                    href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${heroCtaClass} border-2 border-vortex-red bg-transparent text-vortex-red hover:bg-vortex-red/10`}
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
                  <Link to="/summer-camp-26" className={summerCampHeroCtaClass}>
                    Summer Camp
                  </Link>
                </div>
              </motion.div>
            </div>
            <div className="hidden md:flex shrink-0 justify-center pt-8 pb-10">
              <HeroScrollHint />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: Hero section with scrolling images */}
      <section className="md:hidden relative h-[60vh] w-full overflow-hidden pt-below-site-header block">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="flex h-full gymnastics-hero-scroll"
            style={{ width: `${HERO_IMAGES.length * 2 * 100}vw` }}
          >
            {[...HERO_IMAGES, ...HERO_IMAGES].map((src, i) => (
              <div
                key={`${src}-${i}-mobile`}
                className="h-full flex-shrink-0"
                style={{ width: '100vw', minWidth: '100vw' }}
              >
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />
        <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none">
          <div className="container-custom text-center w-full pointer-events-auto px-4">
            <GymnasticsHeroRotatingText
              slideIndex={heroIndex}
              slide={heroSlide}
              showDescription={false}
              titleClassName="text-4xl sm:text-5xl font-display font-bold text-white"
            />
          </div>
        </div>
      </section>

      {/* Mobile: Content section below hero */}
      <section className="md:hidden bg-gradient-to-br from-black via-gray-900 to-black py-12">
        <div className="container-custom">
          <div className={`text-center flex flex-col items-center ${GYMNASTICS_HERO_SECTION_GAP}`}>
            <GymnasticsHeroRotatingText
              slideIndex={heroIndex}
              slide={heroSlide}
              showTitle={false}
              descriptionClassName="text-xl text-gray-300 max-w-3xl mx-auto px-2"
            />
            <GymnasticsHeroIndicators
              slideIndex={heroIndex}
              slideCount={heroSlides.length}
              onSelectSlide={setHeroIndex}
            />
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 w-full"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              {onHighlightsClick && (
                <motion.button
                  type="button"
                  onClick={onHighlightsClick}
                  className={`${heroCtaClass} border-2 border-white bg-white text-vortex-red hover:bg-white/90 w-full max-w-xs`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Highlights
                </motion.button>
              )}
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className={`${heroCtaClass} border-2 border-vortex-red bg-transparent text-vortex-red hover:bg-vortex-red/10 w-full max-w-xs`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Enroll Now
              </motion.a>
              <Link
                to="/read-board#schedule"
                className="inline-flex items-center justify-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105 w-full max-w-xs"
              >
                View Class Schedule
              </Link>
              <Link
                to="/summer-camp-26"
                className={`${summerCampHeroCtaClass} w-full max-w-xs`}
              >
                Summer Camp
              </Link>
            </motion.div>
            <div className="md:hidden shrink-0 flex justify-center pt-8 pb-2">
              <HeroScrollHint />
            </div>
          </div>
        </div>
      </section>

      {/* The Art of Movement */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              The Art of <span className="text-vortex-red">Movement</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              Gymnastics is the ultimate expression of human movement: combining grace, strength, flexibility, coordination, and control. Whether on apparatus, with rhythm, in the air, or in continuous flow, every discipline builds the same foundation — body awareness, precision, and the 8 tenets of athleticism.
            </p>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              At Vortex, we use motion-based learning and progressive progressions across all disciplines. Athletes stay engaged, build skills through scaled challenges, and develop measurable progress powered by the Athleticism Accelerator.
            </p>
          </motion.div>

          {/* General levels */}
          <motion.div
            className="mt-12 pt-8 border-t border-gray-200 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <p className="text-center text-sm font-semibold text-gray-600 uppercase tracking-wide mb-6">General Levels</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
              <Link
                to="/artistic-gymnastics-early"
                className="w-full px-6 py-5 rounded-2xl bg-amber-100 text-amber-900 font-semibold text-base border-2 border-amber-300 hover:bg-amber-200 transition-colors text-left min-h-[100px] flex flex-col justify-center block"
              >
                <span className="block font-bold text-lg">Early Developmental</span>
                <span className="block text-sm font-normal opacity-90 mt-1">Dust Devils, Little Twisters</span>
              </Link>
              <Link
                to="/artistic-gymnastics-6-12"
                className="w-full px-6 py-5 rounded-2xl bg-blue-100 text-blue-900 font-semibold text-base border-2 border-blue-300 hover:bg-blue-200 transition-colors text-left min-h-[100px] flex flex-col justify-center block"
              >
                <span className="block font-bold text-lg">Beginner</span>
                <span className="block text-sm font-normal opacity-90 mt-1">Tornadoes</span>
              </Link>
              <Link
                to="/artistic-gymnastics-6-12"
                className="w-full px-6 py-5 rounded-2xl bg-vortex-red/10 text-vortex-red font-semibold text-base border-2 border-vortex-red/40 hover:bg-vortex-red/20 transition-colors text-left min-h-[100px] flex flex-col justify-center block"
              >
                <span className="block font-bold text-lg">Intermediate</span>
                <span className="block text-sm font-normal opacity-90 mt-1">Cyclones</span>
              </Link>
              <Link
                to="/artistic-gymnastics-13-18"
                className="w-full px-6 py-5 rounded-2xl bg-gray-900 text-white font-semibold text-base border-2 border-gray-700 hover:bg-gray-800 transition-colors text-left min-h-[100px] flex flex-col justify-center block"
              >
                <span className="block font-bold text-lg">Advanced</span>
                <span className="block text-sm font-normal opacity-90 mt-1">Vortex A4 Elite</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Training Pathways */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              Training <span className="text-vortex-red">Pathways</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Whether your athlete is exploring movement or pursuing competitive excellence, we have a pathway designed for their journey — in every discipline.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col min-h-[420px]"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold text-black">Developmental</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Foundational skills, strength, and confidence building through fun, engaging activities. Age-appropriate progressions, safety-first approach, and self-expression in every discipline.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Foundational skill development',
                  'Strength and flexibility building',
                  'Safety-first progressions',
                  'Fun and engaging sessions',
                ].map((item, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full mt-auto bg-blue-600 text-white px-6 py-4 rounded-xl font-bold text-center transition-all duration-300 hover:bg-blue-700 hover:scale-[1.02]"
              >
                Start Your Journey
              </motion.a>
            </motion.div>

            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col min-h-[420px]"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold text-black">Competition Team</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Progressive skill development, choreography, and routine construction for competitive athletes. Periodized training integrated with the Athleticism Accelerator for elite performance.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Progressive skill development',
                  'Choreography and routine construction',
                  'Periodized training integration',
                  'Competition preparation',
                ].map((item, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full mt-auto bg-vortex-red text-white px-6 py-4 rounded-xl font-bold text-center transition-all duration-300 hover:bg-red-700 hover:scale-[1.02]"
              >
                Join the Team
              </motion.a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Gymnastics Disciplines — Cards */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              Gymnastics <span className="text-vortex-red">Disciplines</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Explore our competitive and developmental gymnastics programs — including Acro, Artistic, Rhythmic, Trampoline & Tumbling, and Aerobic. Each discipline develops the full athlete through the Athleticism Accelerator.
            </p>
          </motion.div>
        </div>
        <div className="w-full px-4 md:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {disciplines.map((disc, index) => {
            const Icon = disc.icon
            const card = (
              <motion.div
                className={`bg-gradient-to-br ${disc.color} rounded-2xl p-6 md:p-8 text-white w-full flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-lg hover:shadow-xl transition-shadow duration-300 min-h-[220px] h-full`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ y: -2 }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-display font-bold">{disc.title}</h3>
                  </div>
                  <p className="text-white/90 font-semibold mb-2">{disc.tagline}</p>
                  <p className="text-white/85 leading-relaxed text-sm md:text-base">{disc.description}</p>
                </div>
                <div className="flex flex-col sm:flex-row flex-shrink-0 gap-3">
                  {disc.to && (
                    <Link
                      to={disc.to}
                      className="inline-flex items-center justify-center gap-2 border-2 border-white/80 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:bg-white/10 whitespace-nowrap"
                    >
                      Learn More
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  )}
                  <a
                    href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:bg-white/90 whitespace-nowrap"
                  >
                    Enroll Now
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </motion.div>
            )
            return <div key={disc.id}>{card}</div>
          })}
        </div>
      </section>

      {/* CTA - Find Your Discipline */}
      <section className="section-padding bg-white">
        <div className="container-custom text-center">
          <motion.h2
            className="text-4xl md:text-5xl font-display font-bold text-black mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Find Your <span className="text-vortex-red">Discipline</span>
          </motion.h2>
          <motion.p
            className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
          >
            Ready to start? Enroll and let us help you find the right class.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
          >
            <a
              href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-vortex-red border-2 border-vortex-red text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105"
            >
              Enroll Now
            </a>
            <Link
              to="/read-board#schedule"
              className="inline-block border-2 border-vortex-red bg-transparent text-vortex-red px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
            >
              View Class Schedules
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Summer camp promo */}
      <section className="section-padding bg-vortex-red">
        <div className="container-custom text-center">
          <motion.h2
            className="text-3xl md:text-4xl font-display font-bold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Gymnastics Summer Camp 2026
          </motion.h2>
          <p className="text-red-100 text-lg max-w-2xl mx-auto mb-6">
            Five themed weeks in Bowie, MD for ages 6–14 — gymnastics, sports, dance, crafts, and
            more.
          </p>
          <Link
            to="/summer-camp-26"
            className="inline-flex items-center gap-2 bg-white text-vortex-red px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all"
          >
            View camp schedule & register
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-padding bg-gray-50">
        <div className="container-custom max-w-3xl">
          <motion.h2
            className="text-4xl md:text-5xl font-display font-bold text-black mb-10 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Frequently Asked <span className="text-vortex-red">Questions</span>
          </motion.h2>
          <div className="space-y-4">
            {GYMNASTICS_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-gray-200 bg-white p-6"
              >
                <summary className="cursor-pointer list-none text-lg font-semibold text-black flex items-center justify-between">
                  {faq.question}
                  <ArrowRight className="w-5 h-5 text-vortex-red transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <p className="mt-4 text-gray-700 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}

export default Gymnastics

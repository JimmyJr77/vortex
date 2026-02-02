import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Sparkles,
  Trophy,
  CheckCircle,
  Music,
  Zap,
  Heart,
  Play,
} from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

// Same YouTube video as home hero when "Play Video" is clicked
const HERO_YOUTUBE_VIDEO_ID = 'bvGYBIgc_H8'

interface GymnasticsProps {
  onSignUpClick?: () => void
}

const Gymnastics = ({ onSignUpClick: _onSignUpClick }: GymnasticsProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
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
      to: null,
      icon: Heart,
      color: 'from-rose-600 to-rose-900',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid */}
      <section className="hidden md:block relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          youtubeVideoId={HERO_YOUTUBE_VIDEO_ID}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {}}
          onVideoError={() => {}}
        />
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
        <div className={`container-custom relative z-10 flex justify-center min-h-[calc(100vh-5rem)] text-center ${isVideoPlaying ? 'items-end' : 'items-center'}`}>
          <div>
            <motion.h1
              className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Gymnastics as the Foundation of <span className="text-vortex-red">Athleticism</span>
            </motion.h1>
            <motion.p
              className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              From Roman warriors to modern athletes, gymnastics remains the ultimate system for building strength, control, and movement intelligence.
            </motion.p>
            <motion.div
              className="flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
                <motion.a
                  href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
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
                {!isVideoPlaying && (
                  <motion.button
                    onClick={() => setIsVideoPlaying(true)}
                    className="inline-flex items-center gap-2 border-2 border-white bg-transparent text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-white/10 hover:scale-105"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Play video"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    Play Video
                  </motion.button>
                )}
              </div>
              <motion.div
                className="flex justify-center"
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mobile: Hero section with title only */}
      <section className="md:hidden relative h-[60vh] w-full overflow-hidden pt-20 block">
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          youtubeVideoId={HERO_YOUTUBE_VIDEO_ID}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {}}
          onVideoError={() => {}}
        />
        <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none">
          <div className="container-custom text-center w-full pointer-events-auto">
            <motion.h1
              className="text-4xl sm:text-5xl font-display font-bold text-white mb-6 px-4"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Gymnastics as the Foundation of <span className="text-vortex-red">Athleticism</span>
            </motion.h1>
          </div>
        </div>
      </section>

      {/* Mobile: Content section below hero */}
      <section className="md:hidden bg-gradient-to-br from-black via-gray-900 to-black py-12">
        <div className="container-custom">
          <div className="text-center">
            <motion.p
              className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              From Roman warriors to modern athletes, gymnastics remains the ultimate system for building strength, control, and movement intelligence.
            </motion.p>
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105 w-full max-w-xs"
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
            </motion.div>
            <motion.div
              className="flex justify-center mt-8"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
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
                className="inline-block w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold text-center transition-all duration-300 hover:bg-blue-700 hover:scale-[1.02]"
              >
                Start Your Journey
              </motion.a>
            </motion.div>

            <motion.div
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
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
                className="inline-block w-full bg-vortex-red text-white px-6 py-4 rounded-xl font-bold text-center transition-all duration-300 hover:bg-red-700 hover:scale-[1.02]"
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
              Explore our four competitive and developmental gymnastics programs. Each discipline develops the full athlete — strength, coordination, and artistry — through the Athleticism Accelerator.
            </p>
          </motion.div>
        </div>
        <div className="w-full px-4 md:px-6 lg:px-8 space-y-4">
          {disciplines.map((disc, index) => {
            const Icon = disc.icon
            const CardContent = (
              <motion.div
                key={disc.id}
                className={`bg-gradient-to-br ${disc.color} rounded-2xl p-6 md:p-8 text-white w-full flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-lg hover:shadow-xl transition-shadow duration-300`}
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
                <div className="flex-shrink-0">
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
            return CardContent
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
    </div>
  )
}

export default Gymnastics

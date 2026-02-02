import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  CheckCircle,
  Dumbbell,
  Mountain,
  Play
} from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

// Same YouTube video as home hero when "Play Video" is clicked
const HERO_YOUTUBE_VIDEO_ID = 'bvGYBIgc_H8'

interface NinjaProps {
  onSignUpClick: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Ninja = ({ onSignUpClick: _onSignUpClick }: NinjaProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  const rigFeatures = [
    'Monkey Bars & Hanging Grips',
    'Rope Climbs & Swings',
    'Transition Challenges',
    'Configurable Obstacle Layouts'
  ]

  const fitnessFeatures = [
    'Sled Pushes & Pulls',
    'Sandbags & Kettlebells',
    'Barbells & Olympic Lifts',
    'Open-Floor Conditioning'
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid */}
      <section className="hidden md:block relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Background: image by default; video on Play Video click */}
        <HeroBackgroundVideo
          videoFileName="ninja.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          youtubeVideoId={HERO_YOUTUBE_VIDEO_ID}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Ninja video ready')
          }}
          onVideoError={(error) => {
            console.error('❌ Ninja video error:', error)
          }}
        />

        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-[1]">
          <motion.div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-vortex-red/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-vortex-red/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
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
              Train Like a <span className="text-vortex-red">Ninja.</span><br />
              Perform Like an <span className="text-vortex-red">Athlete.</span>
            </motion.h1>

            <motion.p
              className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Elite fitness for dynamic obstacle maneuverability. This isn't playtime, but it's fun putting in the work.
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
                  Join a Class
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

              {/* Scroll Indicator */}
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
        {/* Background: image by default; video on Play Video click */}
        <HeroBackgroundVideo
          videoFileName="ninja.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          youtubeVideoId={HERO_YOUTUBE_VIDEO_ID}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Ninja video ready (mobile)')
          }}
          onVideoError={(error) => {
            console.error('❌ Ninja video error (mobile):', error)
          }}
        />
        
        <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none">
          <div className="container-custom text-center w-full pointer-events-auto">
          <motion.h1
            className="text-4xl sm:text-5xl font-display font-bold text-white mb-6 px-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Train Like a <span className="text-vortex-red">Ninja.</span><br />
            Perform Like an <span className="text-vortex-red">Athlete.</span>
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
              Elite fitness for dynamic obstacle maneuverability. This isn't playtime, but it's fun putting in the work.
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
                Join a Class
              </motion.a>

              <Link
                to="/read-board#schedule"
                className="inline-flex items-center justify-center gap-2 border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105 w-full max-w-xs"
              >
                View Class Schedule
              </Link>
            </motion.div>

            {/* Scroll Indicator */}
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

      {/* The Vortex Difference */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              The <span className="text-vortex-red">Vortex</span> Difference
            </h2>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              There's no gimmick — this is real athletic training built around ninja-style movement. Our 50+ foot ninja rig doubles as a functional fitness studio, supporting ninja obstacles, weightlifting platforms, and sled tracks.
            </p>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              All Ninja & Fitness athletes are immersed in a multidimensional performance system built on eight Tenets of Athleticism, delivered through ten integrated training modalities, and reinforced by six points of physiological emphasis.
            </p>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed">
              Our program transforms every obstacle into measurable progress in speed, explosiveness, and control. Regardless of age or skill level, we will provide the challenge needed for growth.
            </p>
          </motion.div>
        </div>
      </section>

      {/* The Ninja Factory */}
      <section className="section-padding bg-gray-200">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              The <span className="text-vortex-red">Ninja</span> Factory
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Two zones. One mission. Complete athletic transformation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <motion.div
              className="bg-gradient-to-br from-black to-gray-900 rounded-3xl p-8 text-white"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center">
                  <Mountain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-display font-bold text-white">The Ninja Rig</h3>
              </div>
              <p className="text-gray-300 mb-6 text-lg">
                50+ feet of obstacles designed for obstacle flow and athlete progression.
              </p>
              <ul className="space-y-3">
                {rigFeatures.map((feature, index) => (
                  <motion.li
                    key={feature}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center">
                  <Dumbbell className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-display font-bold">Fitness Zone</h3>
              </div>
              <p className="text-gray-300 mb-6 text-lg">
                Open-floor strength and conditioning designed for hybrid training.
              </p>
              <ul className="space-y-3">
                {fitnessFeatures.map((feature, index) => (
                  <motion.li
                    key={feature}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Movement + Strength Integration */}
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
              Movement + Strength <span className="text-vortex-red">Integration</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              The obstacle-heavy ninja environment merges with the science of strength to build dynamic athletes. Every lift, climb, and swing builds not just muscle, but movement intelligence. What the modern athlete needs is more like a ninja than a body builder. Train like a ninja. Build confidence, strength, and have fun overcoming challenge after challenge.
            </p>
          </motion.div>

          <div className="space-y-6 mb-12">
            {[
              {
                strengthTitle: 'Bodyweight Mastery',
                strengthDesc: 'Progressive bodyweight strength using pull-ups, dips, rope climbs, and muscle-ups to build relative strength and control.',
                movementTitle: 'Spatial Control & Flow',
                movementDesc: 'Swing timing, transitions, and controlled landings that train athletes to move efficiently and confidently through space.',
              },
              {
                strengthTitle: 'Functional Strength',
                strengthDesc: 'Real-world loading with kettlebells, sandbags, sleds, and slam balls to develop usable power and stability.',
                movementTitle: 'Stability & Load Transfer',
                movementDesc: 'Rotational patterns, unilateral work, and balance challenges that teach athletes to absorb, redirect, and control force during movement.',
              },
              {
                strengthTitle: 'Explosive Power',
                strengthDesc: 'Jumps, vaults, bar swings, and rope traverses designed to generate rapid force and elastic power.',
                movementTitle: 'Acceleration & Re-Direction',
                movementDesc: 'Takeoffs, deceleration mechanics, and rapid direction changes that convert power into speed and agility.',
              },
              {
                strengthTitle: 'Olympic Lifts',
                strengthDesc: 'Monitored, progressive weightlifting that develops maximal strength, power, and rate of force production.',
                movementTitle: 'Mobility & Motor Patterning',
                movementDesc: 'Deep-range positions, timing, and coordinated sequencing that reinforce joint mobility and efficient movement mechanics.',
              },
            ].map((pair, index) => (
              <motion.div
                key={pair.strengthTitle}
                className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border-2 border-gray-200 hover:border-vortex-red/30"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="p-6 bg-vortex-red text-white">
                  <h3 className="text-lg font-bold mb-2">{pair.strengthTitle}</h3>
                  <p className="text-sm leading-relaxed text-white/95">{pair.strengthDesc}</p>
                </div>
                <div className="p-6 bg-gray-200 text-black">
                  <h3 className="text-lg font-bold text-black mb-2">{pair.movementTitle}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{pair.movementDesc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="text-center text-xl md:text-2xl font-bold text-black"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Strength builds capacity. Movement makes it usable. Vortex trains both—together.
          </motion.p>
        </div>
      </section>

      {/* Ninja Athlete Progression Framework */}
      <section className="section-padding bg-gray-200">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              Ninja Athlete <span className="text-vortex-red">Progression Framework</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Placement is based on movement quality, strength, control, and coach evaluation — not age alone.
            </p>
          </motion.div>

          <div className="space-y-8 mb-12">
            {[
              {
                tier: 'Tornadoes',
                level: 'Beginner',
                focus: 'Fundamentals, confidence, and basic movement literacy',
                typicalAges: '~5–8 (ability dependent)',
                coreCapabilities: [
                  'Hang from a bar for 10–20 seconds',
                  'Traverse basic monkey bars with assistance or rest',
                  'Perform supported pull-up or slow negative',
                  'Jump and land with two-foot control',
                  'Crawl, climb, and step over obstacles safely',
                  'Follow movement instructions and maintain spatial awareness',
                ],
                movementMarkers: [
                  'Can move forward on obstacles without freezing',
                  'Demonstrates basic grip awareness',
                  'Shows developing balance and coordination',
                  'Comfortable being off the ground',
                ],
                outcome: 'Builds confidence, coordination, and foundational grip & body control.',
              },
              {
                tier: 'Cyclones',
                level: 'Intermediate',
                focus: 'Strength-to-movement transfer and consistency',
                typicalAges: '~7–11 (ability dependent)',
                coreCapabilities: [
                  'Dead hang 30–45 seconds',
                  'Complete full monkey bar traverse without dropping',
                  'Perform 1–3 strict pull-ups (or advanced band-assisted)',
                  'Controlled lache progression (short distance)',
                  'Single-leg jumping and controlled landings',
                  'Climb rope with feet assist or partial no-feet',
                ],
                movementMarkers: [
                  'Maintains momentum through multiple obstacles',
                  'Can re-grip, adjust, and recover mid-movement',
                  'Demonstrates basic swing timing and rhythm',
                  'Shows improving core tension and body positioning',
                ],
                outcome: 'Athletes begin to link strength, timing, and movement into fluid obstacle sequences.',
              },
              {
                tier: 'Vortex Elite',
                level: 'Advanced',
                focus: 'High-output strength, precision, and complex movement',
                typicalAges: '~10+ (ability required)',
                coreCapabilities: [
                  'Dead hang 60+ seconds',
                  'Perform 5+ strict pull-ups',
                  'Traverse advanced hanging obstacles without rest',
                  'Execute controlled lache between holds',
                  'Rope climb without feet',
                  'Maintain grip and control through fatigue',
                  'Explosive jumps with precise stick landings',
                ],
                movementMarkers: [
                  'Moves efficiently with minimal wasted motion',
                  'Demonstrates advanced swing mechanics and re-grips',
                  'Can problem-solve obstacles in real time',
                  'Maintains composure and technique under load',
                ],
                outcome: 'Athletes express strength dynamically, move with intent, and perform at a high competitive or crossover athletic level.',
              },
            ].map((program, index) => (
              <motion.div
                key={program.tier}
                className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex flex-wrap items-baseline gap-2 mb-4">
                  <h3 className="text-2xl font-display font-bold text-black">
                    Ninja Athlete – {program.tier}
                  </h3>
                  <span className="text-sm font-semibold text-vortex-red uppercase tracking-wide">
                    {program.level}
                  </span>
                </div>
                <p className="text-gray-700 font-medium mb-1">
                  <span className="text-black">Focus:</span> {program.focus}
                </p>
                <p className="text-gray-600 text-sm mb-6">
                  <span className="text-black">Typical Ages:</span> {program.typicalAges}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-lg font-bold text-black mb-3">Core Capabilities</h4>
                    <ul className="space-y-2">
                      {program.coreCapabilities.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-gray-700 text-sm">
                          <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-black mb-3">Movement Markers</h4>
                    <ul className="space-y-2">
                      {program.movementMarkers.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-gray-700 text-sm">
                          <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="text-gray-700 border-t border-gray-200 pt-4">
                  <span className="font-bold text-black">Outcome:</span> {program.outcome}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="text-center text-sm text-gray-600 max-w-2xl mx-auto italic"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            Athletes are placed based on demonstrated capability, movement quality, and coach evaluation. Age is a guide — ability determines readiness.
          </motion.p>
        </div>
      </section>

      {/* Join the Movement */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              Join the <span className="text-vortex-red">Movement</span>
            </h2>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Ready to train like a ninja and perform like an athlete? Start your transformation today.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red border-2 border-vortex-red text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join Now
              </motion.a>

              <Link
                to="/read-board#schedule"
                className="inline-block border-2 border-vortex-red bg-transparent text-vortex-red px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
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

export default Ninja

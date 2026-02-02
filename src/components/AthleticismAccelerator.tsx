import { motion } from 'framer-motion'
import { useState } from 'react'
import { Zap, Target, TrendingUp, Shield, Users, ArrowRight, Play } from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface AthleticismAcceleratorProps {
  onSignUpClick: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AthleticismAccelerator = ({ onSignUpClick: _onSignUpClick }: AthleticismAcceleratorProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const tenets = [
    { 
      name: 'Strength', 
      description: 'Ability to exert force against resistance.',
      detail: 'Building foundational power through resistance training, calisthenics, and bodyweight movements to create a robust athletic base.'
    },
    { 
      name: 'Explosiveness', 
      description: 'Exert maximal force in minimal time.',
      detail: 'Developing explosive movement capability through plyometrics, jumping drills, and fast-twitch muscle activation for superior athletic performance.'
    },
    { 
      name: 'Speed', 
      description: 'Rapid execution of movement and reaction.',
      detail: 'Enhancing neuromuscular response times and quickness through sprint work, agility drills, and reaction training.'
    },
    { 
      name: 'Agility', 
      description: 'Rapid direction changes with control.',
      detail: 'Mastering multi-directional movement with precision and balance through ladder drills, cones, and spatial awareness exercises.'
    },
    { 
      name: 'Flexibility', 
      description: 'Range of motion and muscular elasticity.',
      detail: 'Improving functional mobility and movement efficiency through targeted stretching, dynamic warm-ups, and range-of-motion exercises.'
    },
    { 
      name: 'Balance', 
      description: 'Maintain stability in static or dynamic movement.',
      detail: 'Building proprioceptive awareness through beam work, stability challenges, and single-leg exercises for superior body control.'
    },
    { 
      name: 'Coordination', 
      description: 'Integrate multiple body parts for fluid motion.',
      detail: 'Developing seamless movement patterns through complex drills, multi-plane exercises, and neural synchronization training.'
    },
    { 
      name: 'Body Control', 
      description: 'Kinematic awareness - Precise understanding of where the body is in space.',
      detail: 'Achieving exceptional spatial awareness through gymnastics-based training, air sense development, and proprioceptive exercises that translate to any sport.'
    },
  ]

  const trainingMethodologies = [
    { name: 'Resistance & Calisthenics', description: 'Foundational strength and endurance building' },
    { name: 'Plyometrics', description: 'Explosive power and fast-twitch activation' },
    { name: 'Isometrics', description: 'Tendon loading and joint stability' },
    { name: 'Eccentric/Negative Training', description: 'Controlled force development and injury prevention' },
    { name: 'Neural Training', description: 'Speed, coordination, and reaction time enhancement' },
    { name: 'Balance & Stability Work', description: 'Proprioception and spatial control' },
    { name: 'Mobility & Flexibility Drills', description: 'Full-range functional movement' },
    { name: 'Core & Body Control Work', description: 'Control, posture, and spatial awareness' },
  ]

  const benefits = [
    { icon: TrendingUp, title: 'Measurable Progress', description: 'Track improvements through data-driven metrics and AI analysis' },
    { icon: Shield, title: 'Reduced Injury Risk', description: 'Build resilient bodies through proper movement patterns and strength' },
    { icon: Target, title: 'Enhanced Performance', description: 'Outperform competitors with superior athletic capabilities' },
    { icon: Users, title: 'Multi-Sport Transfer', description: 'Skills that enhance performance in any athletic discipline' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid on video */}
      <section className="hidden md:block relative min-h-screen w-full overflow-hidden pt-20" style={{ backgroundColor: 'transparent' }}>
        {/* Background: image by default; video on Play Video click */}
        <HeroBackgroundVideo
          videoFileName="vald_sprints.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/40 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Vald sprints video ready')
          }}
          onVideoError={(error) => {
            console.error('❌ Vald sprints video error:', error)
          }}
        />

        {/* Content Container - Top Layer */}
        <div className="container-custom relative z-10 flex items-center justify-center min-h-[calc(100vh-5rem)] text-center">
          <div>
            <motion.h1
              className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Unlock the Full Spectrum of{' '}
              <span className="text-vortex-red">Athleticism</span>
            </motion.h1>

            <motion.p
              className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Train Smarter. Move Better. Compete Stronger.
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
                  className="inline-flex items-center gap-2 bg-vortex-red text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group relative overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10 flex items-center space-x-2">
                    <span>Join the Accelerator</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.a>

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

      {/* Mobile: Video section with title only */}
      <section className="md:hidden relative h-[60vh] w-full overflow-hidden pt-20 block">
        {/* Background: image by default; video on Play Video click */}
        <HeroBackgroundVideo
          videoFileName="vald_sprints.mp4"
          posterFileName="main_hero_bg.png"
          imageOnly
          playRequested={isVideoPlaying}
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Vald sprints video ready (mobile)')
          }}
          onVideoError={(error) => {
            console.error('❌ Vald sprints video error (mobile):', error)
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
            Unlock the Full Spectrum of{' '}
            <span className="text-vortex-red">Athleticism</span>
          </motion.h1>
          </div>
        </div>
      </section>

      {/* Mobile: Content section below video */}
      <section className="md:hidden bg-gradient-to-br from-black via-gray-900 to-black py-12">
        <div className="container-custom">
          <div className="text-center">
            <motion.p
              className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              Train Smarter. Move Better. Compete Stronger.
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
                className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Join the Accelerator</span>
                <ArrowRight className="w-5 h-5" />
              </motion.a>
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

      {/* Program Overview */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              THE ATHLETICISM <span className="text-vortex-red">ACCELERATOR</span>
            </h2>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-6">
              A multi-dimensional performance system built on our proprietary{' '}
              <span className="font-bold text-vortex-red">8 Tenets of Athleticism</span> and delivered through{' '}
              <span className="font-bold text-vortex-red">10 integrated training methodologies</span>.
            </p>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
              Every session—regardless of class focus—is intentionally designed to develop strength, power, speed, coordination, mobility, and neuromotor control in parallel. By aligning force production, movement mechanics, and decision-making demands, we ensure athletes don't just train isolated skills—they adapt, connect, and transform as complete performers.
            </p>
          </motion.div>

          <motion.div
            className="bg-white border-2 border-vortex-red rounded-3xl p-8 md:p-12 mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-display font-bold text-black mb-6">
              Integrated Across Every Program
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Whether your athlete is in Trampoline & Tumbling, Artistic Gymnastics, Rhythmic Gymnastics, 
              or our recreational classes, the Athleticism Accelerator principles are woven throughout their 
              training. We ensure a holistic approach to athletic development – building strength while 
              training flexibility, developing speed while enhancing balance. No athlete leaves with 
              weak links in their athletic chain.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Through biomechanics sensors, movement AI, and personalized programming, we track and adapt 
              training to maximize each athlete's potential across all eight tenets. This isn't just gymnastics 
              training – it's comprehensive athletic development that will make your child a better athlete, 
              regardless of their primary sport.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              But if you want your athlete to most fully excel in a focused training regimen geared toward athletic development, the Athletic Accelerator program is your go to training regimen. This is not a series of random workouts strung together into a program. This is a calculated and targeted development plan to get the most out of your athlete.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Training Philosophy */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              TRAINING <span className="text-vortex-red">PHILOSOPHY</span>
            </h2>
          </motion.div>

          <motion.div
            className="text-left mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
              The 8 Tenets of <span className="text-vortex-red">Athleticism</span>
            </h3>
            <p className="text-lg text-gray-700 max-w-4xl">
              Each pillar represents a critical component of elite athletic performance
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tenets.map((tenet, index) => (
              <motion.div
                key={tenet.name}
                className="bg-gray-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-vortex-red rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-vortex-red mb-2">
                      {tenet.name}
                    </h3>
                    <p className="text-gray-700 font-semibold mb-3">
                      {tenet.description}
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                      {tenet.detail}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Training Methodologies */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-left mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
              Training <span className="text-vortex-red">Methodologies</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-4xl">
              Science-backed techniques measured, tracked, and adapted with AI-driven insights
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trainingMethodologies.map((method, index) => (
              <motion.div
                key={method.name}
                className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-6 text-white"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Target className="w-8 h-8 text-vortex-red mb-4" />
                <h4 className="text-xl font-bold mb-2">{method.name}</h4>
                <p className="text-gray-300 text-sm">{method.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Physiological Emphasis */}
          <motion.div
            className="mt-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
              Physiological <span className="text-vortex-red">Emphasis</span>
            </h3>
            <p className="text-lg text-gray-700 mb-12 max-w-4xl">
              Physiological Emphasis describes the primary biological systems stressed by a drill or training block. 
              It functions as a systems-level overlay across Tenets of Athleticism and Training Methodologies.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: 'Neural Output & Readiness',
                  systems: 'Central Nervous System, Reflex Arc',
                  purpose: 'Maximize motor unit recruitment and firing speed',
                  outcomes: ['Faster reaction time', 'Improved rate of force development', 'Enhanced movement intent and explosiveness'],
                },
                {
                  name: 'Force Capacity & Tissue Capacity',
                  systems: 'Muscle, Tendon, Joint',
                  purpose: 'Build structural tolerance and force production capability',
                  outcomes: ['Strength and hypertrophy', 'Joint integrity and durability', 'Improved force absorption and expression'],
                },
                {
                  name: 'SSC & Stiffness (Elastic Energy)',
                  systems: 'Tendons, Fascia, Muscle-Tendon Unit',
                  purpose: 'Optimize stretch–shortening cycle efficiency',
                  outcomes: ['Reactive power', 'Shorter ground contact times', 'Improved elastic resilience'],
                },
                {
                  name: 'Control & Stability',
                  systems: 'Core, Proprioceptors, Stabilizing Musculature',
                  purpose: 'Maintain positional integrity under load and speed',
                  outcomes: ['Balance and postural control', 'Precision in deceleration and landing', 'Reduced injury risk'],
                },
                {
                  name: 'Perception–Action Skill (Movement Intelligence)',
                  systems: 'Brain–Body Integration',
                  purpose: 'Improve movement patterning and adaptability',
                  outcomes: ['Better timing and coordination', 'Enhanced spatial awareness', 'Transferable athletic skill across sports'],
                },
                {
                  name: 'Energy Systems & Repeatability',
                  systems: 'Aerobic and Anaerobic Energy Pathways',
                  purpose: 'Sustain movement quality over repeated efforts',
                  outcomes: ['Improved work capacity', 'Faster recovery between actions', 'Consistent performance under fatigue'],
                  optional: true,
                },
              ].map((item, index) => (
                <motion.div
                  key={item.name}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <h4 className="text-lg font-bold text-vortex-red">
                      {item.name}
                    </h4>
                    {item.optional && (
                      <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Optional</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Systems:</span> {item.systems}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-semibold">Purpose:</span> {item.purpose}
                  </p>
                  <p className="text-sm text-gray-700 font-semibold mb-1">Outcomes:</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    {item.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Training System Summary */}
          <motion.div
            className="mt-20 bg-black rounded-3xl p-12 md:p-16 text-white"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-6">
              Regimen Development <span className="text-vortex-red">Philosophy</span>
            </h3>
            <div className="max-w-4xl text-lg text-gray-300 leading-relaxed">
              <p>
                At Vortex Athletics, we don't just run drills—we build athletes with purpose. Our training system is built on three connected layers: what we develop, how we train, and why it works. First, we focus on the core Tenets of Athleticism—strength, speed, agility, coordination, balance, flexibility, explosiveness, and body control—because these qualities form the foundation of success in every sport. Next, we apply the right training methodologies, such as resistance training, plyometrics, balance work, and mobility, to develop those qualities safely and progressively. Finally, every drill is chosen with a clear physiological emphasis, meaning we intentionally train the nervous system, muscles, tendons, and movement patterns that help athletes move faster, stronger, and with better control. This layered approach ensures athletes don't just work hard—they train smart, stay healthy, and build skills that transfer to any sport, now and in the future.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding bg-gray-200">
        <div className="container-custom">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              PROGRAM <span className="text-vortex-red">BENEFITS</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bg-white rounded-2xl p-8 shadow-lg"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-vortex-red rounded-xl flex items-center justify-center">
                    <benefit.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-black mb-3">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The Vortex Difference */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="bg-black rounded-3xl p-12 md:p-16 text-white"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8 text-center">
              GYMNASTICS AS A <span className="text-vortex-red">DIFFERENTIATOR</span>
            </h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-300 leading-relaxed">
              <p>
                Gymnastics-informed athleticism at Vortex integrates traditional strength, speed, and conditioning with targeted gymnastics-based methods to enhance movement efficiency, neuromuscular control, and force application. This approach reinforces coordination, joint integrity, and spatial awareness—key determinants of how effectively athletes express strength, power, and speed under dynamic conditions.
              </p>
              <p className="text-vortex-red font-bold text-xl">
                This regimen will improve movement economy, reduce injury risk, and provide greater transfer of training to sport performance.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Join the Accelerator */}
      <section className="section-padding bg-white text-black">
        <div className="container-custom">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-10 text-black">
              JOIN THE <span className="text-vortex-red">ACCELERATOR</span>
            </h2>

            <motion.a
              href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105 shadow-2xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started Today
            </motion.a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default AthleticismAccelerator


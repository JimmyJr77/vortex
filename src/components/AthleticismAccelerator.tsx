import { motion } from 'framer-motion'
import { Zap, Target, TrendingUp, Shield, Users, ArrowRight, CheckCircle } from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface AthleticismAcceleratorProps {
  onSignUpClick: () => void
}

const AthleticismAccelerator = ({ onSignUpClick }: AthleticismAcceleratorProps) => {

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

  const programDetails = [
    'Small group or 1:1 sessions available',
    'Comprehensive assessment required before enrollment',
    'Monthly or seasonal packages available',
    'Technology-integrated training with real-time feedback',
    'AI-driven personalized progression plans',
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid on video */}
      <section className="hidden md:flex relative min-h-screen flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: 'transparent' }}>
        {/* Video Element - Bottom layer */}
        <HeroBackgroundVideo
          videoFileName="vald_sprints.mp4"
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
        <div className="container-custom relative z-10 text-center">
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
              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center space-x-3">
                  <span>Join the Accelerator</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </motion.button>

              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Book an Assessment
              </motion.button>
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
      </section>

      {/* Mobile: Video section with title only */}
      <section className="md:hidden relative h-[60vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Video Background */}
        <HeroBackgroundVideo
          videoFileName="vald_sprints.mp4"
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Vald sprints video ready (mobile)')
          }}
          onVideoError={(error) => {
            console.error('❌ Vald sprints video error (mobile):', error)
          }}
        />

        <div className="container-custom relative z-10 w-full text-center">
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
              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-8 py-4 rounded-xl font-bold text-lg shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center justify-center space-x-3">
                  <span>Join the Accelerator</span>
                  <ArrowRight className="w-5 h-5" />
                </span>
              </motion.button>

              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Book an Assessment
              </motion.button>
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
            <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
              A multi-dimensional performance program that builds the complete athlete through our 
              proprietary <span className="font-bold text-vortex-red">8 Tenets of Athleticism</span>. 
              Every session, regardless of class specialization, incorporates balanced training across 
              all facets of athletic development – ensuring your athlete doesn't just train, but transforms.
            </p>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 md:p-12 mb-16"
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
            <p className="text-lg text-gray-700 leading-relaxed">
              Through biomechanics sensors, movement AI, and personalized programming, we track and adapt 
              training to maximize each athlete's potential across all eight tenets. This isn't just gymnastics 
              training – it's comprehensive athletic development that will make your child a better athlete, 
              regardless of their primary sport.
            </p>
          </motion.div>
        </div>
      </section>

      {/* The 8 Tenets */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              THE 8 TENETS OF <span className="text-vortex-red">ATHLETICISM</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Each pillar represents a critical component of elite athletic performance
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tenets.map((tenet, index) => (
              <motion.div
                key={tenet.name}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
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
            className="text-center mb-16"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              TRAINING <span className="text-vortex-red">METHODOLOGIES</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding bg-gray-50">
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
              GYMNASTICS-FUELED <span className="text-vortex-red">ATHLETICISM</span>
            </h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-300 leading-relaxed">
              <p>
                What sets Vortex apart is our unique approach: leveraging gymnastics expertise and apparatus 
                to develop all-around athleticism. Through our Athleticism Accelerator, young athletes 
                (regardless of sport) train using <span className="font-bold text-white">gymnastics-based methods</span> 
                – tumbling exercises for coordination, ring and bar drills for upper-body and core strength, 
                trampoline work for air awareness and lower-body power, and balance drills on beams for stability.
              </p>
              <p>
                This approach builds exceptional body control, flexibility, and strength in ways that typical 
                speed ladders or weight rooms cannot fully replicate. Research shows that gymnastics training 
                at a young age leads to superior agility, balance, coordination, and strength, which collectively 
                improve neuromuscular control and proprioception.
              </p>
              <p className="text-vortex-red font-bold text-xl pt-4">
                Time spent on gymnastics drills makes children more aware of their body in space, more explosive 
                in movement, and less prone to injury – benefits that carry over to any sport.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Join the Accelerator */}
      <section className="section-padding bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="container-custom">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">
              JOIN THE <span className="text-vortex-red">ACCELERATOR</span>
            </h2>

            <div className="max-w-2xl mx-auto mb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {programDetails.map((detail, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                    <span className="text-gray-300 text-lg">{detail}</span>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105 shadow-2xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started Today
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default AthleticismAccelerator


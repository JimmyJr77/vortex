import { motion } from 'framer-motion'
import { 
  ArrowRight, 
  Target, 
  TrendingUp, 
  Shield, 
  Sparkles,
  BarChart3,
  Zap,
  CheckCircle,
  Trophy,
  Activity
} from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface ArtisticGymnasticsProps {
  onSignUpClick: () => void
}

const ArtisticGymnastics = ({ onSignUpClick }: ArtisticGymnasticsProps) => {
  const tenets = [
    { name: 'Strength', description: 'Ability to exert force against resistance.' },
    { name: 'Explosiveness', description: 'Exert maximal force in minimal time.' },
    { name: 'Speed', description: 'Rapid execution of movement and reaction.' },
    { name: 'Agility', description: 'Rapid direction changes with control.' },
    { name: 'Flexibility', description: 'Range of motion and muscular elasticity.' },
    { name: 'Balance', description: 'Maintain stability in static or dynamic movement.' },
    { name: 'Coordination', description: 'Integrate multiple body parts for fluid motion.' },
    { name: 'Body Control', description: 'Kinematic awareness - Precise understanding of where the body is in space.' },
  ]

  const benefits = [
    { 
      icon: Zap, 
      title: 'Faster Skill Development', 
      description: 'Increased apparatus exposure accelerates learning through more repetitions and muscle memory' 
    },
    { 
      icon: Target, 
      title: 'Improved Coordination', 
      description: 'Enhanced balance, spatial awareness, and body control through progressive skill building' 
    },
    { 
      icon: Shield, 
      title: 'Reduced Injury Risk', 
      description: 'Progressive conditioning and proper form precede difficulty, keeping athletes safe' 
    },
    { 
      icon: Sparkles, 
      title: 'Artistic Confidence', 
      description: 'Build self-expression and artistic flair through mastery of movement' 
    },
    { 
      icon: Activity, 
      title: 'Multi-Sport Foundation', 
      description: 'Transferable skills that enhance performance across all athletic disciplines' 
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid */}
      <section className="hidden md:block relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Video Background */}
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="landing_page_hero.png"
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Artistic gymnastics video ready')
          }}
          onVideoError={(error) => {
            console.error('❌ Artistic gymnastics video error:', error)
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

        <div className="container-custom relative z-10 flex items-center justify-center min-h-[calc(100vh-5rem)] text-center">
          <div>
            <motion.h1
              className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Master Movement. Build Strength.{' '}
              <span className="text-vortex-red">Elevate Artistry.</span>
            </motion.h1>

            <motion.p
              className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Our Artistic Gymnastics program combines the science of the Athleticism Accelerator™ with world-class equipment time and precision progressions.
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
                    <span>Book a Trial Class</span>
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
                  Join the Team
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
        </div>
      </section>

      {/* Mobile: Hero section with title only */}
      <section className="md:hidden relative h-[60vh] w-full overflow-hidden pt-20 block">
        {/* Video Background */}
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="landing_page_hero.png"
          className="absolute inset-0 w-full h-full"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {
            console.log('✅ Artistic gymnastics video ready (mobile)')
          }}
          onVideoError={(error) => {
            console.error('❌ Artistic gymnastics video error (mobile):', error)
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
            Master Movement. Build Strength.{' '}
            <span className="text-vortex-red">Elevate Artistry.</span>
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
              Our Artistic Gymnastics program combines the science of the Athleticism Accelerator™ with world-class equipment time and precision progressions.
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
                  <span>Book a Trial Class</span>
                  <ArrowRight className="w-5 h-5" />
                </span>
              </motion.button>

              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join the Team
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

      {/* The Art of Movement Section */}
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
              Artistic Gymnastics is the ultimate foundation of athletic mastery: combining grace, strength, flexibility, coordination, and control into a beautiful expression of human movement.
            </p>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              At Vortex, we use constant motion-based learning with small apparatus stations that simulate full events and keep athletes engaged. Your athlete won't wait for turns — they stay in motion, building skills through scaled, progressive challenges.
            </p>
            <div className="bg-vortex-red/10 rounded-2xl p-8 border-2 border-vortex-red/20">
              <p className="text-xl font-bold text-vortex-red mb-2">More repetitions mean faster progress — without sacrificing safety.</p>
              <p className="text-gray-700">Our rotational circuits minimize downtime and maximize learning through focused, progressive skill building.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Powered by Athleticism Accelerator */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              Powered by the <span className="text-vortex-red">Athleticism Accelerator™</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-8">
              All gymnastics training integrates our 8 Tenets of Athleticism, ensuring your athlete develops complete physical intelligence alongside artistic technique.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            {tenets.map((tenet, index) => (
              <motion.div
                key={tenet.name}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <h3 className="text-lg font-bold text-black mb-2">{tenet.name}</h3>
                <p className="text-sm text-gray-600">{tenet.description}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 md:p-12 border-2 border-vortex-red/20"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-start space-x-4 mb-6">
              <BarChart3 className="w-8 h-8 text-vortex-red flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-2xl font-bold text-black mb-3">Measurable Performance Tracking</h3>
                <p className="text-gray-700 text-lg leading-relaxed">
                  The Athleticism Accelerator™'s measurable performance tracking complements artistic technique, helping gymnasts move stronger, faster, and safer. We track progress through skill development, strength gains, and movement quality — not just competition results.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Edge: Time on Equipment */}
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
              Our Edge: <span className="text-vortex-red">Time on Equipment</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Equipment density is our key differentiator — smaller scaled apparatus means more repetitions, faster progress, and continuous engagement.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              { title: 'Scaled Beam Stations', description: 'Multiple smaller beam trainers enable constant practice without waiting' },
              { title: 'Bar Rotation Stations', description: 'High-volume repetitions on varied bar heights and widths' },
              { title: 'Soft Vault Progressions', description: 'Safe skill building through progressive vault challenges' },
              { title: 'Floor Micro-Sections', description: 'Dedicated tumbling lanes for continuous movement training' },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="bg-gradient-to-br from-black to-gray-900 rounded-3xl p-8 md:p-12 text-white"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-vortex-red mb-2">4x</div>
                <div className="text-gray-300">More equipment stations than traditional gyms</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-vortex-red mb-2">85%</div>
                <div className="text-gray-300">More time actively training</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-vortex-red mb-2">2x</div>
                <div className="text-gray-300">Faster skill progression rate</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Training Pathways */}
      <section className="section-padding bg-gray-50">
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
              Whether your athlete is exploring movement or pursuing competitive excellence, we have a pathway designed for their journey.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <h3 className="text-3xl font-display font-bold text-black">Recreation Gymnastics</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Foundational skills, strength, and confidence building through fun, engaging activities. Our recreational program focuses on shapes, balance, flexibility, and safety landings while emphasizing self-expression and enjoyment.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Foundational skill development',
                  'Strength and flexibility building',
                  'Safety-first approach to progressions',
                  'Fun and engaging sessions',
                  'Self-expression and artistic exploration'
                ].map((item, index) => (
                  <motion.li
                    key={item}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </motion.li>
                ))}
              </ul>
              <motion.button
                onClick={onSignUpClick}
                className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold transition-all duration-300 hover:bg-blue-700 hover:scale-105"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Your Journey
              </motion.button>
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
                <h3 className="text-3xl font-display font-bold text-black">Competition Team</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Progressive skill development, choreography, and routine construction for competitive athletes. Our team program integrates periodized training with the Athleticism Accelerator™ for elite performance.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Progressive skill development',
                  'Choreography and routine construction',
                  'Periodized training integration',
                  'Personalized conditioning plans',
                  'Optimized time-on-apparatus ratios'
                ].map((item, index) => (
                  <motion.li
                    key={item}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </motion.li>
                ))}
              </ul>
              <motion.button
                onClick={onSignUpClick}
                className="w-full bg-vortex-red text-white px-6 py-4 rounded-xl font-bold transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Join the Team
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Training Methodology */}
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
              Training <span className="text-vortex-red">Methodology</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Our micro-progression system uses small apparatus and repetitive motion to accelerate growth while maintaining safety and proper form.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[
              {
                title: 'Incremental Systems',
                description: 'Scaled drills for bars, beam, vault, and floor ensure athletes progress at their optimal rate without skipping foundational steps.',
                icon: TrendingUp
              },
              {
                title: 'Controlled Volume',
                description: 'Athletes train smarter with more reps and less fatigue through strategic rest and progression management.',
                icon: Zap
              },
              {
                title: 'Data & Feedback',
                description: 'Skill tracking and measurable improvement through the Athleticism Accelerator™ provide clear progress indicators.',
                icon: BarChart3
              },
              {
                title: 'Continuous Movement',
                description: 'Fewer idle moments mean greater neural adaptation and skill retention through sustained engagement.',
                icon: Activity
              },
            ].map((methodology, index) => (
              <motion.div
                key={methodology.title}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-vortex-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <methodology.icon className="w-6 h-6 text-vortex-red" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-black mb-3">{methodology.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{methodology.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety & Coaching Excellence */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-start space-x-4 mb-6">
              <Shield className="w-12 h-12 text-vortex-red flex-shrink-0" />
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
                  Safety & Coaching <span className="text-vortex-red">Excellence</span>
                </h2>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 md:p-12 border-2 border-gray-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Certified Excellence</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Our coaches are certified and trained in biomechanics, safe progressions, and youth development. They understand the science behind movement and how to keep athletes safe while pushing boundaries.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Long-Term Body Care</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Warm-ups and cool-downs are designed around joint health and long-term athletic development. We prioritize consistency and form over difficulty, ensuring your athlete develops sustainably.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Progressive Safety</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Every skill builds on the last. We don't rush progressions or skip steps — athletes master each level before advancing, reducing injury risk and building true competence.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Program Benefits */}
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
              Program <span className="text-vortex-red">Benefits</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              What your athlete will gain from Artistic Gymnastics at Vortex
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-16 h-16 bg-vortex-red/10 rounded-2xl flex items-center justify-center mb-6">
                  <benefit.icon className="w-8 h-8 text-vortex-red" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join the Program */}
      <section className="section-padding bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="container-custom">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
              Join the <span className="text-vortex-red">Program</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Ready to start your artist gymnastics journey? Choose your path and let's begin.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
                <h3 className="text-xl font-bold text-white mb-3">Recreational</h3>
                <p className="text-gray-300 mb-4">Ages 5–18</p>
                <p className="text-gray-400 text-sm">Skill-level based groups with focus on fun and fundamentals.</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
                <h3 className="text-xl font-bold text-white mb-3">Competitive</h3>
                <p className="text-gray-300 mb-4">By Evaluation</p>
                <p className="text-gray-400 text-sm">Coach placement and structured team progression for competitive athletes.</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/20">
                <h3 className="text-xl font-bold text-white mb-3">Both Pathways</h3>
                <p className="text-gray-300 mb-4">Integrated</p>
                <p className="text-gray-400 text-sm">All athletes benefit from the Athleticism Accelerator™ methodology.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center space-x-3">
                  <span>Schedule an Assessment</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </span>
              </motion.button>

              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                View Class Schedule
              </motion.button>
            </div>

            <p className="text-gray-400 text-sm mt-8">
              Questions about our programs? Contact us to learn more about how the Athleticism Accelerator™ elevates every athlete's journey.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default ArtisticGymnastics

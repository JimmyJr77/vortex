import { motion } from 'framer-motion'
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  TrendingUp, 
  Target,
  BarChart3,
  Activity,
  CheckCircle,
  Dumbbell,
  Flame,
  Award,
  Cpu
} from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface NinjaProps {
  onSignUpClick: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Ninja = ({ onSignUpClick: _onSignUpClick }: NinjaProps) => {
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
      icon: Dumbbell, 
      title: 'Full-Body Strength', 
      description: 'Build lean power and functional strength through bodyweight mastery and progressive loading' 
    },
    { 
      icon: Target, 
      title: 'Grip & Balance', 
      description: 'Enhance grip, core stability, and dynamic balance transferable to any sport' 
    },
    { 
      icon: Flame, 
      title: 'Mental Toughness', 
      description: 'Develop problem-solving under fatigue and unshakeable confidence through challenge' 
    },
    { 
      icon: Zap, 
      title: 'Real Results', 
      description: 'Experience measurable progress, fun, and authentic achievement through disciplined training' 
    },
    { 
      icon: Activity, 
      title: 'Functional Movement', 
      description: 'Learn efficient, purposeful motion — not random exercise, but movement intelligence' 
    },
  ]

  const rigFeatures = [
    'Monkey Bars & Hanging Grips',
    'Warped Wall & Vaults',
    'Rope Climbs & Swings',
    'Transition Challenges',
    'Configurable Obstacle Layouts'
  ]

  const fitnessFeatures = [
    'Sled Pushes & Pulls',
    'Sandbags & Kettlebells',
    'Barbells & Olympic Lifts',
    'Suspension Systems',
    'Open-Floor Conditioning'
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid */}
      <section className="hidden md:block relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Video Background */}
        <HeroBackgroundVideo
          videoFileName="ninja.mp4"
          posterFileName="landing_page_hero.png"
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

        <div className="container-custom relative z-10 flex items-center justify-center min-h-[calc(100vh-5rem)] text-center">
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
              Where strength, agility, and skill meet science — powered by the Athleticism Accelerator™.
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
                  className="inline-block bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group relative overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10 flex items-center space-x-3">
                    <span>Join a Class</span>
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.a>

                <motion.a
                  href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Take a Tour of the Rig
                </motion.a>
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
          videoFileName="ninja.mp4"
          posterFileName="landing_page_hero.png"
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
              Where strength, agility, and skill meet science — powered by the Athleticism Accelerator™.
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
                className="inline-block bg-vortex-red text-white px-8 py-4 rounded-xl font-bold text-lg shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center justify-center space-x-3">
                  <span>Join a Class</span>
                  <ArrowRight className="w-5 h-5" />
                </span>
              </motion.a>

              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 w-full max-w-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Take a Tour of the Rig
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

      {/* The Vortex Difference */}
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
              The <span className="text-vortex-red">Vortex</span> Difference
            </h2>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              There's no gimmick — this is real athletic training built around ninja-style movement. Our 50+ foot ninja rig doubles as a functional fitness studio, supporting ninja obstacles, weightlifting platforms, sled tracks, and suspension systems.
            </p>
            <div className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 border-2 border-vortex-red/20">
              <p className="text-xl font-bold text-vortex-red mb-2">
                Every athlete trains like a ninja — every ninja trains like an athlete.
              </p>
              <p className="text-gray-700">
                Unlike typical obstacle courses, our Ninja & Fitness program is a complete athletic performance ecosystem combining bodyweight mastery, functional strength, and obstacle-based movement.
              </p>
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
              All Ninja & Fitness athletes are immersed in our AA system built on the 8 Tenets of Athleticism. The Accelerator transforms every obstacle into measurable progress in speed, explosiveness, and control.
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
                <h3 className="text-2xl font-bold text-black mb-3">Data-Driven Assessment</h3>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Our measurement system ensures balanced development across all skill domains. Every climb, swing, and lift is tracked to maximize athletic progress.
                </p>
              </div>
            </div>
          </motion.div>
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
              Movement + <span className="text-vortex-red">Strength</span> Integration
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-4">
              The ninja environment merges with fitness science to build complete athletes.
            </p>
            <div className="bg-vortex-red/10 rounded-2xl p-6 border-2 border-vortex-red/20 inline-block">
              <p className="text-xl font-bold text-vortex-red">
                "Every lift, climb, and swing builds not just muscle — but movement intelligence."
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Bodyweight Mastery',
                description: 'Pull-ups, dips, rope climbs, muscle-ups — master your own body weight through progressive challenges.',
                icon: Activity
              },
              {
                title: 'Functional Strength',
                description: 'Slam balls, kettlebells, sandbags, and sleds build real-world power and stability.',
                icon: Dumbbell
              },
              {
                title: 'Explosive Power',
                description: 'Box jumps, bar swings, vaults, and rope traverses develop rapid force generation.',
                icon: Zap
              },
              {
                title: 'Olympic Lifts',
                description: 'Monitored, progressive weight development complements mobility and speed.',
                icon: TrendingUp
              },
            ].map((methodology, index) => (
              <motion.div
                key={methodology.title}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-12 h-12 bg-vortex-red/10 rounded-xl flex items-center justify-center mb-4">
                  <methodology.icon className="w-6 h-6 text-vortex-red" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">{methodology.title}</h3>
                <p className="text-gray-600 leading-relaxed">{methodology.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The Rig & Studio Environment */}
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
              The Rig & <span className="text-vortex-red">Studio</span> Environment
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
                  <Cpu className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-display font-bold">The Ninja Rig</h3>
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

      {/* How Gymnastics + Athleticism Create Ninjas */}
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
              How Gymnastics + Athleticism <span className="text-vortex-red">Create Ninjas</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              Gymnastics and ninja are complementary disciplines. Gymnastics develops precision, body control, and core strength. Ninja training channels those traits into creative motion — swinging, climbing, vaulting, balancing.
            </p>
            <div className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 border-2 border-vortex-red/20">
              <Award className="w-12 h-12 text-vortex-red mx-auto mb-4" />
              <p className="text-2xl font-bold text-vortex-red mb-2">
                "Gymnastics gives the control. Fitness builds the strength. The Accelerator creates the athlete."
              </p>
              <p className="text-gray-700 text-lg">
                Together with the Athleticism Accelerator™, athletes build unmatched spatial control, tendon strength, and coordination.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Program Experience */}
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
              Program <span className="text-vortex-red">Experience</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Open to all athletes seeking strength, skill, and measurable progress
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              { title: 'Ages 7–18', description: 'Recreational and competitive pathways for youth athletes' },
              { title: 'Adult Fitness', description: 'Optional adult fitness classes for continued development' },
              { title: 'Circuit Training', description: 'Move through skill zones: strength → speed → obstacle' },
            ].map((experience, index) => (
              <motion.div
                key={experience.title}
                className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <h3 className="text-2xl font-bold text-black mb-3">{experience.title}</h3>
                <p className="text-gray-600 leading-relaxed">{experience.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 md:p-12 border-2 border-vortex-red/20"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold text-black mb-4">Training Formats</h3>
                <ul className="space-y-3">
                  {[
                    'Small-group sessions',
                    'Open-gym training time',
                    'Private coaching available',
                    'Optional competitive events'
                  ].map((item) => (
                    <li key={item} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-black mb-4">Performance Tracking</h3>
                <ul className="space-y-3">
                  {[
                    'AA measurement integration',
                    'Skill progression tracking',
                    'Strength assessment data',
                    'Athlete development reports'
                  ].map((item) => (
                    <li key={item} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
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
              Real <span className="text-vortex-red">Results</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              What ninja & fitness training delivers for every athlete
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

      {/* Safety & Coaching */}
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
                  Safety & <span className="text-vortex-red">Coaching</span>
                </h2>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 md:p-12 border-2 border-gray-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Certified Excellence</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Certified strength and conditioning coaches plus gymnastics instructors ensure every athlete trains safely and effectively.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Progressive Skill System</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Safe obstacle mastery through systematic progression. We prioritize proper form, joint protection, and appropriate spotting for complex movements.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Transparent Training</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Parental viewing encouraged. All sessions tracked in the AA system with comprehensive athlete development reports.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Join the Movement */}
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
              Join the <span className="text-vortex-red">Movement</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Ready to train like a ninja and perform like an athlete? Start your transformation today.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center space-x-3">
                  <span>Book a Trial Class</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </span>
              </motion.a>

              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                View the Ninja Rig in Action
              </motion.a>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Flexible membership options: open-gym, small group, or private coaching<br />
              Learn more about the Athleticism Accelerator™ and how it powers every athlete's journey.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Ninja

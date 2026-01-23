import { motion } from 'framer-motion'
import { 
  ArrowRight, 
  Sparkles,
  TrendingUp, 
  Shield, 
  Heart,
  BarChart3,
  Zap,
  CheckCircle,
  Music,
  Activity,
  Award,
  Target
} from 'lucide-react'

interface RhythmicGymnasticsProps {
  onSignUpClick: () => void
}

const RhythmicGymnastics = ({ onSignUpClick }: RhythmicGymnasticsProps) => {
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
      icon: Sparkles, 
      title: 'Posture & Spatial Awareness', 
      description: 'Develops exceptional body awareness, posture, and understanding of space through rhythmic movement' 
    },
    { 
      icon: Music, 
      title: 'Fine Motor Control', 
      description: 'Builds precise timing, dexterity, and apparatus control through repetitive skill practice' 
    },
    { 
      icon: Heart, 
      title: 'Confidence & Expression', 
      description: 'Enhances self-expression and artistic confidence through choreographed performances' 
    },
    { 
      icon: Zap, 
      title: 'AA Cross-Training', 
      description: 'Reinforces strength and coordination through integrated Athleticism Accelerator™ training' 
    },
    { 
      icon: Target, 
      title: 'Multi-Sport Transfer', 
      description: 'Creates a physical foundation transferable to dance, cheer, and acrobatics' 
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop: Full screen section with everything overlaid */}
      <section className="hidden md:flex relative min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
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

        <div className="container-custom relative z-10 text-center">
          <motion.h1
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Grace in Motion.{' '}
            <span className="text-vortex-red">Strength in Every Line.</span>
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Vortex Rhythmic Gymnastics blends art and athleticism — where control, coordination, and elegance meet the power of the Athleticism Accelerator™.
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
      </section>

      {/* Mobile: Hero section with title only */}
      <section className="md:hidden relative h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        {/* Dark Overlay for Text Readability */}
        <div className="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />
        
        <div className="container-custom relative z-10 text-center w-full">
          <motion.h1
            className="text-4xl sm:text-5xl font-display font-bold text-white mb-6 px-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Grace in Motion.{' '}
            <span className="text-vortex-red">Strength in Every Line.</span>
          </motion.h1>
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
              Vortex Rhythmic Gymnastics blends art and athleticism — where control, coordination, and elegance meet the power of the Athleticism Accelerator™.
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

      {/* The Essence of Rhythmic Gymnastics */}
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
              The Essence of <span className="text-vortex-red">Rhythmic Gymnastics</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              Rhythmic Gymnastics is the perfect balance of athletic precision and artistic flow. Athletes learn choreography, flexibility, and apparatus control while developing the strength and stability through Vortex's athletic foundation.
            </p>
            <div className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 border-2 border-vortex-red/20">
              <Sparkles className="w-12 h-12 text-vortex-red mx-auto mb-4" />
              <p className="text-xl font-bold text-vortex-red mb-2">
                "Rhythmic Gymnastics teaches control of body, breath, and space — powered by the physical intelligence built in the Athleticism Accelerator™."
              </p>
              <p className="text-gray-700">
                Every movement becomes more fluid, more powerful, and more expressive when built on a foundation of measured strength and coordination.
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
            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-4">
              Rhythmic athletes benefit from our 8 Tenets of Athleticism — especially Strength, Coordination, Balance, Flexibility, and Body Control.
            </p>
            <p className="text-xl font-bold text-vortex-red">
              The grace seen on the floor starts with the strength built in the gym.
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
              <Zap className="w-8 h-8 text-vortex-red flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-2xl font-bold text-black mb-3">Functional Foundation</h3>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Every rhythmic class begins with a focus on functional strength, posture, and joint stability. This foundation leads to more fluid routines, stronger leaps, precise apparatus control, and fewer injuries.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Strength, Coordination, and Grace */}
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
              A Perfect <span className="text-vortex-red">Trifecta</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Strength, Coordination, and Grace — the three pillars of rhythmic excellence
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              {
                title: 'Strength',
                description: 'Core, posture, and arm control for precise apparatus handling and powerful leaps. Building functional power through the Athleticism Accelerator™.',
                icon: Zap,
                color: 'from-red-600 to-red-800'
              },
              {
                title: 'Coordination',
                description: 'Seamless transitions between skills, rhythms, and apparatus exchanges. Developing neural pathways through measured practice.',
                icon: Activity,
                color: 'from-blue-600 to-blue-800'
              },
              {
                title: 'Grace',
                description: 'Flow and timing built through repetition, breathing control, and expressive motion. The beauty of disciplined movement.',
                icon: Sparkles,
                color: 'from-purple-600 to-purple-800'
              },
            ].map((pillar, index) => (
              <motion.div
                key={pillar.title}
                className={`bg-gradient-to-br ${pillar.color} rounded-3xl p-8 text-white`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <pillar.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{pillar.title}</h3>
                <p className="text-white/90 leading-relaxed">{pillar.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-start space-x-4">
              <BarChart3 className="w-8 h-8 text-vortex-red flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-black mb-3">Measurable Feedback</h3>
                <p className="text-gray-700 leading-relaxed">
                  The Athleticism Accelerator™ provides measurable feedback on strength, coordination, and movement quality to enhance performance tracking and progression.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Training Methodology */}
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
              Training <span className="text-vortex-red">Methodology</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-4">
              Vortex's integrated rhythmic system builds effortless grace through disciplined training.
            </p>
            <div className="bg-vortex-red/10 rounded-2xl p-6 border-2 border-vortex-red/20 inline-block">
              <p className="text-xl font-bold text-vortex-red">
                "Every rotation, leap, and toss is trained to feel effortless — because it's built on disciplined strength and control."
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Incremental Progressions',
                description: 'Each apparatus (ribbon, hoop, ball, clubs, rope) introduced through scaled drills and isolated movement patterns. Mastery before complexity.',
                icon: TrendingUp
              },
              {
                title: 'AA Cross-Training',
                description: 'Floor strength, balance platforms, and coordination drills from the Athleticism Accelerator™ enhance every movement and skill.',
                icon: Activity
              },
              {
                title: 'Continuous Motion',
                description: 'Athletes move station-to-station maintaining rhythm and consistency. Constant engagement builds endurance and flow.',
                icon: Zap
              },
            ].map((methodology, index) => (
              <motion.div
                key={methodology.title}
                className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
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

      {/* Program Pathways */}
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
              Program <span className="text-vortex-red">Pathways</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              From foundational exploration to competitive excellence — choose your path
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              className="bg-gradient-to-br from-blue-50 to-white rounded-3xl p-8 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-display font-bold text-black">Recreation Track</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Ideal for ages 5–16. Focus on foundation, expression, and rhythmic coordination. Introduces all apparatus types in fun, supportive environments.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Foundational rhythmic skills',
                  'Apparatus exploration (all 5 types)',
                  'Flexibility and coordination',
                  'Fun, supportive environment',
                  'Age-appropriate progressions'
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
              className="bg-gradient-to-br from-vortex-red/10 to-white rounded-3xl p-8 border-2 border-vortex-red/20 hover:border-vortex-red/40 transition-all duration-300"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-display font-bold text-black">Competition Team</h3>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Invitation-only, progressive skill development. Emphasis on precision, choreography, artistry, and musical timing, supported by dedicated AA sessions.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Competitive skill development',
                  'Routine choreography & artistry',
                  'Musical timing & expression',
                  'Dedicated AA conditioning',
                  'Competition preparation'
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

      {/* Benefits for Every Athlete */}
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
              Benefits for <span className="text-vortex-red">Every Athlete</span>
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Rhythmic Gymnastics at Vortex develops complete athletes through artistry and athleticism
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
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

      {/* Coaching & Environment */}
      <section className="section-padding bg-white">
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
                  Coaching & <span className="text-vortex-red">Environment</span>
                </h2>
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 md:p-12 border-2 border-gray-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Experienced Coaches</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Our rhythmic coaches are certified in youth development, choreography, and safe progressions. They understand both the artistry and athleticism required for excellence.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Small Group Instruction</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Individualized feedback ensures every athlete receives personalized attention while maintaining the energy and camaraderie of group training.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Mind-Body Connection</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Emphasis on musicality, empowerment through mastery, and the deep connection between physical control and artistic expression.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
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
              Ready to discover the artistry and athleticism of rhythmic gymnastics? Start your journey with Vortex.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center space-x-3">
                  <span>Book a Trial Class</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </span>
              </motion.button>

              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Schedule an Assessment
              </motion.button>
            </div>

            <p className="text-gray-400 text-sm">
              Flexible scheduling available • Seasonal sessions • Parent showcase opportunities<br />
              Learn more about the Athleticism Accelerator™ and how it elevates every athlete's performance.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default RhythmicGymnastics

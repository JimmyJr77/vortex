import { motion } from 'framer-motion'
import { Target, Users, Shield, TrendingUp, CheckCircle, ArrowRight, Link as LinkIcon, Award, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

interface TrampolineTumblingProps {
  onSignUpClick: () => void
}

const TrampolineTumbling = ({ onSignUpClick }: TrampolineTumblingProps) => {
  const skillsRec = [
    { skill: 'Safe Landings', detail: 'Mastering controlled landings and force absorption' },
    { skill: 'Shapes', detail: 'Hollow, arch, tuck, pike, straddle positions' },
    { skill: 'Basic Drops', detail: 'Seat drops, back drops, front drops' },
    { skill: 'Controlled Rebounds', detail: 'Developing air sense and rebound quality' },
    { skill: 'Cartwheel → Round-off', detail: 'Foundation tumbling progressions' },
    { skill: 'Handspring Basics', detail: 'Back and front handspring preparations' },
  ]

  const skillsCompetition = [
    { skill: 'Routine Construction', detail: 'Building complete routines with connection value' },
    { skill: 'Timer Repetitions', detail: 'Perfecting shape precision and timing' },
    { skill: 'Twisting & Rotation', detail: 'Advanced mechanics for complex skills' },
    { skill: 'Trampoline Control', detail: 'Set and return positioning mastery' },
    { skill: 'Rod Floor Speed', detail: 'Hurdle timing and power sequences' },
    { skill: 'Double-Mini Sequences', detail: 'Mount and dismount precision' },
  ]

  const methodologies = [
    { name: 'Plyometrics & Eccentric Control', description: 'Rebound quality, landing force absorption' },
    { name: 'Isometrics & Tendon Loading', description: 'Ankle/knee stability for repetitive bouncing' },
    { name: 'Neural/Reaction Training', description: 'Air awareness, set-shape-land timing' },
    { name: 'Mobility & Core Control', description: 'Shape changes, mid-air corrections' },
    { name: 'Balance/Proprioception', description: 'Edge control and stability mastery' },
  ]

  const results = [
    { icon: Shield, title: 'Safer, Cleaner Landings', description: 'Better posture and force control' },
    { icon: TrendingUp, title: 'Stronger Core & Joints', description: 'Fewer overuse issues through proper conditioning' },
    { icon: Award, title: 'Measurable Progress', description: 'Data-backed updates via the Athleticism Accelerator™' },
    { icon: Target, title: 'Transferable Skills', description: 'Benefits cheer, gymnastics, parkour, diving, and more' },
  ]

  const faqs = [
    {
      question: 'Is prior experience required?',
      answer: 'No prior experience required for Recreation classes! Competition Team requires an evaluation to assess readiness and placement.'
    },
    {
      question: 'How do evaluations work?',
      answer: 'Book an evaluation session where our coaches assess shapes, control, landings, and overall readiness. This ensures safe placement and appropriate challenge levels.'
    },
    {
      question: 'What gear is needed?',
      answer: 'Athletic wear, grippy socks (if required by facility), hair tied back, and no jewelry. Specific competition attire provided as needed.'
    },
    {
      question: 'What safety measures are in place?',
      answer: 'Certified coaches, strict spotting protocols, progressive skill ladders, regular equipment checks, and clear advancement criteria ensure safety at every level.'
    },
    {
      question: 'How fast can my child advance?',
      answer: 'Advancement is criteria-based with a focus on mastery over speed. Quality of movement and consistency are prioritized over rushing to the next level.'
    },
    {
      question: 'Do you cross-train with other sports?',
      answer: 'Absolutely! Our Athleticism Accelerator™ integrates seamlessly with other sports, enhancing performance through gymnastics-based movement quality.'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
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
            Bounce Higher. Land Stronger.
            <br />
            <span className="text-vortex-red">Tumble Smarter.</span>
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Trampoline & Tumbling for every athlete — from first flips to national-level routines.
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
                Request Team Evaluation
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

      {/* What is T&T Section */}
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
              WHAT IS <span className="text-vortex-red">TRAMPOLINE & TUMBLING</span>?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <motion.div
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-white"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Zap className="w-10 h-10 text-vortex-red mb-4" />
              <h3 className="text-2xl font-display font-bold mb-4">Trampoline</h3>
              <p className="text-gray-300 leading-relaxed">
                Mastering air awareness and body control through controlled bouncing, shape precision, and routine construction.
              </p>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-white"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Zap className="w-10 h-10 text-vortex-red mb-4" />
              <h3 className="text-2xl font-display font-bold mb-4">Tumbling</h3>
              <p className="text-gray-300 leading-relaxed">
                Developing power and precision on rod and spring floors through progressive skill sequences and technical mastery.
              </p>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-white"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Zap className="w-10 h-10 text-vortex-red mb-4" />
              <h3 className="text-2xl font-display font-bold mb-4">Double-Mini</h3>
              <p className="text-gray-300 leading-relaxed">
                Combining trampoline and tumbling skills in mount-dismount sequences that build power and spatial awareness.
              </p>
            </motion.div>
          </div>

          <motion.div
            className="bg-vortex-red rounded-2xl p-8 text-white text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="text-xl max-w-3xl mx-auto leading-relaxed">
              At Vortex, we train <span className="font-bold">movement quality, air awareness, and safe progressions</span> 
              {' '}that build confident, capable athletes ready for any challenge.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Two Pathways Section */}
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
              TWO PATHWAYS, <span className="text-vortex-red">ONE STANDARD</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Recreation Track */}
            <motion.div
              className="bg-white rounded-3xl p-10 shadow-xl"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Users className="w-10 h-10 text-vortex-red" />
                <h3 className="text-3xl font-display font-bold text-black">
                  Recreation Track
                </h3>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700"><span className="font-bold">Ages 6-18</span> — No experience required</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700"><span className="font-bold">Goals:</span> Confidence, coordination, air awareness, and fun</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Small groups with clear progressions</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Badge/level system and showcase days</p>
                </div>
              </div>
              <motion.button
                onClick={onSignUpClick}
                className="w-full bg-vortex-red text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Book a Trial Class
              </motion.button>
            </motion.div>

            {/* Competition Team Track */}
            <motion.div
              className="bg-white rounded-3xl p-10 shadow-xl border-2 border-vortex-red"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Target className="w-10 h-10 text-vortex-red" />
                <h3 className="text-3xl font-display font-bold text-black">
                  Competition Team
                </h3>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700"><span className="font-bold">Entry via evaluation</span> or coach invitation</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Structured season with levels and routine construction</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Meet schedule and performance goals</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                  <p className="text-gray-700">Emphasis on strength, shapes, and consistency</p>
                </div>
              </div>
              <motion.button
                onClick={onSignUpClick}
                className="w-full border-2 border-vortex-red text-vortex-red px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 hover:bg-vortex-red hover:text-white hover:scale-105"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Request Team Evaluation
              </motion.button>
            </motion.div>
          </div>

          {/* AA Integration Card */}
          <motion.div
            className="bg-gradient-to-br from-black to-gray-900 rounded-3xl p-12 text-white"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <div className="lg:col-span-2">
                <h3 className="text-3xl font-display font-bold mb-4">
                  Powered by the Athleticism Accelerator™
                </h3>
                <p className="text-lg text-gray-300 leading-relaxed mb-4">
                  Every T&T athlete — recreation or competition — trains through our 8-tenet Athleticism Accelerator 
                  system, ensuring balanced development across Strength, Power, Speed, Agility, Flexibility, Balance, 
                  Coordination, and Body Control.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  All athletes receive <span className="font-bold text-white">measurable benchmarks</span> and regular 
                  updates to parents, demonstrating clear progress toward their goals.
                </p>
              </div>
              <div className="flex justify-center lg:justify-end">
                <Link to="/athleticism-accelerator">
                  <motion.button
                    className="bg-vortex-red text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 flex items-center space-x-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>Learn More</span>
                    <LinkIcon className="w-5 h-5" />
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Skills & Progressions */}
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
              SKILLS & <span className="text-vortex-red">PROGRESSIONS</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Recreation Skills */}
            <motion.div
              className="bg-gray-50 rounded-2xl p-8"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-display font-bold text-black mb-6 flex items-center">
                <Users className="w-8 h-8 text-vortex-red mr-3" />
                Recreation Pathway
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {skillsRec.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-gray-900">{item.skill}</h4>
                      <p className="text-gray-600 text-sm">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Competition Skills */}
            <motion.div
              className="bg-gray-50 rounded-2xl p-8 border-2 border-vortex-red"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-display font-bold text-black mb-6 flex items-center">
                <Target className="w-8 h-8 text-vortex-red mr-3" />
                Competition Team
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {skillsCompetition.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-gray-900">{item.skill}</h4>
                      <p className="text-gray-600 text-sm">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Training Methodologies */}
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
              TRAINING <span className="text-vortex-red">METHODOLOGIES</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              All methodologies are <Link to="/athleticism-accelerator" className="text-vortex-red font-bold hover:underline">AA-Aligned™</Link>
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {methodologies.map((method, index) => (
              <motion.div
                key={method.name}
                className="bg-black rounded-xl p-6 text-white"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Zap className="w-8 h-8 text-vortex-red mb-4" />
                <h4 className="text-xl font-bold mb-2">{method.name}</h4>
                <p className="text-gray-300 text-sm">{method.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="bg-vortex-red rounded-2xl p-8 text-white text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-display font-bold mb-4">
              Safety & Coaching Philosophy
            </h3>
            <p className="text-lg leading-relaxed max-w-3xl mx-auto">
              Certified coaches, strict spotting protocols, progressive skill ladders, regular equipment checks, 
              and clear advancement criteria. We emphasize <span className="font-bold">"mastery before move-up"</span> 
              {' '}and consistent technique for safe, confident athletes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Results */}
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
              RESULTS <span className="text-vortex-red">PARENTS CARE ABOUT</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {results.map((result, index) => (
              <motion.div
                key={result.title}
                className="bg-gray-50 rounded-2xl p-8"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-vortex-red rounded-xl flex items-center justify-center flex-shrink-0">
                    <result.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-black mb-3">
                      {result.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {result.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-gray-50" id="faq">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              FREQUENTLY ASKED <span className="text-vortex-red">QUESTIONS</span>
            </h2>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-6 mb-12">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                className="bg-white rounded-xl shadow-2xl p-6 md:p-8"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl md:text-2xl font-bold text-black mb-3 flex items-start">
                  <Target className="w-6 h-6 text-vortex-red mr-3 flex-shrink-0 mt-1" />
                  {faq.question}
                </h3>
                <p className="text-gray-700 leading-relaxed pl-9">
                  {faq.answer}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-padding bg-black text-white">
        <div className="container-custom">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">
              READY TO <span className="text-vortex-red">GET STARTED</span>?
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Whether you're trying your first flip or aiming for national competition, Vortex T&T has a pathway for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <motion.button
                onClick={onSignUpClick}
                className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105 shadow-2xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Book a Trial Class
              </motion.button>
              <motion.button
                onClick={onSignUpClick}
                className="border-2 border-white text-white px-12 py-6 rounded-xl font-bold text-xl transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Request Team Evaluation
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default TrampolineTumbling


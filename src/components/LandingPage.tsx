import { motion } from 'framer-motion'
import { Calendar, MapPin, Target, Zap, Trophy, Cpu, Brain, ChevronDown, ArrowRight } from 'lucide-react'

interface LandingPageProps {
  onSignUpClick: () => void
}

const LandingPage = ({ onSignUpClick }: LandingPageProps) => {
  const tenets = [
    { name: 'Strength', description: 'Ability to exert force against resistance.' },
    { name: 'Power', description: 'Exert maximal force in minimal time.' },
    { name: 'Speed', description: 'Rapid execution of movement and reaction.' },
    { name: 'Agility', description: 'Rapid direction changes with control.' },
    { name: 'Flexibility', description: 'Range of motion and muscular elasticity.' },
    { name: 'Balance', description: 'Maintain stability in static or dynamic movement.' },
    { name: 'Coordination', description: 'Integrate multiple body parts for fluid motion.' },
    { name: 'Kinematic Awareness', description: 'Precise understanding of where the body is in space.' },
  ]

  const physiologicalEmphasis = [
    { category: 'Neural Activation', system: 'CNS, Reflex Arc', outcome: 'Faster motor unit recruitment, improved reaction' },
    { category: 'Muscular Load', system: 'Muscle, Joint', outcome: 'Strength, hypertrophy, and stability gains' },
    { category: 'Elastic Energy', system: 'Tendons, Fascia', outcome: 'Spring-like power and resilience' },
    { category: 'Control & Stability', system: 'Core, Proprioceptors', outcome: 'Enhanced balance, posture, precision' },
    { category: 'Movement Intelligence', system: 'Brain-Body Integration', outcome: 'Improved patterning, timing, and adaptation' },
  ]

  const faqs = [
    {
      question: 'When does Vortex Athletics open?',
      answer: 'We are opening our doors on November 30th, 2025. Join our waitlist to be notified as soon as registration opens!'
    },
    {
      question: 'Where are you located?',
      answer: 'Our facility is located at 4961 Tesla Dr, Ste E, Bowie, MD 20715. We serve athletes across central Maryland and beyond.'
    },
    {
      question: 'What ages do you serve?',
      answer: 'We offer programs for athletes of all ages, from preschoolers (3-5 years) to adults. Our training is tailored to each age group\'s developmental needs.'
    },
    {
      question: 'Do I need gymnastics experience?',
      answer: 'No prior gymnastics experience is required! Our Athleticism Accelerator program is designed to benefit athletes from all sports backgrounds.'
    },
    {
      question: 'What makes Vortex different from other gyms?',
      answer: 'Vortex combines rigorous gymnastics training with cutting-edge technology (high-speed cameras, force plates, AI analysis) and a science-backed approach to develop all 8 tenets of athleticism. We focus on transforming athletes, not just training them.'
    },
    {
      question: 'What programs do you offer?',
      answer: 'We offer competitive teams in Trampoline & Tumbling, Artistic Gymnastics, and Rhythmic Gymnastics, plus our Athleticism Accelerator program for cross-sport development, recreational classes, and private coaching.'
    },
    {
      question: 'What technology do you use?',
      answer: 'We utilize high-speed cameras, haptic feedback systems, timing gates, force plates, telemetry data, and AI analysis to provide measurable growth and full awareness of each athlete\'s development.'
    },
    {
      question: 'What is the "Fail your way to success" mindset?',
      answer: 'We teach children to find fun in overcoming adversity and achieving success through a competitive edge. Our athletes are simultaneously pushed and cared for, learning resilience that fuels excellence in every aspect of life.'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Prominent Sign-Up */}
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
          {/* Opening Badge */}
          <motion.div
            className="inline-flex items-center space-x-2 bg-vortex-red text-white px-6 py-3 rounded-full text-sm font-semibold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Calendar className="w-4 h-4" />
            <span>OPENING NOVEMBER 30TH, 2025</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            className="text-6xl md:text-8xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            VORTEX
            <br />
            <span className="text-vortex-red">ATHLETICS</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            Don't just train. Transform. The premier technology-driven athletic development center 
            where gymnastics meets cutting-edge science to transform youth athletes into champions.
          </motion.p>

          {/* Location */}
          <motion.div
            className="flex items-center justify-center space-x-2 text-gray-400 mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-lg">4961 Tesla Dr, Ste E, Bowie, MD 20715</span>
          </motion.div>

          {/* Primary CTA - Most Prominent */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <motion.button
              onClick={onSignUpClick}
              className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-2xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group relative overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10 flex items-center space-x-3">
                <span>SIGN UP NOW</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </span>
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6 }}
              />
            </motion.button>
            <p className="text-gray-400 text-sm">
              Be the first to know when we open. Join our waitlist today!
            </p>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChevronDown className="w-8 h-8 text-white/50" />
          </motion.div>
        </div>
      </section>

      {/* Mission Statement Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-12 md:p-16 text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8">
              OUR MISSION
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 max-w-5xl mx-auto leading-relaxed mb-8">
              At Vortex Athletics, our mission is to harness the power of gymnastics and technology to transform 
              youth athletes into champions, regardless of sport. By merging rigorous gymnastics training, 
              advanced technology, and a relentless competitive mindset, we empower each participant to 
              cultivate strength, explosiveness, precise body control, and the resilience to "fail their 
              way to success." We don't merely train athletes. We guide future leaders toward a complete 
              transformation that fuels excellence in every aspect of life.
            </p>
            
            {/* Secondary CTA */}
            <motion.button
              onClick={onSignUpClick}
              className="border-2 border-vortex-red text-vortex-red px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red hover:text-white hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Join the Transformation
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* What We Offer Section */}
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
              WHAT YOUR ATHLETE WILL GET
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive training that develops every aspect of athletic performance
            </p>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl p-8 md:p-12 mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm md:text-base">
              {[
                'Ninja training', 'Acrobatics', 'Trampoline work', 'Resistance training',
                'Plyometrics', 'Calisthenics', 'Isometrics', 'Reflex training',
                'Neural priming', 'Rapid direction change', 'Mobility', 'Tendon conditioning',
                'Eccentric training', 'Coordination games', 'Gymnastics',
                'Tumbling & floor', 'Body control',
                'Higher jumps', 'Faster Sprints', 'Dynamic movement'
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-vortex-red rounded-full flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Supplement Section */}
          <motion.div
            className="bg-white rounded-2xl p-8 md:p-12 mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-4xl mx-auto text-center">
              Supplement football, basketball, soccer, wrestling, lacrosse and more through our Athleticism Accelerator programs. Supplement dance, cheer, acro, and gymnastics with focused tumbling and floor lessons from our international gymnast instructors and founders of A4 Gymnastics. Learn backflips, aerials, layouts, cartwheels, fulls, and more. Master the strength, technique, and body control needed to advance in your sport.
            </p>
          </motion.div>

          {/* CTA in this section */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={onSignUpClick}
              className="bg-vortex-red text-white px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Reserve Your Spot
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* 8 Tenets Section */}
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
              THE 8 TENETS OF <span className="text-vortex-red">ATHLETICISM</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our Athleticism Accelerator focus means all training incorporates these core principles
            </p>
          </motion.div>

          {/* Tenets Table */}
          <motion.div
            className="overflow-x-auto mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-4 text-left font-bold text-lg">Tenet</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">Description</th>
                </tr>
              </thead>
              <tbody>
                {tenets.map((tenet, index) => (
                  <tr
                    key={tenet.name}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-vortex-red/5 transition-colors`}
                  >
                    <td className="px-6 py-4 font-semibold text-vortex-red">{tenet.name}</td>
                    <td className="px-6 py-4 text-gray-700">{tenet.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={onSignUpClick}
              className="btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Your Journey
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Physiological Emphasis Table */}
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
              PHYSIOLOGICAL <span className="text-vortex-red">EMPHASIS</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-2">
              Designed for: <span className="font-bold">Vortex Athletics | Athleticism Accelerator™</span>
            </p>
            <p className="text-lg text-gray-600">
              Purpose: Develop adaptable, resilient, and high-performance athletes through structured physical intelligence.
            </p>
          </motion.div>

          <motion.div
            className="overflow-x-auto mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-4 text-left font-bold text-lg">Category</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">System Targeted</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {physiologicalEmphasis.map((item, index) => (
                  <tr
                    key={item.category}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-vortex-red/5 transition-colors`}
                  >
                    <td className="px-6 py-4 font-semibold text-vortex-red">{item.category}</td>
                    <td className="px-6 py-4 text-gray-700">{item.system}</td>
                    <td className="px-6 py-4 text-gray-700">{item.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={onSignUpClick}
              className="btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Experience the Science
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Technology & Mindset Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Technology */}
            <motion.div
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Cpu className="w-8 h-8 text-vortex-red" />
                <h3 className="text-3xl font-display font-bold text-white">
                  Technology Driven
                </h3>
              </div>
              <p className="text-gray-300 mb-6 text-lg">
                Technology driven to support full awareness & measurable growth
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>High Speed Cameras</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>Haptic Feedback</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>Timing Gates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>Force Plates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>Telemetry Data</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-vortex-red" />
                  <span>AI Analysis</span>
                </li>
              </ul>
            </motion.div>

            {/* Mindset */}
            <motion.div
              className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 border-2 border-vortex-red/20"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Brain className="w-8 h-8 text-vortex-red" />
                <h3 className="text-3xl font-display font-bold text-black">
                  "Fail Your Way to Success"
                </h3>
              </div>
              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                We teach children to find fun in overcoming adversity and achieving success through 
                a competitive edge. Our athletes are simultaneously pushed and cared for.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                This mindset cultivates resilience that fuels excellence in every aspect of life.
              </p>
            </motion.div>
          </div>

          {/* Competition Programs */}
          <motion.div
            className="bg-gray-50 rounded-2xl p-8 md:p-12 mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <Trophy className="w-8 h-8 text-vortex-red" />
              <h3 className="text-3xl font-display font-bold text-black">
                Competition Programs
              </h3>
            </div>
            <p className="text-xl text-gray-700 mb-6">
              Formal competitive teams in:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Trampoline & Tumbling', 'Artistic Gymnastics', 'Rhythmic Gymnastics'].map((program) => (
                <div key={program} className="bg-white rounded-lg p-6 text-center border-2 border-gray-200 hover:border-vortex-red transition-colors">
                  <h4 className="text-xl font-bold text-black">{program}</h4>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={onSignUpClick}
              className="btn-primary text-xl px-12 py-6"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Join Our Programs
            </motion.button>
          </motion.div>
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
            <p className="text-xl text-gray-600">
              Everything you need to know about Vortex Athletics
            </p>
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

          {/* Final CTA */}
          <motion.div
            className="text-center bg-vortex-red rounded-2xl p-12 text-white"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Ready to Transform?
            </h3>
            <p className="text-xl mb-8 text-red-100 max-w-2xl mx-auto">
              Join our waitlist today and be the first to experience the future of athletic development.
            </p>
            <motion.button
              onClick={onSignUpClick}
              className="bg-white text-vortex-red px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-gray-100 hover:scale-105 shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              SIGN UP NOW - IT'S FREE!
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Location Section */}
      <section className="section-padding bg-black text-white">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">
              FIND US
            </h2>
            <div className="flex flex-col items-center space-y-4 mb-8">
              <div className="flex items-center space-x-2 text-xl">
                <MapPin className="w-6 h-6 text-vortex-red" />
                <span>4961 Tesla Dr, Ste E, Bowie, MD 20715</span>
              </div>
              <a 
                href="https://maps.google.com/?q=4961+Tesla+Dr+Ste+E+Bowie+MD+20715"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vortex-red hover:text-red-400 font-semibold transition-colors text-lg underline"
              >
                View on Google Maps
              </a>
            </div>
            
            {/* Final Sign-Up CTA */}
            <motion.button
              onClick={onSignUpClick}
              className="bg-vortex-red text-white px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Reserve Your Spot Today
            </motion.button>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage


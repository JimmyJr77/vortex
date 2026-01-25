import { motion } from 'framer-motion'
import { MapPin, Target, Trophy, Brain } from 'lucide-react'
import Hero from './Hero'
import ParallaxGym from './ParallaxGym'
import About from './About'
import Programs from './Programs'
import Technology from './Technology'

interface HomePageProps {
  onSignUpClick?: () => void
}

const HomePage = ({ onSignUpClick }: HomePageProps) => {
  const tenets = [
    { name: 'Strength', description: 'Ability to exert force against resistance.' },
    { name: 'Explosiveness', description: 'Exert maximal force in minimal time.' },
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
      question: 'Where are you located?',
      answer: 'Our facility is located at 4961 Tesla Dr, Ste E, Bowie, MD 20715. We serve athletes across central Maryland and beyond.'
    },
    {
      question: 'What ages do you serve?',
      answer: 'We offer programs for athletes of all ages, from preschoolers (3-5 years) to adults. Our training is tailored to each age group\'s developmental needs.'
    },
    {
      question: 'Do I need gymnastics experience to register for gymnastics classes?',
      answer: 'No prior gymnastics experience is required! Our programs will teach your athlete fundamentals, reinforce proper technique, and press toward advanced skills as the athlete progresses.'
    },
    {
      question: 'Is Vortex solely a gymnastics studio?',
      answer: 'No. We offer a lot more than just gymnastics. Vortex is a full athletic development studio. We recognize, however, that gymnastics are a core component to athleticism and incorporate tumbling and body awareness into our strength, condition, and fitness regimens.'
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
      question: 'What is the "Fail your way to success" mindset?',
      answer: 'We teach children to find fun in overcoming adversity and achieving success through a competitive edge. Our athletes are simultaneously pushed and cared for, learning resilience that fuels excellence in every aspect of life.'
    }
  ]

  const handleSignUp = () => {
    if (onSignUpClick) {
      onSignUpClick()
    }
  }

  return (
    <>
      <Hero />

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

          {onSignUpClick && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.button
                onClick={handleSignUp}
                className="bg-vortex-red text-white px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reserve Your Spot
              </motion.button>
            </motion.div>
          )}
        </div>
      </section>

      <ParallaxGym />

      <About onSignUpClick={onSignUpClick} />
      <Programs />
      <Technology />

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
              ATHLETICISM ACCELERATOR <span className="text-vortex-red">PROGRAM</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
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
            <h3 className="text-2xl md:text-3xl font-display font-bold text-vortex-red mb-4 text-center">
              8 Tenets of Athleticism
            </h3>
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

          {onSignUpClick && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.button
                onClick={handleSignUp}
                className="btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Your Journey
              </motion.button>
            </motion.div>
          )}
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

          {onSignUpClick && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.button
                onClick={handleSignUp}
                className="btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Experience the Science
              </motion.button>
            </motion.div>
          )}
        </div>
      </section>

      {/* Technology & Mindset Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto mb-12">
            {/* Mindset */}
            <motion.div
              className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 border-2 border-vortex-red/20"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
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

          {onSignUpClick && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.button
                onClick={handleSignUp}
                className="btn-primary text-xl px-12 py-6"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join Our Programs
              </motion.button>
            </motion.div>
          )}
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

          {onSignUpClick && (
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
                onClick={handleSignUp}
                className="bg-white text-vortex-red px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-gray-100 hover:scale-105 shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                SIGN UP NOW - IT'S FREE!
              </motion.button>
            </motion.div>
          )}
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
            
            {onSignUpClick && (
              <motion.button
                onClick={handleSignUp}
                className="bg-vortex-red text-white px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reserve Your Spot Today
              </motion.button>
            )}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export default HomePage


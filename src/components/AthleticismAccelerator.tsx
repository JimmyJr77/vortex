import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Zap, Target, TrendingUp, Shield, Users } from 'lucide-react'
import { ENROLL_PATH } from '../config/enrollSites'
import { StrategicLocation } from './About'
import AcceleratorProgramTiles from './AcceleratorProgramTiles'
import Hero from './Hero'
import ParallaxGym from './ParallaxGym'
import RotatingOfferHeadline from './RotatingOfferHeadline'
import TrainingPhilosophy from './TrainingPhilosophy'
import VortexDifference from './VortexDifference'
import { TENETS, TRAINING_METHODOLOGIES, PHYSIOLOGICAL_EMPHASIS } from '../coach/taxonomy'

interface AthleticismAcceleratorProps {
  onHighlightsClick?: () => void
}

const ACCELERATOR_OFFER_HEADLINES = [
  {
    leading: 'JUMP HIGHER.\u00a0 THROW FARTHER.\u00a0 RUN FASTER.\u00a0 MOVE BETTER.',
    emphasis: 'BE A BETTER ATHLETE.',
  },
  {
    leading: "DON'T JUST PLAY AT THE TRAMPOLINE PARK, LEARN HOW TO",
    emphasis: 'FLIP & TUMBLE',
    trailing: 'LIKE AN ATHLETE',
  },
]

const AthleticismAccelerator = ({ onHighlightsClick }: AthleticismAcceleratorProps) => {
  const tenets = TENETS
  const trainingMethodologies = TRAINING_METHODOLOGIES

  const benefits = [
    { icon: TrendingUp, title: 'Measurable Progress', description: 'Track improvements through data-driven metrics and AI analysis' },
    { icon: Shield, title: 'Reduced Injury Risk', description: 'Build resilient bodies through proper movement patterns and strength' },
    { icon: Target, title: 'Enhanced Performance', description: 'Outperform competitors with superior athletic capabilities' },
    { icon: Users, title: 'Multi-Sport Transfer', description: 'Skills that enhance performance in any athletic discipline' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <Hero onHighlightsClick={onHighlightsClick} hideAcceleratorCta />
      <section className="section-padding bg-white">
        <div className="container-custom">
          <RotatingOfferHeadline headlines={ACCELERATOR_OFFER_HEADLINES} />
        </div>
      </section>
      <AcceleratorProgramTiles />
      <section className="section-padding border-y border-gray-200 bg-white">
        <div className="container-custom">
          <StrategicLocation />
        </div>
      </section>
      <ParallaxGym />

      {/* Program Overview */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center"
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

        </div>
      </section>

      {/* Vortex Difference + interactive training philosophy */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <VortexDifference />
          <TrainingPhilosophy />
        </div>
      </section>

      {/* Detailed tenets */}
      <section className="section-padding bg-white">
        <div className="container-custom">
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
              {PHYSIOLOGICAL_EMPHASIS.map((item, index) => (
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
                    {item.is_optional && (
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={ENROLL_PATH}
                className="inline-block bg-vortex-red border-2 border-vortex-red text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105"
              >
                <motion.span
                  className="inline-block"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started Today
                </motion.span>
              </Link>
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

export default AthleticismAccelerator

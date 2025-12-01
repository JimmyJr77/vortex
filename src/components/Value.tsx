import { motion } from 'framer-motion'
import { 
  DollarSign, 
  Clock, 
  Target,
  BarChart3,
  CheckCircle,
  Zap,
  Shield,
  Users,
  Activity,
  Tag
} from 'lucide-react'

const Value = () => {
  const valueTiers = [
    { 
      classes: "1 Class/Week", 
      price: "$150/mo", 
      benefits: [
        "50% longer sessions",
        "Extended skill development time",
        "Telemetry data tracking",
        "Success-driven progression"
      ]
    },
    { 
      classes: "2 Classes/Week", 
      price: "$250/mo", 
      benefits: [
        "$50 discount",
        "2x training frequency",
        "Accelerated skill acquisition",
        "Comprehensive performance data"
      ]
    },
    { 
      classes: "3 Classes/Week", 
      price: "$325/mo", 
      benefits: [
        "$125 discount",
        "Elite training frequency",
        "Maximum skill range development",
        "Advanced telemetry analytics (Limited spaces)"
      ]
    },
    { 
      classes: "5 Classes/Week", 
      price: "$500/mo", 
      benefits: [
        "$250 discount",
        "Champion-level training",
        "Complete athletic transformation",
        "Premium telemetry & monitoring (Limited spaces)"
      ]
    }
  ]

  const valuePropositions = [
    {
      icon: DollarSign,
      title: "Discounted Rates for Young Children",
      description: "Special pricing available for early development athletes. Invest in foundational skills at accessible rates designed for growing families."
    },
    {
      icon: BarChart3,
      title: "Telemetry Data & Performance Tracking",
      description: "Advanced data collection refines training and monitors development in real-time. Track progress, identify strengths, and optimize weaknesses with precision analytics."
    },
    {
      icon: Clock,
      title: "Longer Class Times",
      description: "Extended sessions mean more time on equipment, deeper skill development, and comprehensive training without rushing. Quality over quantity, but we deliver both."
    },
    {
      icon: Target,
      title: "Wider Range of Skills Development",
      description: "Comprehensive athletic development across all 8 tenets. Not just gymnastics—complete movement intelligence that transfers to every sport and life."
    },
    {
      icon: Zap,
      title: "Success-Driven Focus",
      description: "Every session is designed for measurable progress. Our methodology prioritizes results through science-backed training and proven progression systems."
    },
    {
      icon: Activity,
      title: "Continuous Movement Training",
      description: "More repetitions, less waiting. Our equipment-dense environment maximizes training time and accelerates skill acquisition through constant engagement."
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
            <span className="text-vortex-red">VALUE</span> That Transforms
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Premium training, measurable results, and unmatched athletic development.
          </motion.p>

          {/* Scroll Indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
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
      </section>

      {/* Value Propositions */}
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
              Why <span className="text-vortex-red">Vortex</span> Delivers
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Every element of our program is designed to maximize value and accelerate your athlete's development
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {valuePropositions.map((proposition, index) => (
              <motion.div
                key={proposition.title}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border-2 border-gray-200 hover:border-vortex-red/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-16 h-16 bg-vortex-red/10 rounded-2xl flex items-center justify-center mb-6">
                  <proposition.icon className="w-8 h-8 text-vortex-red" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">{proposition.title}</h3>
                <p className="text-gray-600 leading-relaxed">{proposition.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiered Value Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            className="bg-black rounded-3xl p-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="text-center mb-12">
              <h3 className="text-4xl font-display font-bold text-white mb-4">
                VALUE
              </h3>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Our value reflects the premium training experience: extended class durations, 
                integrated fitness regimens, cutting-edge technology, and success-driven focus. More Training = More Value.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {valueTiers.map((tier, index) => (
                <motion.div
                  key={tier.classes}
                  className="bg-white/10 rounded-2xl p-6"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="text-3xl font-bold text-vortex-red mb-2">{tier.price}</div>
                  <div className="text-white font-semibold mb-4">{tier.classes}</div>
                  <ul className="space-y-2">
                    {tier.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-vortex-red flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300 text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-8">
              <div className="text-lg text-gray-300 mb-2">
                <span className="font-semibold text-vortex-red">Telemetry & Athlete Data:</span> $250 one-time fee (first child)
              </div>
              <div className="text-lg text-gray-300 mb-2">
                <span className="font-semibold text-vortex-red">Additional Children:</span> $125 one-time fee (50% discount)
              </div>
              <p className="text-gray-400 text-sm">
                Lifetime access to advanced performance tracking, data analytics, and continuous development monitoring
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Multi-Family Discounts Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-3xl p-8 md:p-12 border-2 border-vortex-red/20">
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 bg-vortex-red/20 rounded-2xl flex items-center justify-center">
                  <Tag className="w-8 h-8 text-vortex-red" />
                </div>
              </div>
              
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-3xl md:text-4xl font-display font-bold text-black mb-4">
                  Multi-Family Member <span className="text-vortex-red">Discounts</span>
                </h3>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  Enroll multiple children from the same family and save on your investment in their athletic development.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* 2 Kids Discount */}
                <motion.div
                  className="bg-white rounded-2xl p-6 border-2 border-vortex-red/30"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-2xl font-bold text-black">2 Children</h4>
                    <span className="text-3xl font-bold text-vortex-red">10% OFF</span>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Receive a <strong className="text-vortex-red">10% discount</strong> on the lesser-valued program when enrolling 2 children.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Example:</p>
                    <p className="text-sm text-gray-700">
                      Child 1: 2 Classes/Week ($250/mo)
                      <br />
                      Child 2: 1 Class/Week ($150/mo)
                      <br />
                      <span className="font-semibold text-vortex-red">Discount: $15/mo off Child 2</span>
                      <br />
                      <span className="text-gray-600">Total: $385/mo (was $400/mo)</span>
                    </p>
                  </div>
                </motion.div>

                {/* 3+ Kids Discount */}
                <motion.div
                  className="bg-white rounded-2xl p-6 border-2 border-vortex-red/30"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-2xl font-bold text-black">3+ Children</h4>
                    <span className="text-3xl font-bold text-vortex-red">15% OFF</span>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Receive a <strong className="text-vortex-red">15% discount</strong> on the lesser-valued program(s) when enrolling 3 or more children.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Example:</p>
                    <p className="text-sm text-gray-700">
                      Child 1: 3 Classes/Week ($325/mo)
                      <br />
                      Child 2: 2 Classes/Week ($250/mo)
                      <br />
                      Child 3: 1 Class/Week ($150/mo)
                      <br />
                      <span className="font-semibold text-vortex-red">Discount: $22.50/mo off Child 3</span>
                      <br />
                      <span className="text-gray-600">Total: $702.50/mo (was $725/mo)</span>
                    </p>
                  </div>
                </motion.div>
              </div>

              <motion.div
                className="bg-black/5 rounded-xl p-6 border border-vortex-red/20 mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <p className="text-center text-gray-800 font-semibold">
                  <span className="text-vortex-red">Note:</span> Discounts are automatically applied to the program(s) with the lowest monthly fee.
                </p>
              </motion.div>

              <motion.div
                className="bg-gradient-to-r from-vortex-red/10 to-vortex-red/5 rounded-xl p-6 border-2 border-vortex-red/30"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-center mb-3">
                  <Tag className="w-6 h-6 text-vortex-red mr-2" />
                  <h4 className="text-xl font-bold text-black">Telemetry Fee Discount</h4>
                </div>
                <p className="text-center text-gray-800">
                  <span className="font-semibold">First child:</span> $250 one-time fee
                  <br />
                  <span className="font-semibold text-vortex-red">Additional children:</span> $125 one-time fee (50% off)
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Additional Value Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-br from-vortex-red/10 to-vortex-red/5 rounded-2xl p-8 md:p-12 border-2 border-vortex-red/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex items-start space-x-4">
                  <Users className="w-8 h-8 text-vortex-red flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-black mb-3">Small Group Excellence</h3>
                    <p className="text-gray-700 leading-relaxed">
                      More individualized attention, personalized feedback, and coach-to-athlete time means faster progress and better results.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Shield className="w-8 h-8 text-vortex-red flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-black mb-3">Long-Term Investment</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Building athleticism that lasts. Our training develops skills, strength, and mindset that serve athletes throughout their lives.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Value


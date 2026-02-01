import { motion } from 'framer-motion'
import { Camera, Activity, Brain, BarChart3, Zap, Target } from 'lucide-react'

const Technology = () => {
  const techFeatures = [
    {
      icon: Camera,
      title: "High-Speed Cameras",
      description: "Advanced video analysis for precise movement breakdown and technique refinement."
    },
    {
      icon: Activity,
      title: "Telemetry Sensors",
      description: "Real-time data collection on biomechanics, force, and movement efficiency."
    },
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Machine learning algorithms provide personalized training recommendations."
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Comprehensive data visualization and progress tracking over time."
    },
    {
      icon: Zap,
      title: "Haptic Feedback",
      description: "Tactile feedback systems to enhance body awareness and technique."
    },
    {
      icon: Target,
      title: "Precision Training",
      description: "Data-driven coaching that identifies physical vs. mental limitations."
    }
  ]

  const benefits = [
    "Measurable Growth: Track progress with concrete data, not just perception",
    "Personalized Coaching: AI-driven insights for individual athlete development",
    "Injury Prevention: Early detection of movement patterns that could lead to injury",
    "Performance Optimization: Fine-tune technique for maximum efficiency and power",
    "Competitive Edge: Technology that gives our athletes an advantage over competitors"
  ]

  return (
    <section id="technology" className="section-padding bg-white">
      <div className="container-custom">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-display font-bold text-black mb-6">
            CUTTING-EDGE
            <span className="text-vortex-red"> TECHNOLOGY</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            We believe in data and finding new ways to teach and monitor the growth of our athletes. 
            Our fusion of technology and expert coaching bolsters success by providing measurable, 
            tailorable development.
          </p>
        </motion.div>

        {/* Technology Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {techFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-gray-200 rounded-2xl p-8 text-center hover:bg-gray-300 transition-colors duration-300"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-20 h-20 bg-vortex-red rounded-2xl flex items-center justify-center mx-auto mb-6">
                <feature.icon className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Benefits Section */}
        <motion.div
          className="bg-gradient-to-r from-vortex-red to-red-600 rounded-3xl p-12 text-white"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-4xl mx-auto">
            <h3 className="text-4xl font-display font-bold text-center mb-12">
              WHY TECHNOLOGY MATTERS
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-2xl font-bold mb-6">The Science of Success</h4>
                <p className="text-lg leading-relaxed mb-6">
                  Traditional training relies on perception and experience. We use data to understand 
                  exactly where athletes need to focus, helping determine the difference between 
                  physical and mental limitations.
                </p>
                <p className="text-lg leading-relaxed">
                  Our training incorporates telemetry data and cameras to ensure growth is not just 
                  perceived, but measurable and tailorable to each athlete's unique needs.
                </p>
              </div>
              
              <div>
                <h4 className="text-2xl font-bold mb-6">Key Benefits</h4>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <motion.li
                      key={benefit}
                      className="flex items-start space-x-3"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.6 }}
                      viewport={{ once: true }}
                    >
                      <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0" />
                      <span className="text-lg">{benefit}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Visualization Preview */}
        {/* 
        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-display font-bold text-black mb-8">
            ATHLETE PERFORMANCE DASHBOARD
          </h3>
          <div className="bg-gray-100 rounded-2xl p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-vortex-red mb-2">94%</div>
                <div className="text-gray-600">Technique Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-vortex-red mb-2">2.3s</div>
                <div className="text-gray-600">Reaction Time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-vortex-red mb-2">+15%</div>
                <div className="text-gray-600">Power Increase</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-vortex-red mb-2">A+</div>
                <div className="text-gray-600">Overall Grade</div>
              </div>
            </div>
            <p className="text-gray-600 mt-6 text-lg">
              Real-time performance metrics that guide every training session
            </p>
          </div>
        </motion.div>
        */}
      </div>
    </section>
  )
}

export default Technology

import { motion } from 'framer-motion'
import { Target, Cpu, Trophy } from 'lucide-react'

// Custom D1 Icon Component
const D1Icon = ({ className }: { className?: string }) => (
  <span className={className} style={{ 
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '2rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%'
  }}>
    D1
  </span>
)

interface AboutProps {
  onSignUpClick?: () => void
}

const About = ({ onSignUpClick }: AboutProps) => {
  const features = [
    {
      icon: D1Icon,
      title: "Elite Development",
      description: "Developing the 8 core tenets of athleticism: Flexibility, Balance, Coordination, Strength, Explosiveness, Speed, Agility, and Body Control."
    },
    {
      icon: Cpu,
      title: "Technology-Driven",
      description: "High-speed cameras, haptic feedback tools, and telemetry data create detailed athlete profiles for measurable growth."
    },
    {
      icon: Target,
      title: "Kinematic Awareness",
      description: "Precise understanding of where the body is in space - the key to athleticism that separates champions from competitors."
    },
    {
      icon: Trophy,
      title: "Fail Your Way to Success",
      description: "We teach children to find fun in overcoming adversity and achieving success through a competitive edge mindset."
    }
  ]

  return (
    <section id="about" className="section-padding bg-white">
      <div className="container-custom">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-display font-bold text-black mb-6">
            THE VORTEX
            <span className="text-vortex-red"> DIFFERENCE</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            We're not just another athletics or gymnastics facility. We're a cutting-edge athletic development 
            center that places gymnastics at the heart of comprehensive athletic training, 
            merging body control and advanced technology with rigorous, science-backed training.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors duration-300"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Mission Statement */}
        <motion.div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-12 md:p-16 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
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
          
          {onSignUpClick && (
            <motion.button
              onClick={onSignUpClick}
              className="border-2 border-vortex-red text-vortex-red px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red hover:text-white hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Join the Transformation
            </motion.button>
          )}
        </motion.div>

        {/* Location */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-display font-bold text-black mb-4">
            STRATEGIC LOCATION
          </h3>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">
            Located in Bowie, MD, our facility serves athletes across central Maryland 
            and beyond.
          </p>
          <div className="text-center">
            <p className="text-lg font-semibold text-vortex-red mb-2">
              4961 Tesla Dr, Ste E, Bowie, MD 20715
            </p>
            <a 
              href="https://maps.google.com/?q=4961+Tesla+Dr+Ste+E+Bowie+MD+20715"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-vortex-red hover:text-red-700 font-semibold transition-colors duration-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View on Google Maps
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default About

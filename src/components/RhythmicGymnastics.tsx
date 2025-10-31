import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

interface RhythmicGymnasticsProps {
  onSignUpClick: () => void
}

const RhythmicGymnastics = ({ onSignUpClick }: RhythmicGymnasticsProps) => {
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
        </div>

        <div className="container-custom relative z-10 text-center">
          <motion.h1
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            RHYTHMIC <span className="text-vortex-red">GYMNASTICS</span>
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Rhythm, flexibility, and artistic expression coming soon.
          </motion.p>

          <motion.button
            onClick={onSignUpClick}
            className="bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="flex items-center space-x-3">
              <span>Stay Informed</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </span>
          </motion.button>
        </div>
      </section>
    </div>
  )
}

export default RhythmicGymnastics


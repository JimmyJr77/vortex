import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const Hero = () => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  
  const rotatingTexts = [
    {
      main: "DON'T JUST",
      middle: "TRAIN.",
      bottom: "TRANSFORM.",
      middleColor: "text-white",
      bottomColor: "text-vortex-red"
    },
    {
      main: "DEVELOP",
      middle: "FLEXIBILITY",
      bottom: "& MOBILITY",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "MASTER",
      middle: "BALANCE",
      bottom: "& CONTROL",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "ENHANCE",
      middle: "COORDINATION",
      bottom: "& PRECISION",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "BUILD",
      middle: "STRENGTH",
      bottom: "& POWER",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "UNLEASH",
      middle: "EXPLOSIVENESS",
      bottom: "& SPEED",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "ACHIEVE",
      middle: "AGILITY",
      bottom: "& QUICKNESS",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "PERFECT",
      middle: "BODY CONTROL",
      bottom: "& SKILLS",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    },
    {
      main: "CULTIVATE",
      middle: "KINEMATIC",
      bottom: "AWARENESS",
      middleColor: "text-vortex-red",
      bottomColor: "text-white"
    }
  ]

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0) // Reset end position
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      // Swipe left - go to next
      setCurrentTextIndex((prevIndex) => 
        (prevIndex + 1) % rotatingTexts.length
      )
    } else if (isRightSwipe) {
      // Swipe right - go to previous
      setCurrentTextIndex((prevIndex) => 
        prevIndex === 0 ? rotatingTexts.length - 1 : prevIndex - 1
      )
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Handle touchpad/mouse wheel swipe
    if (Math.abs(e.deltaX) > 50) {
      if (e.deltaX > 0) {
        // Swipe right on touchpad
        setCurrentTextIndex((prevIndex) => 
          prevIndex === 0 ? rotatingTexts.length - 1 : prevIndex - 1
        )
      } else {
        // Swipe left on touchpad
        setCurrentTextIndex((prevIndex) => 
          (prevIndex + 1) % rotatingTexts.length
        )
      }
    }
  }

  const goToSlide = (index: number) => {
    setCurrentTextIndex(index)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTextIndex((prevIndex) => 
        (prevIndex + 1) % rotatingTexts.length
      )
    }, 4000) // Change every 4 seconds

    return () => clearInterval(interval)
  }, [rotatingTexts.length])

  const currentText = rotatingTexts[currentTextIndex]
  return (
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

      <div className="container-custom relative z-10">
        <div className="text-center">
          {/* Opening Soon Badge */}
          <motion.div
            className="inline-flex items-center space-x-2 bg-vortex-red text-white px-6 py-3 rounded-full text-sm font-semibold mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Zap className="w-4 h-4" />
            <span>Gymnastics classes now open. Athleticism, Fitness, and Ninja classes will open in February</span>
          </motion.div>

          {/* Main Headline with Rotating Text */}
          <div 
            className="relative h-96 flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <AnimatePresence mode="wait">
              <motion.h1
                key={currentTextIndex}
                className="text-6xl md:text-8xl font-display font-bold text-white mb-6 text-center"
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                {currentText.main}
                <br />
                <span className={currentText.middleColor}>{currentText.middle}</span>
                <br />
                <span className={currentText.bottomColor}>{currentText.bottom}</span>
              </motion.h1>
            </AnimatePresence>
            
            {/* Progress Indicators */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex space-x-2 cursor-pointer">
              {rotatingTexts.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentTextIndex ? 'bg-vortex-red' : 'bg-white/30'
                  }`}
                  animate={{
                    scale: index === currentTextIndex ? 1.2 : 1,
                    opacity: index === currentTextIndex ? 1 : 0.3
                  }}
                  transition={{ duration: 0.3 }}
                  onClick={() => goToSlide(index)}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </div>

          {/* Subtitle */}
          <motion.p
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed mt-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            The premier technology-driven athletic development center where kinematics pair 
            with cutting-edge science to transform youth athletes into champions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <Link to="/athleticism-accelerator">
              <motion.button
                className="btn-secondary group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Athleticism Accelerator
              </motion.button>
            </Link>
            
            <Link to="/trampoline-tumbling">
              <motion.button
                className="btn-secondary group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Trampoline & Tumbling
              </motion.button>
            </Link>
            
            <Link to="/artistic-gymnastics">
              <motion.button
                className="btn-secondary group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Artistic Gymnastics
              </motion.button>
            </Link>
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

          {/* Stats */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-vortex-red mb-2">8</div>
              <div className="text-gray-400">Core Athletics Tenets</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-vortex-red mb-2">100%</div>
              <div className="text-gray-400">Sports-Science Backed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-vortex-red mb-2">D1</div>
              <div className="text-gray-400">Performance Focus</div>
            </div>
          </motion.div>
        </div>
      </div>

    </section>
  )
}

export default Hero

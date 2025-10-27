import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { Activity, Zap, Gauge, Wind, Flame, Dumbbell, TrendingUp, Play, Shield } from 'lucide-react'

export default function ParallaxGym() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  })

  const y1 = useTransform(scrollYProgress, [0, 1], ['-20%', '20%'])
  const y2 = useTransform(scrollYProgress, [0, 1], ['-10%', '10%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3])
  
  const [currentImage, setCurrentImage] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      // Start fade out
      setIsTransitioning(true)
      // After 1 second, change image
      setTimeout(() => {
        setCurrentImage((prev) => (prev + 1) % 4)
        // After another 3 seconds (was 1 second), fade in
        setTimeout(() => {
          setIsTransitioning(false)
        }, 3000)
      }, 1000)
    }, 8000) // Total cycle: 4 seconds visible + 4 seconds transition

    return () => clearInterval(interval)
  }, [])

  const activities = [
    { icon: Activity, name: 'Gymnastics' },
    { icon: Zap, name: 'Trampoline Skills' },
    { icon: Zap, name: 'Tumbling & Flips' },
    { icon: Shield, name: 'Ninja Training' },
    { icon: Dumbbell, name: 'Strength Training' },
    { icon: Flame, name: 'Plyometrics' },
    { icon: Activity, name: 'Calisthenics' },
    { icon: Wind, name: 'Speed Work' },
    { icon: Gauge, name: 'Agility Drills' },
    { icon: TrendingUp, name: 'Coordination Games' },
    { icon: Play, name: 'Multi-Sport Training' }
  ]

  return (
    <section 
      ref={containerRef}
      className="relative h-screen overflow-hidden bg-black"
    >
      {/* Background Gym Image with Parallax */}
      <motion.div 
        className="absolute inset-0"
        style={{ y: y1 }}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/gym_background.png)',
          }}
        >
          {/* Subtle overlay for text readability */}
          <div className="absolute inset-0 bg-black/20" />
        </div>
      </motion.div>

      {/* Middle Layer - Rotating Images */}
      <motion.div 
        className="absolute inset-0"
        style={{ y: y2 }}
      >
        <AnimatePresence mode="wait">
          {currentImage === 0 && !isTransitioning && (
            <motion.div
              key="boy"
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1 }}
            >
              <img 
                src="/boy_flip.png" 
                alt="Youth athlete" 
                className="h-96 w-auto drop-shadow-2xl"
              />
            </motion.div>
          )}
          {currentImage === 1 && !isTransitioning && (
            <motion.div
              key="girl"
              className="absolute top-[55%] left-[25%] transform -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1 }}
            >
              <img 
                src="/girl_running.png" 
                alt="Youth athlete" 
                className="h-96 w-auto drop-shadow-2xl"
              />
            </motion.div>
          )}
          {currentImage === 2 && !isTransitioning && (
            <motion.div
              key="kids"
              className="absolute top-[60%] left-[75%] transform -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1 }}
            >
              <img 
                src="/kids_racing.png" 
                alt="Youth athletes" 
                className="h-96 w-auto max-w-none drop-shadow-2xl"
                style={{ width: 'auto', height: '24rem' }}
              />
            </motion.div>
          )}
          {currentImage === 3 && !isTransitioning && (
            <motion.div
              key="climbing"
              className="absolute top-0 left-[30%]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1 }}
            >
              <img 
                src="/boy_climbing.png" 
                alt="Youth athlete climbing" 
                className="h-96 w-auto drop-shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Overlay Gradient */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"
        style={{ opacity }}
      />

      {/* "The Complete Athlete" Text */}
      <motion.div
        className="absolute top-[20%] right-8 z-20"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <h2 className="text-6xl md:text-8xl font-display font-bold text-white drop-shadow-2xl text-right">
          THE COMPLETE<br />
          ATHLETE
        </h2>
      </motion.div>

      {/* Activity Boxes - Front Layer */}
      <div className="absolute left-8 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-3">
        {activities.map((activity, index) => {
          const IconComponent = activity.icon
          return (
            <motion.div
              key={activity.name}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.05 }}
            >
              <div className="bg-white backdrop-blur-sm px-4 py-3 rounded-xl border-2 border-vortex-red flex items-center gap-3 w-56">
                <IconComponent className="w-6 h-6 text-vortex-red flex-shrink-0" />
                <p className="text-black text-sm font-semibold whitespace-nowrap">{activity.name}</p>
              </div>
            </motion.div>
          )
        })}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className="bg-vortex-red px-4 py-3 rounded-xl border-2 border-white flex items-center justify-center w-56">
            <p className="text-white text-sm font-semibold whitespace-nowrap">Stay Informed</p>
          </div>
        </motion.div>
      </div>

      {/* Atmospheric Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-transparent to-black/20" />
        <div className="absolute top-1/4 left-0 right-0 h-1/2 bg-gradient-radial from-vortex-red/10 to-transparent" />
      </div>

      {/* Shimmer Effects */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 2,
          ease: 'linear'
        }}
      />
    </section>
  )
}

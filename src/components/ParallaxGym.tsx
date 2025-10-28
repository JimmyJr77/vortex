import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'
import { Activity, Zap, Gauge, Wind, Flame, Dumbbell, TrendingUp, Play, Shield, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ParallaxGym() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedActivity, setSelectedActivity] = useState(0)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  })

  const y1 = useTransform(scrollYProgress, [0, 1], ['-20%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3])
  

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

      {/* Overlay Gradient */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"
        style={{ opacity }}
      />

      {/* Complete Athlete Title */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <h2 className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white drop-shadow-2xl">
          Complete Athlete
        </h2>
      </motion.div>

      {/* Activity Carousel */}
      <div className="absolute bottom-[25%] left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-3 w-[280px]">
          <button
            onClick={() => setSelectedActivity((prev) => (prev === 0 ? activities.length - 1 : prev - 1))}
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <motion.div
            key={selectedActivity}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white backdrop-blur-sm px-6 py-4 rounded-xl border-2 border-vortex-red flex items-center gap-3 w-full"
          >
            {(() => {
              const IconComponent = activities[selectedActivity].icon
              return (
                <>
                  <IconComponent className="w-7 h-7 text-vortex-red flex-shrink-0" />
                  <p className="text-black text-base font-bold text-center flex-1">{activities[selectedActivity].name}</p>
                </>
              )
            })()}
          </motion.div>

          <button
            onClick={() => setSelectedActivity((prev) => (prev === activities.length - 1 ? 0 : prev + 1))}
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full p-2 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Carousel Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {activities.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedActivity(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === selectedActivity ? 'bg-white w-8' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
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

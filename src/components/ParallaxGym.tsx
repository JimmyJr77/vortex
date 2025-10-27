import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Activity, Zap, Gauge, Wind, Flame, Dumbbell, TrendingUp, Play, Shield } from 'lucide-react'

export default function ParallaxGym() {
  const containerRef = useRef<HTMLDivElement>(null)
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

      {/* "The Complete Athlete" Text */}
      <motion.div
        className="absolute top-[12%] right-8 z-20 lg:top-[12%] sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:text-center sm:right-auto"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <h2 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold text-white drop-shadow-2xl text-right sm:text-center">
          THE COMPLETE<br />
          ATHLETE
        </h2>
      </motion.div>

      {/* Activity Boxes - Front Layer */}
      <div className="absolute left-8 lg:left-8 lg:top-[12%] top-[20%] lg:transform-none transform -translate-y-0 z-10 flex flex-col sm:grid sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-col lg:gap-3 gap-3 sm:justify-center sm:left-1/2 sm:-translate-x-1/2">
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

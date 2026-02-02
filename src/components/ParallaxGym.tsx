import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { Activity, Zap, Gauge, Wind, Flame, Dumbbell, Play, Shield, ChevronLeft, ChevronRight, Building2, Scale } from 'lucide-react'

export default function ParallaxGym() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedActivity, setSelectedActivity] = useState(0)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const y1 = useTransform(scrollYProgress, [0, 1], ['-20%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3])
  
  // Map activity names to their background images
  const activityImageMap: Record<string, string> = {
    'Premium Facilities': '/gym_background.png',
    'Gymnastics': '/gymnastics.jpeg',
    'Trampoline': '/trampoline.jpeg',
    'Tumbling & Flips': '/tumbling.jpeg',
    'Ninja Training': '/ninja.jpeg',
    'Strength Training': '/strength.jpeg',
    'Plyometrics': '/plyometrics.jpeg',
    'Speed Work': '/speed.jpeg',
    'Agility Drills': '/agility.jpeg',
    'Multi-Sport Training': '/multisport.jpeg',
    'Balance': '/balance.jpeg',
  }

  const activities = [
    { icon: Dumbbell, name: 'Strength Training' },
    { icon: Building2, name: 'Premium Facilities' },
    { icon: Activity, name: 'Gymnastics' },
    { icon: Zap, name: 'Trampoline' },
    { icon: Zap, name: 'Tumbling & Flips' },
    { icon: Shield, name: 'Ninja Training' },
    { icon: Flame, name: 'Plyometrics' },
    { icon: Wind, name: 'Speed Work' },
    { icon: Gauge, name: 'Agility Drills' },
    { icon: Scale, name: 'Balance' },
    { icon: Play, name: 'Multi-Sport Training' }
    // Coordination Games temporarily hidden
  ]

  // Get the current background image based on selected activity
  const currentActivityName = activities[selectedActivity]?.name || 'Premium Facilities'
  const currentBackgroundImage = activityImageMap[currentActivityName] || '/gym_background.png'

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
        <AnimatePresence>
          <motion.div 
            key={currentBackgroundImage}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${currentBackgroundImage})`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Subtle overlay for text readability */}
            <div className="absolute inset-0 bg-black/20" />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Overlay Gradient */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"
        style={{ opacity }}
      />

      {/* THE COMPLETE ATHLETE Title - 8% from top */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20 w-full">
        <motion.h2 
          className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white drop-shadow-2xl text-center"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          THE COMPLETE ATHLETE
        </motion.h2>
      </div>

      {/* Activity Carousel */}
      <div className="absolute bottom-[8%] left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center">
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
            className="bg-white backdrop-blur-sm px-3 py-3 rounded-xl border-2 border-vortex-red flex items-center justify-center w-full h-20"
          >
            <p className="text-black text-base font-bold text-center leading-tight">{activities[selectedActivity].name}</p>
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

        {/* Activity Description */}
        <motion.div
          key={selectedActivity}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-6 w-[600px] max-w-[90vw]"
        >
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 min-h-[120px] flex items-center justify-center">
            <p className="text-white text-sm leading-relaxed text-center">
              {activities[selectedActivity].name === 'Premium Facilities' && 
                "State-of-the-art equipment across multiple training zones. Our world-class facility provides the foundation for developing all 8 core tenets—from explosive power zones to precision body control spaces, every athlete gets the tools they need to excel."}
              
              {activities[selectedActivity].name === 'Gymnastics' && 
                "The foundation of athletic excellence. Develops core tenets: Flexibility, Balance, Coordination, and Body Control. Elite body awareness translates directly to any sport."}
              
              {activities[selectedActivity].name === 'Trampoline' && 
                "Develops aerial awareness, Coordination, and Balance while building explosive power. Athletes learn to control their body in space—essential for any dynamic sport."}
              
              {activities[selectedActivity].name === 'Tumbling & Flips' && 
                "Builds Body Control, Spatial Awareness, and Coordination. Every flip strengthens the connection between mind and body, creating agile athletes ready for any challenge."}
              
              {activities[selectedActivity].name === 'Ninja Training' && 
                "Functional movement meets elite athleticism. Develops Agility, Coordination, and Body Control through obstacle-based training that translates directly to competitive performance."}
              
              {activities[selectedActivity].name === 'Strength Training' && 
                "Raw power development. Builds foundational Strength and Explosiveness while improving overall athletic performance. Strong athletes dominate in every arena."}
              
              {activities[selectedActivity].name === 'Plyometrics' && 
                "Explosive power and Speed development. Jump training builds the elastic strength needed to generate maximum force quickly—critical for competitive athletes."}
              
              {activities[selectedActivity].name === 'Speed Work' && 
                "Elite Speed and Explosiveness training. Perfect sprint mechanics and acceleration patterns develop the raw velocity needed to outperform the competition."}
              
              {activities[selectedActivity].name === 'Agility Drills' && 
                "Sharpens Agility, Coordination, and Change of Direction. Pattern recognition and quick-twitch responses create unpredictable, unstoppable athletes."}
              
              {activities[selectedActivity].name === 'Balance' && 
                "Develops core stability and proprioception. Balance training enhances body control, reduces injury risk, and creates a foundation for all athletic movements."}
              
              {activities[selectedActivity].name === 'Multi-Sport Training' && 
                "Transferable skill development across all athletic domains. Combines all 8 core tenets to create adaptable champions who excel regardless of sport."}
            </p>
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

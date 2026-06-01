import { motion } from 'framer-motion'

interface HeroScrollHintProps {
  className?: string
}

/** Animated mouse scroll cue for the gymnastics hero. */
const HeroScrollHint = ({ className = '' }: HeroScrollHintProps) => (
  <motion.div
    className={`flex justify-center pointer-events-none ${className}`}
    animate={{ y: [0, 10, 0] }}
    transition={{ duration: 2, repeat: Infinity }}
    aria-hidden
  >
    <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
      <motion.div
        className="w-1 h-3 bg-vortex-red rounded-full mt-2"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  </motion.div>
)

export default HeroScrollHint

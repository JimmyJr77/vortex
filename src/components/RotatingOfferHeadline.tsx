import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface OfferHeadline {
  leading: string
  emphasis: string
  trailing?: string
}

interface RotatingOfferHeadlineProps {
  headlines: OfferHeadline[]
}

export default function RotatingOfferHeadline({ headlines }: RotatingOfferHeadlineProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (headlines.length < 2) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % headlines.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [headlines.length])

  return (
    <div
      className="flex min-h-[30rem] items-center justify-center py-6 md:min-h-[38rem] md:py-10"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        <motion.h2
          key={activeIndex}
          className="max-w-6xl text-center text-4xl font-display font-bold uppercase tracking-tight text-black sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ lineHeight: 2 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.45 }}
        >
          {headlines[activeIndex].leading}{' '}
          <span className="text-vortex-red">{headlines[activeIndex].emphasis}</span>
          {headlines[activeIndex].trailing ? ` ${headlines[activeIndex].trailing}` : ''}
        </motion.h2>
      </AnimatePresence>
    </div>
  )
}

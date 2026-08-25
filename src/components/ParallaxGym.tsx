import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const ROTATING_GYM_IMAGES = [
  { src: '/strength-1600.webp', alt: 'Strength training at Vortex' },
  { src: '/ninja-1600.webp', alt: 'Ninja training at Vortex' },
  { src: '/plyometrics-1600.webp', alt: 'Plyometrics training at Vortex' },
  { src: '/gymnastics-1600.webp', alt: 'Gymnastics training at Vortex' },
  { src: '/agility-1600.webp', alt: 'Agility drills at Vortex' },
  { src: '/gym-DSC02672-1600.webp', alt: 'Vortex Athletics gymnastics training area' },
  { src: '/gym-DSC02674-1600.webp', alt: 'Ninja obstacle and climbing equipment at Vortex' },
  { src: '/gym-DSC02678-1600.webp', alt: 'Gymnastics equipment beneath the Vortex Athletics wall logo' },
  { src: '/gym-DSC02682-1600.webp', alt: 'Vortex transformation message wall' },
  { src: '/gym-DSC02683-1600.webp', alt: 'Ninja rigs, climbing wall, and basketball hoops at Vortex' },
  { src: '/gym-DSC02684-1600.webp', alt: 'Athlete cubbies and training equipment at Vortex' },
  { src: '/gym-DSC02688-1600.webp', alt: 'Tumbling track and gymnastics floor at Vortex' },
  { src: '/gym-DSC02689-1600.webp', alt: 'Full spring floor and tumbling track at Vortex' },
  { src: '/gym-DSC02690-1600.webp', alt: 'Wide view of the Vortex training gym' },
  { src: '/gym-DSC02700-1600.webp', alt: 'In-ground trampoline training station at Vortex' },
  { src: '/gym-DSC02703-1600.webp', alt: 'Gymnastics floor and ninja training area at Vortex' },
  { src: '/gym-DSC02711-1600.webp', alt: 'International flags displayed inside Vortex Athletics' },
  { src: '/gym-DSC02724-1600.webp', alt: 'Medicine balls and strength equipment at Vortex' },
  { src: '/gym-DSC02726-1600.webp', alt: 'Hanging grip obstacles on the Vortex ninja rig' },
  { src: '/gym-DSC02636-1600.webp', alt: 'Vortex gymnastics area and brand mark' },
  { src: '/gym-DSC02646-1600.webp', alt: 'Vortex Athletics logo above the gymnastics floor' },
]

export default function ParallaxGym() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [useCompactLayout, setUseCompactLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-20%', '20%'])
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 1, 0.4])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % ROTATING_GYM_IMAGES.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateLayout = () => setUseCompactLayout(mediaQuery.matches)
    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  const activeImage = ROTATING_GYM_IMAGES[activeImageIndex]

  return (
    <section ref={containerRef} className="relative h-[100svh] min-h-[38rem] overflow-hidden bg-black">
      <motion.div
        className="absolute inset-0 flex items-center"
        style={{ y: useCompactLayout ? 0 : backgroundY }}
      >
        <AnimatePresence mode="popLayout">
          <motion.img
            key={activeImage.src}
            src={activeImage.src}
            alt={activeImage.alt}
            decoding="async"
            className={
              useCompactLayout
                ? 'relative h-auto w-full object-contain'
                : 'absolute inset-0 h-full w-full object-cover'
            }
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />
        </AnimatePresence>
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/15 to-black/75"
        style={{ opacity: overlayOpacity }}
      />

      <div className="absolute inset-x-0 top-[9%] z-20 px-4">
        <motion.h2
          className="text-center text-5xl font-display font-bold text-white drop-shadow-2xl sm:text-6xl md:text-7xl"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          THE COMPLETE ATHLETE
        </motion.h2>
      </div>

      <div className="absolute inset-x-0 bottom-[9%] z-20 px-4">
        <motion.p
          className="text-center text-5xl font-display font-bold text-white drop-shadow-2xl sm:text-6xl md:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          NEEDS A COMPLETE GYM
        </motion.p>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15" />
    </section>
  )
}

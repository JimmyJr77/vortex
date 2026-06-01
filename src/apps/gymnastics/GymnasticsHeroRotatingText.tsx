import { AnimatePresence, motion } from 'framer-motion'
import type { GymnasticsHeroSlide } from './gymnasticsHeroSlides'

/** Shared vertical gap between hero text, indicators, and CTAs (see GymnasticsPage). */
export const GYMNASTICS_HERO_SECTION_GAP = 'gap-8'

interface GymnasticsHeroRotatingTextProps {
  slideIndex: number
  slide: GymnasticsHeroSlide
  showTitle?: boolean
  showDescription?: boolean
  titleClassName?: string
  descriptionClassName?: string
}

interface GymnasticsHeroIndicatorsProps {
  slideIndex: number
  slideCount: number
  onSelectSlide: (index: number) => void
  className?: string
}

export const GymnasticsHeroIndicators = ({
  slideIndex,
  slideCount,
  onSelectSlide,
  className = '',
}: GymnasticsHeroIndicatorsProps) => {
  if (slideCount <= 1) return null

  return (
    <div
      className={`flex justify-center gap-2 shrink-0 ${className}`}
      role="tablist"
      aria-label="Hero message slides"
    >
      {Array.from({ length: slideCount }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === slideIndex}
          onClick={() => onSelectSlide(i)}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i === slideIndex ? 'bg-vortex-red' : 'bg-white/35 hover:bg-white/55'
          }`}
          aria-label={`Show hero message ${i + 1} of ${slideCount}`}
        />
      ))}
    </div>
  )
}

const GymnasticsHeroRotatingText = ({
  slideIndex,
  slide,
  showTitle = true,
  showDescription = true,
  titleClassName = '',
  descriptionClassName = '',
}: GymnasticsHeroRotatingTextProps) => (
  <div className="relative w-full flex flex-col items-center gap-4 md:gap-6">
    {showTitle && (
      <div className="relative min-h-[4.5rem] sm:min-h-[5.5rem] md:min-h-[6.5rem] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`title-${slideIndex}`}
            className={titleClassName}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
          >
            {slide.titleHighlight ? (
              <>
                {slide.title}{' '}
                <span className="text-vortex-red">{slide.titleHighlight}</span>
              </>
            ) : (
              slide.title
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )}

    {showDescription && (
      <div className="relative min-h-[5rem] sm:min-h-[5.5rem] md:min-h-[6rem] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`desc-${slideIndex}`}
            className={descriptionClassName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: 'easeInOut', delay: 0.05 }}
          >
            {slide.description}
          </motion.p>
        </AnimatePresence>
      </div>
    )}
  </div>
)

export default GymnasticsHeroRotatingText

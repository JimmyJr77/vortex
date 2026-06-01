interface HeroPosterBackgroundProps {
  posterFileName?: string
  className?: string
  overlayClassName?: string
}

/** Static hero background image with optional dark overlay (no video). */
const HeroPosterBackground = ({
  posterFileName = 'main_hero_bg.png',
  className = 'absolute inset-0 w-full h-full',
  overlayClassName = 'absolute inset-0 bg-black/50 z-[1] pointer-events-none',
}: HeroPosterBackgroundProps) => (
  <div className={className} aria-hidden>
    <img
      src={`/${posterFileName}`}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      loading="eager"
      fetchPriority="high"
    />
    {overlayClassName ? <div className={overlayClassName} /> : null}
  </div>
)

export default HeroPosterBackground

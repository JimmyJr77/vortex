import { Suspense, useEffect, useRef, useState } from 'react'
import searchPhotos from '../config/publicSearchPhotos.json'
import { lazyWithRetry } from '../utils/chunkLoadRecovery'

const ParallaxGymMotion = lazyWithRetry(() => import('./ParallaxGymMotion'))

function GymPoster() {
  return <>
    <div className="absolute inset-0 flex items-center">
      <img
        src={searchPhotos.homepageGallery.strengthTraining.src}
        alt={searchPhotos.homepageGallery.strengthTraining.alt}
        loading="lazy"
        decoding="async"
        className="relative h-auto w-full object-contain md:absolute md:inset-0 md:h-full md:object-cover"
      />
    </div>
    <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/15 to-black/75" />
  </>
}

export default function ParallaxGym({ paused = false }: { paused?: boolean }) {
  const containerRef = useRef<HTMLElement>(null)
  // Null means the section has not approached the viewport yet.
  const [nearViewport, setNearViewport] = useState<boolean | null>(null)

  useEffect(() => {
    const section = containerRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(previous => entry.isIntersecting ? true : previous === null ? null : false)
    }, { rootMargin: '320px 0px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const displayFont = nearViewport === null ? '' : 'font-display'

  return (
    <section ref={containerRef} className="relative h-[100svh] min-h-[38rem] overflow-hidden bg-black">
      {nearViewport === null ? <GymPoster /> : (
        <Suspense fallback={<GymPoster />}>
          <ParallaxGymMotion containerRef={containerRef} paused={paused || !nearViewport} />
        </Suspense>
      )}
      <h2 className={`absolute inset-x-0 top-[9%] z-20 px-4 text-center text-5xl font-bold text-white drop-shadow-2xl sm:text-6xl md:text-7xl ${displayFont}`}>
        THE COMPLETE ATHLETE
      </h2>
      <p className={`absolute inset-x-0 bottom-[9%] z-20 px-4 text-center text-5xl font-bold text-white drop-shadow-2xl sm:text-6xl md:text-7xl ${displayFont}`}>
        NEEDS A COMPLETE GYM
      </p>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15" />
    </section>
  )
}

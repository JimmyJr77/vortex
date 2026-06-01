import { useEffect, useState } from 'react'
import { GYMNASTICS_HERO_SLIDES } from './gymnasticsHeroSlides'

const ROTATION_MS = 6000

export function useGymnasticsHeroRotation(intervalMs = ROTATION_MS) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % GYMNASTICS_HERO_SLIDES.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return {
    index,
    slide: GYMNASTICS_HERO_SLIDES[index],
    slides: GYMNASTICS_HERO_SLIDES,
    setIndex,
  }
}

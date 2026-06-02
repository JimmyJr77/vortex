import { useEffect, type RefObject } from 'react'

const CSS_VAR = '--site-header-height'

/** Sync fixed header height to :root so heroes can use pt-[var(--site-header-height)]. */
export function useSiteHeaderHeight(headerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = headerRef.current
    if (!el) return

    const sync = () => {
      document.documentElement.style.setProperty(CSS_VAR, `${el.offsetHeight}px`)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [headerRef])
}

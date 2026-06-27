import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { Highlight } from '../types/highlights'
import { getApiUrl } from '../utils/api'
import {
  recordCarouselShown,
  shouldAutoOpenCarousel,
} from '../utils/highlightFrequency'
import { getHighlightSiteKey } from '../utils/highlightSite'

interface UseSiteHighlightsOptions {
  /** Only auto-open on home page when true (default). */
  homePageOnly?: boolean
}

export function useSiteHighlights(options: UseSiteHighlightsOptions = {}) {
  const { homePageOnly = true } = options
  const location = useLocation()
  const siteKey = useMemo(() => getHighlightSiteKey(), [])

  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)

  const isHomePage = location.pathname === '/' || location.pathname === ''
  const skipAutoOpenForLogin =
    new URLSearchParams(location.search).get('login') === '1'

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `${getApiUrl()}/api/highlights?site=${encodeURIComponent(siteKey)}`,
        )
        if (!res.ok) throw new Error('Failed to load highlights')
        const data = await res.json()
        if (!cancelled) {
          setHighlights(Array.isArray(data.highlights) ? data.highlights : [])
        }
      } catch {
        if (!cancelled) setHighlights([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [siteKey])

  const shouldAutoOpen = useMemo(() => {
    if (highlights.length === 0) return false
    if (skipAutoOpenForLogin) return false
    if (homePageOnly && !isHomePage) return false
    return shouldAutoOpenCarousel(siteKey, highlights)
  }, [highlights, homePageOnly, isHomePage, siteKey, skipAutoOpenForLogin])

  useEffect(() => {
    if (
      !loading &&
      shouldAutoOpen &&
      !hasAutoOpened &&
      highlights.length > 0
    ) {
      setIsOpen(true)
      setHasAutoOpened(true)
      recordCarouselShown(siteKey, highlights)
    }
  }, [loading, shouldAutoOpen, hasAutoOpened, highlights, siteKey])

  const open = useCallback(() => {
    if (highlights.length === 0) return
    setIsOpen(true)
    recordCarouselShown(siteKey, highlights)
  }, [highlights, siteKey])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    highlights,
    loading,
    isOpen,
    open,
    close,
    siteKey,
    hasHighlights: highlights.length > 0,
  }
}

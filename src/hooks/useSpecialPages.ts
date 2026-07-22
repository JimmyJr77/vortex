import { useEffect, useState } from 'react'
import { getApiUrl } from '../utils/api'
import {
  DEFAULT_SPECIAL_PAGES,
  type SpecialPageConfig,
} from '../types/specialPages'

let cachedPages: SpecialPageConfig[] | null = null
let pendingRequest: Promise<SpecialPageConfig[]> | null = null
const SPECIAL_PAGES_CHANGED_EVENT = 'vortex:special-pages-changed'

const loadSpecialPages = async () => {
  if (cachedPages) return cachedPages
  if (!pendingRequest) {
    pendingRequest = fetch(`${getApiUrl()}/api/special-pages`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load special pages')
        const body = await response.json()
        return Array.isArray(body.pages)
          ? body.pages
          : Array.isArray(body.specialPages)
            ? body.specialPages
            : DEFAULT_SPECIAL_PAGES
      })
      .catch(() => DEFAULT_SPECIAL_PAGES)
      .then((pages) => {
        cachedPages = pages
        return pages
      })
      .finally(() => {
        pendingRequest = null
      })
  }
  return pendingRequest
}

export const clearSpecialPagesCache = () => {
  cachedPages = null
  window.dispatchEvent(new Event(SPECIAL_PAGES_CHANGED_EVENT))
}

export default function useSpecialPages() {
  const [pages, setPages] = useState<SpecialPageConfig[]>(
    () => cachedPages ?? DEFAULT_SPECIAL_PAGES,
  )
  const [loading, setLoading] = useState(!cachedPages)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      setLoading(true)
      void loadSpecialPages().then((nextPages) => {
        if (!cancelled) {
          setPages(nextPages)
          setLoading(false)
        }
      })
    }
    refresh()
    window.addEventListener(SPECIAL_PAGES_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(SPECIAL_PAGES_CHANGED_EVENT, refresh)
    }
  }, [])

  return { pages, loading }
}

import type { Highlight, HighlightDisplayFrequency } from '../types/highlights'

const seenKey = (siteKey: string, highlightId: number) =>
  `vortex_highlight_seen_${siteKey}_${highlightId}`

const lastShownKey = (siteKey: string, highlightId: number) =>
  `vortex_highlight_last_${siteKey}_${highlightId}`

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

export function shouldAutoShowHighlight(
  siteKey: string,
  highlightId: number,
  frequency: HighlightDisplayFrequency,
): boolean {
  if (frequency === 'never') return false
  if (frequency === 'every_visit') return true
  if (frequency === 'first_visit') {
    return localStorage.getItem(seenKey(siteKey, highlightId)) !== '1'
  }

  const lastRaw = localStorage.getItem(lastShownKey(siteKey, highlightId))
  if (!lastRaw) return true

  const last = new Date(lastRaw).getTime()
  if (Number.isNaN(last)) return true

  const elapsed = Date.now() - last
  if (frequency === 'daily') return elapsed >= MS_PER_DAY
  if (frequency === 'weekly') return elapsed >= MS_PER_WEEK
  return false
}

export function recordHighlightShown(siteKey: string, highlightId: number): void {
  localStorage.setItem(seenKey(siteKey, highlightId), '1')
  localStorage.setItem(lastShownKey(siteKey, highlightId), new Date().toISOString())
}

export function shouldAutoOpenCarousel(
  siteKey: string,
  highlights: Highlight[],
): boolean {
  return highlights.some((h) =>
    shouldAutoShowHighlight(siteKey, h.id, h.displayFrequency),
  )
}

export function recordCarouselShown(siteKey: string, highlights: Highlight[]): void {
  for (const h of highlights) {
    recordHighlightShown(siteKey, h.id)
  }
}

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import type { Highlight } from '../../types/highlights'
import { getApiUrl } from '../../utils/api'
import { getHighlightSiteKey } from '../../utils/highlightSite'
import { HighlightSlide } from '../highlights/HighlightSlide'

function highlightSearchText(h: Highlight): string {
  const parts = [
    h.title,
    h.buttonLabel,
    h.buttonTextAbove,
    h.buttonTextBelow,
  ]
  if (h.contentType === 'event' && h.event) {
    parts.push(
      h.event.eventName,
      h.event.shortDescription,
      h.event.longDescription,
      h.event.address,
    )
  }
  return parts.filter(Boolean).join(' ').toLowerCase()
}

function matchesSearch(h: Highlight, query: string): boolean {
  if (!query.trim()) return true
  return highlightSearchText(h).includes(query.trim().toLowerCase())
}

function HighlightCtaFooter({ highlight }: { highlight: Highlight }) {
  const optionalText = highlight.buttonTextAbove?.trim()
  const showButton = highlight.buttonEnabled && highlight.buttonUrl
  const textBelowButton = showButton && highlight.buttonTextBelow?.trim()

  if (!optionalText && !showButton && !textBelowButton) return null

  return (
    <div className="mt-6 space-y-3">
      {optionalText && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{optionalText}</p>
      )}
      {showButton && (
        <a
          href={highlight.buttonUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700"
        >
          {highlight.buttonLabel?.trim() || 'Learn more'}
        </a>
      )}
      {textBelowButton && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap">
          {highlight.buttonTextBelow!.trim()}
        </p>
      )}
    </div>
  )
}

const ReadBoardHighlightsTab = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const siteKey = getHighlightSiteKey()

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
  }, [])

  const filteredHighlights = useMemo(
    () => highlights.filter((h) => matchesSearch(h, searchQuery)),
    [highlights, searchQuery],
  )

  if (loading) {
    return (
      <section className="section-padding bg-white">
        <div className="container-custom text-center py-12">
          <p className="text-xl text-gray-600">Loading highlights…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="section-padding bg-white">
      <div className="container-custom max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
            <span className="text-vortex-red">Highlights</span>
          </h2>

          <div className="relative mb-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search highlights…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors text-lg"
            />
          </div>

          {highlights.length === 0 ? (
            <p className="text-center text-xl text-gray-600 py-12">No highlights at this time.</p>
          ) : filteredHighlights.length === 0 ? (
            <p className="text-center text-xl text-gray-600 py-12">
              No highlights found matching &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            <div>
              {filteredHighlights.map((highlight, index) => (
                <article
                  key={highlight.id}
                  className={
                    index < filteredHighlights.length - 1
                      ? 'border-b border-gray-200 pb-10 mb-10'
                      : 'pb-4'
                  }
                >
                  {highlight.title?.trim() && (
                    <h3 className="text-xl font-display font-bold text-black mb-4">
                      {highlight.title}
                    </h3>
                  )}
                  <HighlightSlide highlight={highlight} />
                  <HighlightCtaFooter highlight={highlight} />
                </article>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}

export default ReadBoardHighlightsTab

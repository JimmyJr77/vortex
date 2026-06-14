import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Highlight } from '../../types/highlights'
import { getApiUrl } from '../../utils/api'
import { getHighlightSiteKey } from '../../utils/highlightSite'
import { HighlightSlide } from '../highlights/HighlightSlide'

const ReadBoardHighlightsTab = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)

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
          setIndex(0)
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

  if (loading) {
    return (
      <section className="section-padding bg-white">
        <div className="container-custom text-center py-12">
          <p className="text-xl text-gray-600">Loading highlights…</p>
        </div>
      </section>
    )
  }

  if (highlights.length === 0) {
    return (
      <section className="section-padding bg-white">
        <div className="container-custom text-center py-12">
          <p className="text-xl text-gray-600">No highlights at this time.</p>
        </div>
      </section>
    )
  }

  const current = highlights[index]
  const hasMultiple = highlights.length > 1
  const optionalText = current?.buttonTextAbove?.trim()
  const showButton = current?.buttonEnabled && current.buttonUrl
  const textBelowButton = showButton && current.buttonTextBelow?.trim()

  return (
    <section className="section-padding bg-white">
      <div className="container-custom max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-2 text-center">
            <span className="text-vortex-red">Highlights</span>
          </h2>
          {hasMultiple && (
            <p className="text-sm text-gray-500 text-center mb-8">
              {index + 1} of {highlights.length}
            </p>
          )}

          <div className="relative rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white overflow-hidden">
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setIndex((i) => (i - 1 + highlights.length) % highlights.length)
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 shadow text-gray-500 hover:text-gray-900"
                  aria-label="Previous highlight"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % highlights.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 shadow text-gray-500 hover:text-gray-900"
                  aria-label="Next highlight"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <div className="px-4 sm:px-8 py-8 min-h-[280px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.id ?? index}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  {current && <HighlightSlide highlight={current} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {hasMultiple && (
              <div className="flex justify-center gap-2 pb-6">
                {highlights.map((h, i) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      i === index ? 'bg-vortex-red' : 'bg-gray-300'
                    }`}
                    aria-label={`Go to highlight ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {(optionalText || showButton || textBelowButton) && (
              <div className="border-t border-gray-200 px-6 py-6 space-y-3 text-center">
                {optionalText && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{optionalText}</p>
                )}
                {showButton && (
                  <a
                    href={current.buttonUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700"
                  >
                    {current.buttonLabel?.trim() || 'Learn more'}
                  </a>
                )}
                {textBelowButton && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {current.buttonTextBelow!.trim()}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default ReadBoardHighlightsTab

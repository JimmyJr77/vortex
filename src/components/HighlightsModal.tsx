import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Highlight } from '../types/highlights'
import HighlightEventSlide from './highlights/HighlightEventSlide'
import HighlightDocumentSlide from './highlights/HighlightDocumentSlide'
import HighlightCanvasRenderer from './highlights/HighlightCanvasRenderer'
interface HighlightsModalProps {
  highlights: Highlight[]
  isOpen: boolean
  onClose: () => void
  initialIndex?: number
}

function renderSlide(h: Highlight) {
  if (h.contentType === 'event' && h.event) {
    return <HighlightEventSlide event={h.event} />
  }
  if (h.contentType === 'document' && h.documentMime && h.documentData) {
    return (
      <HighlightDocumentSlide
        documentMime={h.documentMime}
        documentData={h.documentData}
      />
    )
  }
  if (h.contentType === 'custom' && h.customContent) {
    return <HighlightCanvasRenderer canvas={h.customContent} />
  }
  return <p className="text-gray-500 text-sm">No content available for this highlight.</p>
}

const HighlightsModal = ({
  highlights,
  isOpen,
  onClose,
  initialIndex = 0,
}: HighlightsModalProps) => {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (isOpen) setIndex(initialIndex)
  }, [isOpen, initialIndex])

  useEffect(() => {
    if (index >= highlights.length && highlights.length > 0) {
      setIndex(0)
    }
  }, [index, highlights.length])

  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [isOpen])

  if (highlights.length === 0) return null

  const current = highlights[index]
  const hasMultiple = highlights.length > 1

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative bg-white rounded-3xl w-full max-w-[740px] max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
              aria-label="Close highlights"
            >
              <X className="w-6 h-6 text-gray-800" />
            </button>

            <div className="px-8 pt-8 pb-2 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 pr-10">Highlights</h2>
              {hasMultiple && (
                <p className="text-sm text-gray-500 mt-1">
                  {index + 1} of {highlights.length}
                </p>
              )}
            </div>

            <div className="flex-1 min-h-0 relative min-w-0 flex flex-col">
              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((i) => (i - 1 + highlights.length) % highlights.length)
                    }
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/90 shadow text-gray-500 hover:text-gray-900"
                    aria-label="Previous highlight"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i + 1) % highlights.length)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/90 shadow text-gray-500 hover:text-gray-900"
                    aria-label="Next highlight"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </>
              )}

              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y px-4 sm:px-6 py-4 [-webkit-overflow-scrolling:touch]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current?.id ?? index}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    {current && renderSlide(current)}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {hasMultiple && (
              <div className="flex justify-center gap-2 pb-4">
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

            <div className="border-t border-gray-200 px-6 py-4 rounded-b-3xl">
              {(() => {
                const optionalText = current?.buttonTextAbove?.trim()
                const showButton = current?.buttonEnabled && current.buttonUrl
                const textBelowButton =
                  showButton && current.buttonTextBelow?.trim()
                const hasFooterExtras = optionalText || showButton

                return (
                  <div
                    className={`flex flex-col gap-4 ${
                      hasFooterExtras
                        ? 'sm:flex-row sm:items-end sm:justify-between'
                        : 'sm:flex-row sm:justify-end'
                    }`}
                  >
                    {hasFooterExtras && (
                      <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                        {optionalText && (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {optionalText}
                          </p>
                        )}
                        {showButton && (
                          <a
                            href={current.buttonUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block w-full sm:w-auto bg-vortex-red text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700"
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
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto shrink-0 border border-gray-300 text-gray-800 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                )
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default HighlightsModal

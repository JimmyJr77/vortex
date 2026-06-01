import type { ReactNode } from 'react'
import { HIGHLIGHT_LETTER_WIDTH_PX } from '../../utils/highlightLayout'

interface HighlightLetterFrameProps {
  children: ReactNode
  className?: string
}

/**
 * Portal highlight content frame: letter width cap; height follows canvas.
 * Scrolling is handled by HighlightsModal’s body region (not nested here).
 */
const HighlightLetterFrame = ({ children, className = '' }: HighlightLetterFrameProps) => {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div
        className="w-full mx-auto rounded-lg border border-gray-200 bg-white box-border"
        style={{ maxWidth: HIGHLIGHT_LETTER_WIDTH_PX }}
      >
        {children}
      </div>
    </div>
  )
}

export default HighlightLetterFrame

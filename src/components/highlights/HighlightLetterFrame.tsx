import type { ReactNode } from 'react'
import {
  HIGHLIGHT_LETTER_WIDTH_PX,
  resolveHighlightModalHeightPx,
} from '../../utils/highlightLayout'

interface HighlightLetterFrameProps {
  children: ReactNode
  viewportHeightPx?: number
  className?: string
}

/**
 * Portal highlight viewport: full width of modal content, capped at letter width.
 */
const HighlightLetterFrame = ({
  children,
  viewportHeightPx,
  className = '',
}: HighlightLetterFrameProps) => {
  const heightPx = resolveHighlightModalHeightPx(viewportHeightPx)

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div
        className="w-full mx-auto rounded-lg border border-gray-200 bg-white overflow-y-auto overflow-x-hidden box-border"
        style={{
          maxWidth: HIGHLIGHT_LETTER_WIDTH_PX,
          height: heightPx,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default HighlightLetterFrame

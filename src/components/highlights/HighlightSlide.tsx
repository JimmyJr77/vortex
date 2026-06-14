import type { Highlight } from '../../types/highlights'
import HighlightEventSlide from './HighlightEventSlide'
import HighlightDocumentSlide from './HighlightDocumentSlide'
import HighlightCanvasRenderer from './HighlightCanvasRenderer'

export function HighlightSlide({ highlight }: { highlight: Highlight }) {
  if (highlight.contentType === 'event' && highlight.event) {
    return <HighlightEventSlide event={highlight.event} />
  }
  if (highlight.contentType === 'document' && highlight.documentMime && highlight.documentData) {
    return (
      <HighlightDocumentSlide
        documentMime={highlight.documentMime}
        documentData={highlight.documentData}
      />
    )
  }
  if (highlight.contentType === 'custom' && highlight.customContent) {
    return <HighlightCanvasRenderer canvas={highlight.customContent} />
  }
  return <p className="text-gray-500 text-sm">No content available for this highlight.</p>
}

import type { HighlightCanvas, HighlightElement } from '../../types/highlights'
import HighlightLetterFrame from './HighlightLetterFrame'
import HighlightCanvasViewport from './HighlightCanvasViewport'
import HighlightShapeContent from './HighlightShapeContent'
import { plainTextToHtml, sanitizeHighlightHtml } from '../../utils/highlightRichText'

interface HighlightCanvasRendererProps {
  canvas: HighlightCanvas
  className?: string
}

function renderElement(el: HighlightElement) {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    zIndex: el.zIndex,
    boxSizing: 'border-box',
  }

  if (el.type === 'text') {
    const html = sanitizeHighlightHtml(plainTextToHtml(el.text))
    return (
      <div
        key={el.id}
        className="highlight-rich-text"
        style={{
          ...base,
          fontSize: el.fontSize,
          color: el.color,
          backgroundColor: el.backgroundColor,
          border: `${el.borderWidth}px solid ${el.borderColor}`,
          padding: 8,
          overflow: 'auto',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  if (el.type === 'image') {
    return (
      <img
        key={el.id}
        src={el.src}
        alt=""
        style={{ ...base, objectFit: 'contain' }}
      />
    )
  }

  if (el.type === 'shape') {
    return (
      <div key={el.id} style={base}>
        <HighlightShapeContent element={el} />
      </div>
    )
  }

  return null
}

const HighlightCanvasRenderer = ({
  canvas,
  className = '',
}: HighlightCanvasRendererProps) => {
  const sorted = [...canvas.elements].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <HighlightLetterFrame className={className}>
      <HighlightCanvasViewport
        canvasWidth={canvas.width}
        canvasHeight={canvas.height}
        backgroundColor={canvas.backgroundColor}
      >
        {sorted.map(renderElement)}
      </HighlightCanvasViewport>
    </HighlightLetterFrame>
  )
}

export default HighlightCanvasRenderer

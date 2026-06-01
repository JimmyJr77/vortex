import type { HighlightShapeElement } from '../../types/highlights'
import { getLineOrientation } from '../../utils/highlightLineShape'

interface HighlightShapeContentProps {
  element: HighlightShapeElement
}

/** Shape drawing shared by canvas editor and public renderer (full element bounds). */
const HighlightShapeContent = ({ element: el }: HighlightShapeContentProps) => {
  if (el.shape === 'circle') {
    return (
      <div
        className="w-full h-full rounded-full box-border"
        style={{
          backgroundColor: el.fill,
          border: `${el.strokeWidth}px solid ${el.stroke}`,
        }}
      />
    )
  }

  if (el.shape === 'line') {
    const vertical = getLineOrientation(el) === 'vertical'
    const thickness = el.strokeWidth || 2
    return (
      <div className="w-full h-full relative">
        {vertical ? (
          <div
            className="absolute top-0 bottom-0"
            style={{
              width: thickness,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: el.stroke,
            }}
          />
        ) : (
          <div
            className="absolute left-0 right-0"
            style={{
              height: thickness,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: el.stroke,
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className="w-full h-full box-border"
      style={{
        backgroundColor: el.fill,
        border: `${el.strokeWidth}px solid ${el.stroke}`,
      }}
    />
  )
}

export default HighlightShapeContent

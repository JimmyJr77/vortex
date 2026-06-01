import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HIGHLIGHT_LETTER_WIDTH_PX } from '../../utils/highlightLayout'

interface HighlightCanvasViewportProps {
  /** Logical canvas width in px (coordinates). */
  canvasWidth: number
  canvasHeight: number
  backgroundColor: string
  children: ReactNode
  className?: string
}

/**
 * Displays a highlight canvas at portal width: scales down when the container is narrower
 * than {@link HIGHLIGHT_LETTER_WIDTH_PX} so content never overflows the modal.
 */
const HighlightCanvasViewport = ({
  canvasWidth,
  canvasHeight,
  backgroundColor,
  children,
  className = '',
}: HighlightCanvasViewportProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const available = el.clientWidth
      if (available <= 0) return
      setScale(Math.min(1, available / canvasWidth))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [canvasWidth])

  const displayW = Math.round(canvasWidth * scale)
  const displayH = Math.round(canvasHeight * scale)

  return (
    <div ref={containerRef} className={`w-full max-w-full mx-auto ${className}`}>
      <div
        className="relative mx-auto shrink-0 overflow-hidden"
        style={{
          width: displayW,
          height: displayH,
          maxWidth: '100%',
          backgroundColor,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export { HIGHLIGHT_LETTER_WIDTH_PX }
export default HighlightCanvasViewport

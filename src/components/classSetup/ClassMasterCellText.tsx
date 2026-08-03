import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  /** When true, wrap within the cell. When false, single-line ellipsis. */
  wrap: boolean
}

/**
 * Class Master cell text: wrap mode, or straight truncate with hover popup for full content.
 */
const ClassMasterCellText = ({ value, wrap }: Props) => {
  const textRef = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el || wrap) {
      setTruncated(false)
      return
    }
    const measure = () => {
      setTruncated(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, wrap])

  useLayoutEffect(() => {
    if (!showPopup || !truncated || wrap) {
      setPopupPos(null)
      return
    }
    const el = textRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPopupPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
    })
  }, [showPopup, truncated, wrap, value])

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={() => {
        if (!wrap && truncated) setShowPopup(true)
      }}
      onMouseLeave={() => setShowPopup(false)}
    >
      <div
        ref={textRef}
        className={
          wrap
            ? 'line-clamp-[8] whitespace-pre-wrap break-words'
            : 'overflow-hidden text-ellipsis whitespace-nowrap'
        }
      >
        {value}
      </div>
      {showPopup &&
        truncated &&
        !wrap &&
        value &&
        popupPos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none z-[100] max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-lg whitespace-pre-wrap break-words"
            style={{
              position: 'fixed',
              top: popupPos.top,
              left: popupPos.left,
              width: popupPos.width,
            }}
          >
            {value}
          </div>,
          document.body,
        )}
    </div>
  )
}

export default ClassMasterCellText

import { useRef, useState, type ReactNode } from 'react'

interface MessagingThreadDetailShellProps {
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const MIN_FOOTER_HEIGHT = 120
const DEFAULT_FOOTER_HEIGHT = 184

function maxFooterHeight() {
  if (typeof window === 'undefined') return 360
  return Math.floor(window.innerHeight * 0.45)
}

/** Thread detail: fixed header/footer with a single scroll region for messages + contextual blocks. */
export default function MessagingThreadDetailShell({
  header,
  footer,
  children,
}: MessagingThreadDetailShellProps) {
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerHeight, setFooterHeight] = useState(DEFAULT_FOOTER_HEIGHT)
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null)

  const clampFooterHeight = (height: number) => {
    return Math.min(maxFooterHeight(), Math.max(MIN_FOOTER_HEIGHT, height))
  }

  const endResize = () => {
    dragState.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const startResize = (clientY: number) => {
    const el = footerRef.current
    const measured = el?.getBoundingClientRect().height ?? footerHeight
    const startHeight = measured
    setFooterHeight(startHeight)
    dragState.current = { startY: clientY, startHeight }

    const onMove = (moveClientY: number) => {
      const drag = dragState.current
      if (!drag) return
      const delta = drag.startY - moveClientY
      setFooterHeight(clampFooterHeight(drag.startHeight + delta))
    }

    const onMouseMove = (e: MouseEvent) => {
      onMove(e.clientY)
    }

    const onMouseUp = () => {
      endResize()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      onMove(e.touches[0].clientY)
    }

    const onTouchEnd = () => {
      endResize()
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
  }

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startResize(e.clientY)
  }

  const onResizeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return
    startResize(e.touches[0].clientY)
  }

  return (
    <div
      className="flex-1 h-full min-h-0 max-h-full overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: footer
          ? `auto minmax(0, 1fr) ${footerHeight}px`
          : 'auto minmax(0, 1fr)',
      }}
    >
      <div className="min-h-0">{header}</div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      {footer ? (
        <div
          ref={footerRef}
          className="min-h-0 border-t border-gray-100 bg-white flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize reply area"
            onMouseDown={onResizeMouseDown}
            onTouchStart={onResizeTouchStart}
            className="shrink-0 h-2 cursor-ns-resize touch-none flex items-center justify-center hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">{footer}</div>
        </div>
      ) : null}
    </div>
  )
}

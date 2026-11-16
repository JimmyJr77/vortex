import { useId, useRef, useState, type ReactNode } from 'react'

interface MessagingThreadDetailShellProps {
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const MIN_FOOTER_HEIGHT = 112

/** Header and composer stay visible while the conversation scrolls independently. */
export default function MessagingThreadDetailShell({ header, footer, children }: MessagingThreadDetailShellProps) {
  const contentId = useId()
  const shellRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerHeight, setFooterHeight] = useState<number | null>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)

  const heightNow = () => footerRef.current?.getBoundingClientRect().height ?? MIN_FOOTER_HEIGHT
  const maxHeight = () => Math.max(MIN_FOOTER_HEIGHT, Math.floor((shellRef.current?.clientHeight ?? 640) * 0.58))
  const resize = (height: number) => setFooterHeight(Math.min(maxHeight(), Math.max(MIN_FOOTER_HEIGHT, height)))

  return (
    <div ref={shellRef} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">{header}</div>
      <div id={contentId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && (
        <div
          ref={footerRef}
          style={footerHeight == null ? undefined : { height: footerHeight, maxHeight: '58%' }}
          className="relative z-10 flex min-h-min shrink-0 flex-col border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-label="Resize reply area"
            title="Drag or use arrow keys to resize. Double-click to reset."
            onDoubleClick={() => setFooterHeight(null)}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowUp' ? heightNow() + 20
                : event.key === 'ArrowDown' ? heightNow() - 20
                  : event.key === 'Home' ? MIN_FOOTER_HEIGHT
                    : event.key === 'End' ? maxHeight()
                      : null
              if (next == null && event.key !== 'Escape') return
              event.preventDefault()
              if (next == null) setFooterHeight(null)
              else resize(next)
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              drag.current = { y: event.clientY, height: heightNow() }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (drag.current) resize(drag.current.height + drag.current.y - event.clientY)
            }}
            onLostPointerCapture={() => { drag.current = null }}
            className="flex h-3 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center hover:bg-slate-100 focus-visible:bg-slate-100"
          >
            <span className="h-1 w-9 rounded-full bg-slate-300" aria-hidden />
          </div>
          <div className="flex min-h-min flex-1 flex-col">{footer}</div>
        </div>
      )}
    </div>
  )
}

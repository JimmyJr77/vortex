import { useRef } from 'react'

interface Props {
  label: string
  side: 'left' | 'right'
  width: number
  maxWidth: number
  defaultWidth: number
  busy: boolean
  onPreview: (width: number | null) => void
  onCommit: (width: number) => Promise<void>
}

export default function MessagingResizeHandle({ label, side, width, maxWidth, defaultWidth, busy, onPreview, onCommit }: Props) {
  const drag = useRef<{ x: number; width: number; next: number } | null>(null)
  const clamp = (value: number) => Math.round(Math.min(maxWidth, Math.max(240, value)))
  const commit = async (value: number) => {
    onPreview(value)
    try { await onCommit(value) } finally { onPreview(null) }
  }
  const cancel = () => { drag.current = null; onPreview(null) }

  return <div
    role="separator"
    tabIndex={busy ? -1 : 0}
    aria-label={label}
    aria-orientation="vertical"
    aria-valuemin={240}
    aria-valuemax={maxWidth}
    aria-valuenow={width}
    aria-valuetext={`${width} pixels`}
    aria-disabled={busy}
    title="Drag to resize. Use left/right arrows. Double-click to reset."
    className={`absolute inset-y-0 z-20 flex w-3 touch-none select-none items-center justify-center hover:bg-slate-200/80 focus-visible:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-slate-500 ${side === 'left' ? 'right-0' : 'left-0'} ${busy && !drag.current ? 'cursor-wait' : 'cursor-col-resize'}`}
    onDoubleClick={() => { if (!busy) void commit(defaultWidth) }}
    onPointerDown={(event) => {
      if (busy || event.button !== 0) return
      event.preventDefault()
      event.currentTarget.focus()
      drag.current = { x: event.clientX, width, next: width }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => {
      if (!drag.current) return
      const delta = (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)
      drag.current.next = clamp(drag.current.width + delta)
      onPreview(drag.current.next)
    }}
    onPointerUp={() => {
      if (!drag.current) return
      const { next, width: start } = drag.current
      drag.current = null
      if (next !== start) void commit(next)
      else onPreview(null)
    }}
    onPointerCancel={cancel}
    onLostPointerCapture={() => { if (drag.current) cancel() }}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); cancel(); return }
      if (busy) return
      const step = event.shiftKey ? 40 : 16
      const delta = side === 'left' ? step : -step
      const next = event.key === 'ArrowLeft' ? clamp(width - delta)
        : event.key === 'ArrowRight' ? clamp(width + delta)
          : event.key === 'Home' ? 240 : event.key === 'End' ? maxWidth : null
      if (next == null) return
      event.preventDefault()
      void commit(next)
    }}
  ><span className="h-10 w-1 rounded-full bg-slate-300" aria-hidden /></div>
}

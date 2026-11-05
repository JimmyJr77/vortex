import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key !== 'Tab') return
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')
      if (!items?.length) return
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-[190] flex justify-end bg-slate-950/35" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl outline-none">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div><h2 id={id} className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}</div>
        <button type="button" onClick={onClose} aria-label="Close accounting details" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </aside>
  </div>
}

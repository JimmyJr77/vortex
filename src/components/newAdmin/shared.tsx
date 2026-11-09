import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Page } from './api'

export const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
export const primary = `${button} !border-red-600 !bg-red-600 !text-white hover:!bg-red-700`
export const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500'
export const cell = 'px-4 py-3 text-left align-top'
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>
}
export function ErrorNotice({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null
  return <div role="alert" className="my-3 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><span>{message}</span>{onRetry ? <button className={button} onClick={onRetry}>Retry</button> : null}</div>
}
export function Empty({ children }: { children: ReactNode }) { return <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">{children}</p> }
export function Pager({ data, onPage }: { data: Pick<Page<unknown>, 'page' | 'total' | 'totalPages'>; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm"><span className="text-slate-500">{data.total} records · Page {data.page} of {Math.max(1, data.totalPages)}</span><div className="flex gap-2"><button className={button} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button><button className={button} disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>Next</button></div></div>
}
export function Status({ value }: { value: string }) { return <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{value.replaceAll('_', ' ')}</span> }
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab') return
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-[180] overflow-y-auto bg-black/50 p-4 sm:p-8"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="mx-auto max-w-6xl rounded-2xl bg-white p-5 shadow-xl outline-none"><div className="mb-5 flex items-center justify-between gap-3"><h2 id={id} className="text-xl font-bold text-slate-950">{title}</h2><button className={button} aria-label={`Close ${title}`} onClick={onClose}><X className="h-4 w-4" /></button></div>{children}</div></div>
}

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function PlannerDialog({ title, onClose, closeDisabled = false, children }: { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose() }} className="portal-dialog w-[min(92vw,520px)] rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-slate-950/40" aria-labelledby="planner-dialog-title">
    <div className="portal-dialog-header flex items-center justify-between border-b px-6 py-4"><h3 id="planner-dialog-title" className="text-lg font-bold">{title}</h3><button type="button" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled} className="portal-dialog-close rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"><X size={18} /></button></div>
    <div className="portal-dialog-body p-6">{children}</div>
  </dialog>
}

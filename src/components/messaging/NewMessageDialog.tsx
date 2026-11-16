import { useEffect, useId, useState, type ReactNode } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { PortalOverlayTarget } from '../portal/portalOverlayTarget'

export default function NewMessageDialog({
  open, onClose, onSubmit, sending, canSend, error, children,
}: {
  open: boolean
  onClose: () => void
  onSubmit: () => void
  sending: boolean
  canSend: boolean
  error?: string | null
  children: ReactNode
}) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open && dialog && !dialog.open) dialog.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [dialog, open])

  return (
    <dialog
      ref={setDialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!sending) onClose()
      }}
      className="m-auto max-h-[min(90dvh,48rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
    >
      {open && (
        <form onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.getAttribute('role') === 'combobox') event.preventDefault()
        }} onSubmit={(event) => {
          event.preventDefault()
          if (canSend && !sending) onSubmit()
        }}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">New message</h2>
              <p className="mt-0.5 text-sm text-slate-600">Start a conversation with one or more recipients.</p>
            </div>
            <button type="button" onClick={onClose} disabled={sending} aria-label="Close new message" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X className="size-5" aria-hidden /></button>
          </div>
          <div className="space-y-4 px-5 py-4">
            <PortalOverlayTarget.Provider value={dialog}>{children}</PortalOverlayTarget.Provider>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button type="button" onClick={onClose} disabled={sending} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/70 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={!canSend || sending} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}

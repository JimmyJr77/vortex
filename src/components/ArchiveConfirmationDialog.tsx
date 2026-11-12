import { useEffect, useId, useRef, useState } from 'react'
import { Archive, TriangleAlert, X } from 'lucide-react'

interface Props {
  itemName: string
  warning?: string
  onComplete: (confirmed: boolean) => void
}

export default function ArchiveConfirmationDialog({ itemName, warning, onComplete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [confirmation, setConfirmation] = useState('')
  const confirmed = confirmation === 'ARCHIVE'

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    inputRef.current?.focus()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-item ${id}-warning`}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-950 shadow-2xl backdrop:bg-black/60"
      onCancel={(event) => { event.preventDefault(); onComplete(false) }}
      onClose={() => onComplete(false)}
      onKeyDown={(event) => {
        // Keep keyboard navigation inside this popup, including when another
        // dialog underneath it has its own document-level keyboard handler.
        event.stopPropagation()
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <form className="space-y-5 p-6" onSubmit={(event) => {
        event.preventDefault()
        if (confirmed) onComplete(true)
      }}>
        <div className="flex items-center justify-between gap-4">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-bold">
            <Archive className="h-5 w-5" aria-hidden="true" />Archive item
          </h2>
          <button type="button" aria-label="Close archive confirmation" onClick={() => onComplete(false)} className="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p id={`${id}-item`} className="break-words font-semibold">{itemName}</p>
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p id={`${id}-warning`}><strong>Warning:</strong> {warning ?? 'This item will be archived and will no longer be accessible for use.'}</p>
        </div>
        <div>
          <label htmlFor={`${id}-confirmation`} className="block text-sm font-medium">Type ARCHIVE to confirm</label>
          <input
            ref={inputRef}
            id={`${id}-confirmation`}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => onComplete(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={!confirmed} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Archive</button>
        </div>
      </form>
    </dialog>
  )
}

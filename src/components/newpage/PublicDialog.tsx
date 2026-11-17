import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function PublicDialog({
  children, className = '', labelledBy, onClose, view,
}: {
  children: ReactNode
  className?: string
  labelledBy: string
  onClose: () => void
  view?: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const trigger = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [view])

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose()
  }

  return (
    <dialog ref={dialogRef} className={`np-dialog ${className}`} aria-labelledby={labelledBy} onCancel={onClose} onClick={closeFromBackdrop}>
      <button ref={closeRef} type="button" className="np-dialog-close" aria-label="Close dialog" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      {children}
    </dialog>
  )
}

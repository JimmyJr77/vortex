import { useEffect, useId, useRef, useState } from 'react'
import { formatDateForDisplay } from '../../utils/dateUtils'

interface Props {
  date: string
  cancelled: boolean
  onCancellationChange: (cancelled: boolean) => Promise<void>
  onClose: () => void
}

export default function AdminCalendarDayModal({ date, cancelled, onCancellationChange, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const title = cancelled ? 'Restore full day' : 'Cancel full day'
  const dateLabel = formatDateForDisplay(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onCancellationChange(!cancelled)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update this day.')
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="portal-dialog m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[90vh] overflow-auto rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div>
        <div className="portal-dialog-header border-b border-gray-200 px-6 py-4">
          <h3 id={titleId} className="text-xl font-display font-bold text-black">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{dateLabel}</p>
        </div>
        <div className="portal-dialog-body px-6 py-4 text-sm text-gray-700">
          <p id={descriptionId}>
            {cancelled
              ? 'Classes and trials cancelled by this full-day closure will reopen. Sessions cancelled individually will stay cancelled.'
              : 'All classes and trials on this date will be cancelled, including sessions outside the current calendar filters. Existing registrations stay on file.'}
          </p>
          {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
        </div>
        <div className="portal-dialog-footer flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            autoFocus
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? (cancelled ? 'Restoring…' : 'Cancelling…') : title}
          </button>
        </div>
      </div>
    </dialog>
  )
}

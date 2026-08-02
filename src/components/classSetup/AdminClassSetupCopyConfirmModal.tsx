import { Loader2, X } from 'lucide-react'
import { type CopyChangePreview } from './classSetupCopyPaste'

interface Props {
  open: boolean
  changes: CopyChangePreview[]
  saving: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

const AdminClassSetupCopyConfirmModal = ({
  open,
  changes,
  saving,
  error,
  onClose,
  onConfirm,
}: Props) => {
  if (!open) return null

  const hasProgramLevel = changes.some((change) => change.programLevel)
  const hasScheduleCopy = changes.some((change) => change.columnId === 'schedule')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Confirm save</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              Review {changes.length} change{changes.length !== 1 ? 's' : ''} before applying.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {hasProgramLevel && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Some changes are program-level and will apply to every class in the affected program.
            </p>
          )}
          {hasScheduleCopy && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Schedule copy replaces the target class’s existing timeslots. Enrolled athletes on
              removed slots move to Orphaned signups.
            </p>
          )}
          {changes.length === 0 ? (
            <p className="text-sm text-gray-500">No changes to apply.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {changes.map((change) => (
                <li key={change.key} className="px-3 py-2.5 text-sm">
                  <div className="font-medium text-gray-900">
                    {change.className}
                    <span className="font-normal text-gray-500"> · {change.programName}</span>
                  </div>
                  <div className="mt-0.5 text-gray-700">
                    <span className="text-gray-500">{change.columnLabel}:</span>{' '}
                    <span className="text-gray-500 line-through">{change.fromDisplay}</span>
                    {' → '}
                    <span className="font-medium text-gray-900">{change.toDisplay}</span>
                    {change.programLevel && (
                      <span className="ml-2 text-xs font-medium text-amber-700">program-level</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || changes.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm save
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminClassSetupCopyConfirmModal

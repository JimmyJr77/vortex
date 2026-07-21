import { type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  saving?: boolean
  error?: string | null
  onClose: () => void
  onSave: () => void
  saveDisabled?: boolean
  wide?: boolean
  hideFooter?: boolean
  children: ReactNode
}

const AdminClassSetupOverviewEditModal = ({
  open,
  title,
  subtitle,
  saving = false,
  error,
  onClose,
  onSave,
  saveDisabled = false,
  wide = false,
  hideFooter = false,
  children,
}: Props) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={`bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${wide ? 'max-w-6xl' : 'max-w-lg'}`}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        {!hideFooter && <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>}
      </div>
    </div>
  )
}

export default AdminClassSetupOverviewEditModal

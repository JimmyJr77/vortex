interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

const ConfirmPricingActionModal = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading = false,
}: Props) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div className="portal-dialog relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="portal-dialog-header border-b border-gray-200 px-5 py-4"><h3 className="text-lg font-bold text-black">{title}</h3></div>
        <p className="portal-dialog-body px-5 py-5 text-sm text-gray-700">{message}</p>
        <div className="portal-dialog-footer flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmPricingActionModal

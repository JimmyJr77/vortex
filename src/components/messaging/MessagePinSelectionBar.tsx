import { Loader2 } from 'lucide-react'

interface MessagePinSelectionBarProps {
  selectedCount: number
  saving?: boolean
  onSave: () => void
  onCancel: () => void
}

export default function MessagePinSelectionBar({
  selectedCount,
  saving = false,
  onSave,
  onCancel,
}: MessagePinSelectionBarProps) {
  return (
    <div className="sticky top-0 z-10 mx-4 mt-2 mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <span>
        Click messages to add to this pin group
        {selectedCount > 0 ? ` (${selectedCount} selected)` : ''}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg border border-amber-300 text-sm hover:bg-amber-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || selectedCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save pin group
        </button>
      </div>
    </div>
  )
}

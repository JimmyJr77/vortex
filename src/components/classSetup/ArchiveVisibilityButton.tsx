import { Archive } from 'lucide-react'

export default function ArchiveVisibilityButton({ showArchived, onToggleArchived, disabled }: {
  showArchived: boolean
  onToggleArchived: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggleArchived}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Archive aria-hidden="true" className="h-4 w-4" />
      {showArchived ? 'Hide archived' : 'Show archived'}
    </button>
  )
}

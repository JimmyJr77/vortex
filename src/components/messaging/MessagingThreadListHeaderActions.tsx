import { Plus } from 'lucide-react'
import MessagingMaximizeToggle from './MessagingMaximizeToggle'
import MessagingThreadListSortMenu from './MessagingThreadListSortMenu'
import type {
  ThreadListSortDir,
  ThreadListSortField,
} from './messagingThreadSort'
import type { InboxPrimaryAction } from './messagingInboxActions'

interface MessagingThreadListHeaderActionsProps {
  primaryAction: InboxPrimaryAction
  onPrimaryCreate: () => void
  sort: ThreadListSortField
  sortDir: ThreadListSortDir
  onSortChange: (sort: ThreadListSortField, sortDir: ThreadListSortDir) => void
  showCreate?: boolean
  maximized?: boolean
  onMaximizedChange?: (maximized: boolean) => void
}

export default function MessagingThreadListHeaderActions({
  primaryAction,
  onPrimaryCreate,
  sort,
  sortDir,
  onSortChange,
  showCreate = true,
  maximized = false,
  onMaximizedChange,
}: MessagingThreadListHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {showCreate && !primaryAction.hidden && (
        <button
          type="button"
          onClick={onPrimaryCreate}
          disabled={primaryAction.disabled}
          title={primaryAction.disabled ? primaryAction.disabledReason : primaryAction.label}
          aria-label={primaryAction.label}
          className="inline-flex items-center justify-center size-9 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      )}
      {maximized && onMaximizedChange && (
        <MessagingMaximizeToggle
          maximized={maximized}
          onToggle={() => onMaximizedChange(false)}
        />
      )}
      <MessagingThreadListSortMenu sort={sort} sortDir={sortDir} onChange={onSortChange} />
    </div>
  )
}

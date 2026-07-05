import { Plus } from 'lucide-react'
import MessagingMaximizeToggle from './MessagingMaximizeToggle'
import MessagingThreadListSortMenu, {
  type ThreadListSortDir,
  type ThreadListSortField,
} from './MessagingThreadListSortMenu'
import type { InboxPrimaryAction } from './messagingInboxActions'

interface MessagingThreadListHeaderActionsProps {
  primaryAction: InboxPrimaryAction
  onPrimaryCreate: () => void
  sort: ThreadListSortField
  sortDir: ThreadListSortDir
  onSortChange: (sort: ThreadListSortField, sortDir: ThreadListSortDir) => void
  maximized?: boolean
  onMaximizedChange?: (maximized: boolean) => void
}

export default function MessagingThreadListHeaderActions({
  primaryAction,
  onPrimaryCreate,
  sort,
  sortDir,
  onSortChange,
  maximized = false,
  onMaximizedChange,
}: MessagingThreadListHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {!primaryAction.hidden && (
        <button
          type="button"
          onClick={onPrimaryCreate}
          disabled={primaryAction.disabled}
          title={primaryAction.disabled ? primaryAction.disabledReason : primaryAction.label}
          aria-label={primaryAction.label}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-vortex-red hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
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

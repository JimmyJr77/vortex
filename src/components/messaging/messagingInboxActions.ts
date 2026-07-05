import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { MessagingRole } from './types'

export type InboxComposeMode = 'message' | 'class' | 'eventBoard' | 'calendarItem' | 'file' | 'none'

export interface InboxPrimaryAction {
  label: string
  mode: InboxComposeMode
  disabled: boolean
  disabledReason?: string
  hidden: boolean
}

function isStaffRole(role: MessagingRole): boolean {
  return role === 'admin' || role === 'coach'
}

export function getInboxPrimaryAction(
  tab: MessagingInboxTab,
  role: MessagingRole,
  options: { archived?: boolean } = {},
): InboxPrimaryAction {
  if (options.archived || tab === 'archived') {
    return { label: '', mode: 'none', disabled: true, hidden: true }
  }

  switch (tab) {
    case 'all':
    case 'unread':
    case 'pinned':
      return { label: 'New message thread', mode: 'message', disabled: false, hidden: false }
    case 'classes':
      return { label: 'New class thread', mode: 'class', disabled: false, hidden: false }
    case 'events':
      if (role !== 'admin') {
        return {
          label: 'New event board',
          mode: 'eventBoard',
          disabled: true,
          disabledReason: 'Admin only',
          hidden: false,
        }
      }
      return { label: 'New event board', mode: 'eventBoard', disabled: false, hidden: false }
    case 'scheduling':
      if (!isStaffRole(role)) {
        return {
          label: 'New calendar item',
          mode: 'calendarItem',
          disabled: true,
          disabledReason: 'Admin or coach only',
          hidden: false,
        }
      }
      return { label: 'New calendar item', mode: 'calendarItem', disabled: false, hidden: false }
    case 'files':
      return { label: 'Add a file', mode: 'file', disabled: false, hidden: false }
    default:
      return { label: 'New message thread', mode: 'message', disabled: false, hidden: false }
  }
}

import { useMemo } from 'react'
import {
  filterMessageThreads,
  sortMessageThreads,
} from './messagingLayout'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'
import type { MessageThread } from './types'

interface UseMessagingEventsInboxOptions {
  inboxTab: MessagingInboxTab
  tabFilteredThreads: MessageThread[]
  listSearch: string
  listSort: ThreadListSortField
  listSortDir: ThreadListSortDir
}

/** Sort/filter wrapper for inbox tabs that use plain thread rows (not schedule virtual rows). */
export function useMessagingEventsInbox({
  inboxTab,
  tabFilteredThreads,
  listSearch,
  listSort,
  listSortDir,
}: UseMessagingEventsInboxOptions) {
  const displayedThreads = useMemo(
    () => sortMessageThreads(filterMessageThreads(tabFilteredThreads, listSearch), listSort, listSortDir),
    [tabFilteredThreads, listSearch, listSort, listSortDir],
  )

  const resolveThreadSelection = (rowId: number) => ({ threadId: rowId, calendarItem: null as null })

  return {
    displayedThreads,
    activeCalendarItem: null as null,
    setActiveCalendarItem: (_item: null) => {},
    resolveThreadSelection,
    calendarInboxCount: 0,
    inboxTab,
  }
}

export function isCalendarInboxRowId(id: number | null | undefined): boolean {
  return id != null && id < 0
}

export function isScheduleInboxRowId(id: number | null | undefined): boolean {
  return id != null && id < 0
}

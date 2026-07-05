import { useMemo } from 'react'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'
import { useMessagingEventsInbox } from './useMessagingEventsInbox'
import { useMessagingScheduleInbox } from './useMessagingScheduleInbox'
import type { MessageThread, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface UseMessagingInboxListOptions {
  inboxTab: MessagingInboxTab
  tabFilteredThreads: MessageThread[]
  listSearch: string
  listSort: ThreadListSortField
  listSortDir: ThreadListSortDir
  role: MessagingRole
  fetcher: Fetcher
  enabled?: boolean
}

export function useMessagingInboxList({
  inboxTab,
  tabFilteredThreads,
  listSearch,
  listSort,
  listSortDir,
  role,
  fetcher,
  enabled = true,
}: UseMessagingInboxListOptions) {
  const threadInbox = useMessagingEventsInbox({
    inboxTab,
    tabFilteredThreads,
    listSearch,
    listSort,
    listSortDir,
  })

  const scheduleInbox = useMessagingScheduleInbox({
    enabled,
    inboxTab,
    tabFilteredThreads,
    listSearch,
    listSort,
    listSortDir,
    role,
    fetcher,
  })

  const displayedThreads = inboxTab === 'scheduling'
    ? scheduleInbox.displayedThreads
    : threadInbox.displayedThreads

  const inboxCountsPatch = useMemo(
    () => (inboxTab === 'scheduling' ? { scheduling: scheduleInbox.scheduleInboxCount } : {}),
    [inboxTab, scheduleInbox.scheduleInboxCount],
  )

  const resolveThreadSelection = (rowId: number) => {
    if (inboxTab === 'scheduling' && rowId < 0) {
      return scheduleInbox.resolveThreadSelection(rowId)
    }
    scheduleInbox.setActiveScheduleRow(null)
    return { threadId: rowId, scheduleRow: null as null, calendarItem: null as null }
  }

  return {
    displayedThreads,
    inboxCountsPatch,
    activeCalendarItem: threadInbox.activeCalendarItem,
    activeScheduleRow: scheduleInbox.activeScheduleRow,
    setActiveCalendarItem: threadInbox.setActiveCalendarItem,
    setActiveScheduleRow: scheduleInbox.setActiveScheduleRow,
    resolveThreadSelection,
    refreshScheduleRows: scheduleInbox.refreshScheduleRows,
  }
}

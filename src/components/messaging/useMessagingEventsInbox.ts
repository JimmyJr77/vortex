import { useEffect, useMemo, useState } from 'react'
import type { EventCalendarItem } from './messagingApi'
import { fetchCalendarInboxRows } from './messagingApi'
import {
  calendarItemToInboxThread,
  filterMessageThreads,
  sortMessageThreads,
} from './messagingLayout'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'
import type { MessageThread, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface UseMessagingEventsInboxOptions {
  enabled: boolean
  inboxTab: MessagingInboxTab
  tabFilteredThreads: MessageThread[]
  listSearch: string
  listSort: ThreadListSortField
  listSortDir: ThreadListSortDir
  role: MessagingRole
  fetcher: Fetcher
}

export function useMessagingEventsInbox({
  enabled,
  inboxTab,
  tabFilteredThreads,
  listSearch,
  listSort,
  listSortDir,
  role,
  fetcher,
}: UseMessagingEventsInboxOptions) {
  const [calendarInboxThreads, setCalendarInboxThreads] = useState<MessageThread[]>([])
  const [calendarItemsByRowId, setCalendarItemsByRowId] = useState<Map<number, EventCalendarItem>>(new Map())
  const [activeCalendarItem, setActiveCalendarItem] = useState<EventCalendarItem | null>(null)

  useEffect(() => {
    if (!enabled || inboxTab !== 'events') {
      setCalendarInboxThreads([])
      setCalendarItemsByRowId(new Map())
      return
    }
    let cancelled = false
    void fetchCalendarInboxRows(role, fetcher)
      .then((rows) => {
        if (cancelled) return
        const itemMap = new Map<number, EventCalendarItem>()
        const threads = rows
          .filter((row) => row.discussion_thread_id != null)
          .map((row) => {
            const thread = calendarItemToInboxThread(row.calendar_item, row.discussion_thread_id!)
            itemMap.set(thread.id, row.calendar_item)
            return thread
          })
        setCalendarItemsByRowId(itemMap)
        setCalendarInboxThreads(threads)
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarInboxThreads([])
          setCalendarItemsByRowId(new Map())
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, inboxTab, role, fetcher])

  const mergedThreads = useMemo(() => {
    if (inboxTab !== 'events') return tabFilteredThreads
    return [...tabFilteredThreads, ...calendarInboxThreads]
  }, [inboxTab, tabFilteredThreads, calendarInboxThreads])

  const displayedThreads = useMemo(
    () => sortMessageThreads(filterMessageThreads(mergedThreads, listSearch), listSort, listSortDir),
    [mergedThreads, listSearch, listSort, listSortDir],
  )

  const resolveThreadSelection = (rowId: number): { threadId: number; calendarItem: EventCalendarItem | null } => {
    if (rowId < 0) {
      const calendarItem = calendarItemsByRowId.get(rowId) ?? null
      const discussionId = calendarInboxThreads.find((t) => t.id === rowId)?.target_thread_id ?? null
      if (discussionId == null) {
        return { threadId: rowId, calendarItem }
      }
      setActiveCalendarItem(calendarItem)
      return { threadId: discussionId, calendarItem }
    }
    setActiveCalendarItem(null)
    return { threadId: rowId, calendarItem: null }
  }

  return {
    displayedThreads,
    activeCalendarItem,
    setActiveCalendarItem,
    resolveThreadSelection,
    calendarInboxCount: calendarInboxThreads.length,
  }
}

export function isCalendarInboxRowId(id: number | null | undefined): boolean {
  return id != null && id < 0
}

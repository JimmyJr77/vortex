import { useEffect, useMemo, useState } from 'react'
import { fetchScheduleInboxRows, type ScheduleInboxRow } from './messagingApi'
import {
  filterMessageThreads,
  mergeScheduleInboxThreads,
  scheduleRowVirtualId,
  sortMessageThreads,
} from './messagingLayout'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'
import type { MessageThread, MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface UseMessagingScheduleInboxOptions {
  enabled: boolean
  inboxTab: MessagingInboxTab
  tabFilteredThreads: MessageThread[]
  listSearch: string
  listSort: ThreadListSortField
  listSortDir: ThreadListSortDir
  role: MessagingRole
  fetcher: Fetcher
}

export function useMessagingScheduleInbox({
  enabled,
  inboxTab,
  tabFilteredThreads,
  listSearch,
  listSort,
  listSortDir,
  role,
  fetcher,
}: UseMessagingScheduleInboxOptions) {
  const [scheduleRows, setScheduleRows] = useState<ScheduleInboxRow[]>([])
  const [activeScheduleRow, setActiveScheduleRow] = useState<ScheduleInboxRow | null>(null)

  useEffect(() => {
    if (!enabled || inboxTab !== 'scheduling') {
      setScheduleRows([])
      return
    }
    let cancelled = false
    void fetchScheduleInboxRows(role, fetcher)
      .then((rows) => {
        if (!cancelled) setScheduleRows(rows)
      })
      .catch(() => {
        if (!cancelled) setScheduleRows([])
      })
    return () => {
      cancelled = true
    }
  }, [enabled, inboxTab, role, fetcher])

  const scheduleRowMap = useMemo(() => {
    const map = new Map<number, ScheduleInboxRow>()
    for (const row of scheduleRows) {
      map.set(scheduleRowVirtualId(row.row_key), row)
    }
    return map
  }, [scheduleRows])

  const mergedThreads = useMemo(() => {
    if (inboxTab !== 'scheduling') return tabFilteredThreads
    return mergeScheduleInboxThreads(tabFilteredThreads, scheduleRows)
  }, [inboxTab, tabFilteredThreads, scheduleRows])

  const displayedThreads = useMemo(
    () => sortMessageThreads(filterMessageThreads(mergedThreads, listSearch), listSort, listSortDir),
    [mergedThreads, listSearch, listSort, listSortDir],
  )

  const resolveThreadSelection = (rowId: number): { threadId: number; scheduleRow: ScheduleInboxRow | null } => {
    if (rowId >= 0) {
      setActiveScheduleRow(null)
      return { threadId: rowId, scheduleRow: null }
    }
    const scheduleRow = scheduleRowMap.get(rowId) ?? null
    setActiveScheduleRow(scheduleRow)
    const threadId = scheduleRow?.discussion_thread_id
    if (threadId == null) {
      return { threadId: rowId, scheduleRow }
    }
    return { threadId, scheduleRow }
  }

  const refreshScheduleRows = () => {
    if (inboxTab !== 'scheduling') return
    void fetchScheduleInboxRows(role, fetcher).then(setScheduleRows).catch(() => setScheduleRows([]))
  }

  return {
    displayedThreads,
    scheduleRows,
    activeScheduleRow,
    setActiveScheduleRow,
    resolveThreadSelection,
    refreshScheduleRows,
    scheduleInboxCount: scheduleRows.length,
  }
}

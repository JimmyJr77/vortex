import type { MessageThread } from './types'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'

/** Shared layout classes — flex chain from portal main fills remaining viewport height. */
export const messagingWorkspaceRoot = 'flex flex-col gap-4 messaging-workspace flex-1 min-h-0 h-full max-h-full overflow-hidden'
export const messagingWorkspaceThreadOpen = 'messaging-workspace--thread-open'
export const messagingWorkspaceGrid = 'grid gap-4 lg:gap-5 lg:grid-cols-[minmax(220px,280px)_1fr] flex-1 min-h-0 h-full max-h-full overflow-hidden messaging-workspace-grid'
export const messagingWorkspaceShell = 'flex-1 min-h-0 h-full max-h-full overflow-hidden'
export const messagingPanel = 'messaging-panel'
export const messagingScroll = 'messaging-scroll'

const SCHEDULING_LINK_TYPES = new Set([
  'scheduling_form',
  'scheduling_offering',
  'scheduling_time_slot',
])

function threadHasEventLink(t: MessageThread): boolean {
  return (
    t.tags?.some((tag) => tag.slug === 'event-info') === true
    || t.links?.some((l) => l.object_type === 'event') === true
  )
}

function threadHasSchedulingLink(t: MessageThread): boolean {
  return (
    t.tags?.some((tag) => tag.slug === 'scheduling') === true
    || t.links?.some((l) => SCHEDULING_LINK_TYPES.has(String(l.object_type))) === true
  )
}

function threadHasClassLink(t: MessageThread): boolean {
  return t.links?.some((l) => l.object_type === 'scheduling_form') === true
}

export { threadHasEventLink, threadHasSchedulingLink }

export type ThreadListAccentCategory = 'event' | 'scheduling' | 'message'

export function threadListAccentCategory(thread: MessageThread): ThreadListAccentCategory {
  if (threadHasEventLink(thread)) return 'event'
  if (threadHasSchedulingLink(thread)) return 'scheduling'
  return 'message'
}

export function threadListAccentClass(thread: MessageThread): string {
  if (thread.is_calendar_inbox_row) return 'border-l-amber-500'
  const category = threadListAccentCategory(thread)
  if (category === 'event') return 'border-l-purple-500'
  if (category === 'scheduling') return 'border-l-teal-500'
  return (thread.unread_count ?? 0) > 0 ? 'border-l-blue-500' : 'border-l-gray-300'
}

function threadHasFiles(t: MessageThread): boolean {
  return Boolean(t.has_files) || (t.file_count ?? 0) > 0
}

export function filterThreadsByInboxTab(threads: MessageThread[], tab: MessagingInboxTab): MessageThread[] {
  switch (tab) {
    case 'unread':
      return threads.filter((t) => (t.unread_count ?? 0) > 0 && t.status !== 'archived')
    case 'pinned':
      return threads.filter((t) => Boolean(t.is_favorite) && t.status !== 'archived')
    case 'events':
      return threads.filter((t) => t.status !== 'archived' && threadHasEventLink(t) && !t.is_calendar_inbox_row)
    case 'scheduling':
      return []
    case 'classes':
      return threads.filter((t) => t.status !== 'archived' && threadHasClassLink(t))
    case 'files':
      return threads.filter((t) => t.status !== 'archived' && threadHasFiles(t))
    case 'archived':
      return threads.filter((t) => t.status === 'archived')
    case 'all':
    default:
      return threads.filter((t) => t.status !== 'archived')
  }
}

export function countThreadsByInboxTab(threads: MessageThread[]): Partial<Record<MessagingInboxTab, number>> {
  return {
    all: filterThreadsByInboxTab(threads, 'all').length,
    unread: filterThreadsByInboxTab(threads, 'unread').length,
    pinned: filterThreadsByInboxTab(threads, 'pinned').length,
    events: filterThreadsByInboxTab(threads, 'events').length,
    scheduling: filterThreadsByInboxTab(threads, 'scheduling').length,
    classes: filterThreadsByInboxTab(threads, 'classes').length,
    files: filterThreadsByInboxTab(threads, 'files').length,
    archived: filterThreadsByInboxTab(threads, 'archived').length,
  }
}

export function filterMessageThreads(threads: MessageThread[], query: string): MessageThread[] {
  const q = query.trim().toLowerCase()
  if (!q) return threads
  return threads.filter((t) => {
    const subject = (t.subject || '').toLowerCase()
    const athlete = `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase()
    const preview = (t.last_message_body || '').toLowerCase()
    const participants = (t.participant_names || '').toLowerCase()
    return subject.includes(q) || athlete.includes(q) || preview.includes(q) || participants.includes(q)
  })
}

export function threadListTitle(t: MessageThread, fallback = 'Conversation') {
  return t.subject?.trim() || (t.first_name ? `${t.first_name} ${t.last_name}`.trim() : fallback)
}

function threadSortTitle(t: MessageThread): string {
  return (t.subject?.trim() || threadListTitle(t)).toLowerCase()
}

export function sortMessageThreads(
  threads: MessageThread[],
  sort: ThreadListSortField,
  sortDir: ThreadListSortDir,
): MessageThread[] {
  const sorted = [...threads]
  sorted.sort((a, b) => {
    const aFav = a.is_favorite ? 0 : 1
    const bFav = b.is_favorite ? 0 : 1
    if (aFav !== bFav) return aFav - bFav

    let cmp = 0
    if (sort === 'title') {
      cmp = threadSortTitle(a).localeCompare(threadSortTitle(b))
    } else if (sort === 'recent') {
      const aTime = new Date(a.last_message_at || a.created_at || 0).getTime()
      const bTime = new Date(b.last_message_at || b.created_at || 0).getTime()
      cmp = aTime - bTime
    } else {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      cmp = aTime - bTime
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
  return sorted
}

/** Favorites first, then most recently updated — used for default thread list order and landing. */
export function defaultThreadListOrder(threads: MessageThread[]): MessageThread[] {
  return sortMessageThreads(threads, 'recent', 'desc')
}

export function defaultLandingThreadId(threads: MessageThread[]): number | null {
  return defaultThreadListOrder(threads.filter((t) => !t.is_calendar_inbox_row && !t.is_schedule_inbox_row))[0]?.id ?? null
}

export function calendarItemToInboxThread(
  item: {
    id: number
    title: string
    event_name?: string | null
    when_start?: string | null
    where_text?: string | null
  },
  discussionThreadId: number,
): MessageThread {
  const whenLabel = item.when_start
    ? new Date(item.when_start).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : null
  const preview = [item.event_name, whenLabel, item.where_text].filter(Boolean).join(' · ')

  return {
    id: -item.id,
    subject: item.title,
    last_message_body: preview || 'Calendar item',
    is_calendar_inbox_row: true,
    calendar_item_id: item.id,
    target_thread_id: discussionThreadId,
    calendar_event_name: item.event_name ?? null,
    kind: 'general',
    tags: [{ id: -item.id, slug: 'event-info', label: 'Calendar' }],
    unread_count: 0,
  }
}

export function scheduleRowVirtualId(rowKey: string): number {
  let hash = 0
  for (let i = 0; i < rowKey.length; i += 1) {
    hash = ((hash << 5) - hash) + rowKey.charCodeAt(i)
    hash |= 0
  }
  return hash > 0 ? -hash : hash
}

export function scheduleRowToInboxThread(row: {
  row_key: string
  source: 'event' | 'class' | 'calendar_item'
  title: string
  who_text?: string | null
  what_text?: string | null
  why_text?: string | null
  when_start?: string | null
  where_text?: string | null
  event_name?: string | null
  discussion_thread_id?: number | null
}): MessageThread {
  const whenLabel = row.when_start
    ? new Date(row.when_start).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : null
  const preview = [row.event_name, whenLabel, row.where_text, row.what_text].filter(Boolean).join(' · ')
  const sourceLabel = row.source === 'class' ? 'Class' : row.source === 'event' ? 'Event' : 'Schedule'

  return {
    id: scheduleRowVirtualId(row.row_key),
    subject: row.title,
    last_message_body: preview || sourceLabel,
    is_schedule_inbox_row: true,
    schedule_row_key: row.row_key,
    schedule_source: row.source,
    target_thread_id: row.discussion_thread_id ?? undefined,
    calendar_event_name: row.event_name ?? null,
    kind: 'general',
    tags: [{ id: 0, slug: 'event-info', label: sourceLabel }],
    unread_count: 0,
  }
}

export function mergeScheduleInboxThreads(
  tabFilteredThreads: MessageThread[],
  scheduleRows: Parameters<typeof scheduleRowToInboxThread>[0][],
): MessageThread[] {
  const virtualRows = scheduleRows.map((row) => scheduleRowToInboxThread(row))
  const keys = new Set(virtualRows.map((t) => t.schedule_row_key))
  const deduped = tabFilteredThreads.filter((t) => !t.schedule_row_key || !keys.has(t.schedule_row_key))
  return [...deduped, ...virtualRows]
}

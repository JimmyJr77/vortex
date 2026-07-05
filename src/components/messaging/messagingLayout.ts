import type { MessageThread } from './types'
import type { MessagingInboxTab } from './MessagingInboxTabs'
import type { ThreadListSortDir, ThreadListSortField } from './MessagingThreadListSortMenu'

/** Shared layout classes — set `--messaging-viewport-top` on the root wrapper for viewport height. */
export const messagingWorkspaceRoot = 'flex flex-col gap-4 messaging-workspace flex-1 min-h-0'
export const messagingWorkspaceThreadOpen = 'messaging-workspace--thread-open'
export const messagingWorkspaceGrid = 'grid gap-4 lg:gap-5 lg:grid-cols-[minmax(220px,280px)_1fr] flex-1 min-h-0 messaging-workspace-grid'
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
      return threads.filter((t) => t.status !== 'archived' && threadHasEventLink(t))
    case 'scheduling':
      return threads.filter((t) => t.status !== 'archived' && threadHasSchedulingLink(t))
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

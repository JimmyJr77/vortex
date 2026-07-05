import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

const READ_PATH: Record<MessagingRole, (threadId: number) => string> = {
  coach: (id) => `/api/coach/messages/${id}/read`,
  member: (id) => `/api/member/messages/${id}/read`,
  admin: (id) => `/api/admin/messages/${id}/read`,
}

export async function markThreadRead(
  role: MessagingRole,
  threadId: number,
  fetcher: Fetcher,
  messageId?: number | null,
): Promise<void> {
  try {
    await fetcher(READ_PATH[role](threadId), {
      method: 'POST',
      body: JSON.stringify(messageId != null ? { message_id: messageId } : {}),
    })
  } catch {
    /* best-effort */
  }
}

export async function provisionEventMessageThreads(
  eventId: number,
  fetcher: Fetcher,
  payload: {
    subject?: string
    info_json?: Record<string, unknown>
  } = {},
): Promise<{ created?: boolean }> {
  const result = await fetcher(`/api/admin/events/${eventId}/message-threads`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (result && typeof result === 'object' ? result : {}) as { created?: boolean }
}

export async function fetchEventMessageThreads(
  role: MessagingRole,
  eventId: number,
  fetcher: Fetcher,
): Promise<import('./types').MessageThread[]> {
  const rows = await fetcher(`/api/${role}/events/${eventId}/message-threads`) as import('./types').MessageThread[]
  return Array.isArray(rows) ? rows : []
}

export function pickEventDiscussionThreadId(
  threads: import('./types').MessageThread[],
): number | null {
  const discussion = threads.find((t) => t.kind === 'discussion' || t.linked_thread_id)
  const info = threads.find(
    (t) => t.kind === 'canonical' || t.tags?.some((tag) => tag.slug === 'event-info'),
  )
  const id = discussion?.id ?? info?.id ?? threads[0]?.id
  return id != null ? Number(id) : null
}

export interface EventChatStatus {
  hasChat: boolean
  subscribed: boolean
  discussionThreadId: number | null
  canonicalThreadId: number | null
}

export async function fetchEventChatStatus(
  eventId: number,
  fetcher: Fetcher,
): Promise<EventChatStatus> {
  const data = await fetcher(`/api/member/events/${eventId}/chat-status`) as EventChatStatus
  return {
    hasChat: Boolean(data?.hasChat),
    subscribed: Boolean(data?.subscribed),
    discussionThreadId: data?.discussionThreadId != null ? Number(data.discussionThreadId) : null,
    canonicalThreadId: data?.canonicalThreadId != null ? Number(data.canonicalThreadId) : null,
  }
}

export async function subscribeToEventChat(
  eventId: number,
  fetcher: Fetcher,
): Promise<void> {
  await fetcher(`/api/member/events/${eventId}/message-threads/subscribe`, { method: 'POST' })
}

export async function submitEventRsvp(
  eventId: number,
  status: 'going' | 'maybe' | 'declined',
  fetcher: Fetcher,
): Promise<void> {
  await fetcher(`/api/member/events/${eventId}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export interface EventCalendarItem {
  id: number
  event_id: number
  title: string
  who_text?: string | null
  what_text?: string | null
  why_text?: string | null
  when_start?: string | null
  when_end?: string | null
  where_text?: string | null
  event_name?: string | null
  discussion_thread_id?: number | null
}

export async function fetchUpcomingSchedule(
  fetcher: Fetcher,
): Promise<EventCalendarItem[]> {
  const rows = await fetcher('/api/member/schedule/upcoming') as EventCalendarItem[]
  return Array.isArray(rows) ? rows : []
}

export async function fetchEventCalendarItems(
  eventId: number,
  fetcher: Fetcher,
): Promise<EventCalendarItem[]> {
  const rows = await fetcher(`/api/admin/events/${eventId}/calendar-items`) as EventCalendarItem[]
  return Array.isArray(rows) ? rows : []
}

export async function createEventCalendarItem(
  eventId: number,
  fetcher: Fetcher,
  payload: Partial<EventCalendarItem>,
): Promise<EventCalendarItem> {
  return await fetcher(`/api/admin/events/${eventId}/calendar-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as EventCalendarItem
}

export async function deleteEventCalendarItem(
  eventId: number,
  itemId: number,
  fetcher: Fetcher,
): Promise<void> {
  await fetcher(`/api/admin/events/${eventId}/calendar-items/${itemId}`, { method: 'DELETE' })
}

export interface CalendarInboxRow {
  calendar_item: EventCalendarItem
  discussion_thread_id: number | null
}

export async function fetchCalendarInboxRows(
  role: MessagingRole,
  fetcher: Fetcher,
): Promise<CalendarInboxRow[]> {
  const rows = await fetcher(`/api/${role}/messages/calendar-inbox-rows`) as CalendarInboxRow[]
  return Array.isArray(rows) ? rows : []
}

import type { MessageChecklist, MessagePoll, MessagingRole, SignupSheetType } from './types'

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
  role: MessagingRole = 'admin',
): Promise<{ created?: boolean; discussion?: { id: number }; canonical?: { id: number } }> {
  const path = role === 'member'
    ? `/api/member/events/${eventId}/message-threads`
    : `/api/admin/events/${eventId}/message-threads`
  const result = await fetcher(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (result && typeof result === 'object' ? result : {}) as { created?: boolean; discussion?: { id: number }; canonical?: { id: number } }
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
  discussionThreadIds?: number[]
  canonicalThreadId: number | null
  boards?: { id: number; subject?: string | null; kind?: string }[]
}

export interface ClassMessageOption {
  id: number
  name: string
  member_count?: number
  is_assigned?: boolean
}

export interface ScheduleInboxRow {
  row_key: string
  source: 'event' | 'class' | 'calendar_item'
  title: string
  who_text?: string | null
  what_text?: string | null
  why_text?: string | null
  when_start?: string | null
  when_end?: string | null
  where_text?: string | null
  notes?: string | null
  linked_event_id?: number | null
  linked_form_id?: number | null
  calendar_item_id?: number | null
  discussion_thread_id?: number | null
  class_ids?: number[]
  event_name?: string | null
}

export interface HighlightEventOption {
  id: number
  event_name?: string
  eventName?: string
}

export async function fetchClassMessageOptions(
  role: MessagingRole,
  fetcher: Fetcher,
): Promise<ClassMessageOption[]> {
  const rows = await fetcher(`/api/${role}/messages/class-options`) as ClassMessageOption[]
  return Array.isArray(rows) ? rows : []
}

export async function createClassMessageThread(
  role: MessagingRole,
  fetcher: Fetcher,
  payload: { form_id: number; subject?: string | null },
): Promise<{ thread_id: number }> {
  return fetcher(`/api/${role}/messages/class-threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ thread_id: number }>
}

export async function fetchScheduleInboxRows(
  role: MessagingRole,
  fetcher: Fetcher,
): Promise<ScheduleInboxRow[]> {
  const rows = await fetcher(`/api/${role}/messages/schedule-inbox-rows`) as ScheduleInboxRow[]
  return Array.isArray(rows) ? rows : []
}

export async function provisionAdditionalEventBoard(
  eventId: number,
  fetcher: Fetcher,
  payload: { subject?: string } = {},
  role: MessagingRole = 'admin',
): Promise<{ discussion?: { id: number } }> {
  const path = role === 'member'
    ? `/api/member/events/${eventId}/message-boards`
    : `/api/admin/events/${eventId}/message-boards`
  return fetcher(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ discussion?: { id: number } }>
}

export async function linkThreadToEvent(
  eventId: number,
  fetcher: Fetcher,
  payload: { thread_id: number; link_role?: string },
): Promise<unknown> {
  return fetcher(`/api/admin/events/${eventId}/message-threads/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchHighlightEvents(
  role: MessagingRole,
  fetcher: Fetcher,
): Promise<HighlightEventOption[]> {
  if (role === 'admin') {
    const result = await fetcher('/api/admin/events')
    if (Array.isArray(result)) return result
    const wrapped = result as { data?: HighlightEventOption[] }
    return Array.isArray(wrapped?.data) ? wrapped.data : []
  }
  const rows = await fetcher(`/api/${role}/messages/highlight-events`) as HighlightEventOption[]
  return Array.isArray(rows) ? rows : []
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
  what_to_bring?: string[]
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
  payload: Partial<EventCalendarItem> & { class_ids?: number[]; what_to_bring?: string[] },
  role: MessagingRole = 'admin',
): Promise<EventCalendarItem> {
  const path = role === 'coach'
    ? `/api/coach/events/${eventId}/calendar-items`
    : role === 'member'
      ? `/api/member/events/${eventId}/calendar-items`
      : `/api/admin/events/${eventId}/calendar-items`
  return fetcher(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<EventCalendarItem>
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

export async function fetchThreadPolls(
  role: MessagingRole,
  threadId: number,
  fetcher: Fetcher,
): Promise<MessagePoll[]> {
  const rows = await fetcher(`/api/${role}/messages/${threadId}/polls`) as MessagePoll[]
  return Array.isArray(rows) ? rows : []
}

export async function createThreadPoll(
  role: MessagingRole,
  threadId: number,
  fetcher: Fetcher,
  payload: { question: string; options: string[]; closes_at?: string | null },
): Promise<{ poll?: MessagePoll }> {
  return await fetcher(`/api/${role}/messages/${threadId}/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as { poll?: MessagePoll }
}

export async function closeThreadPoll(
  role: MessagingRole,
  threadId: number,
  pollId: number,
  fetcher: Fetcher,
  isClosed: boolean,
): Promise<MessagePoll> {
  return await fetcher(`/api/${role}/messages/${threadId}/polls/${pollId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_closed: isClosed }),
  }) as MessagePoll
}

export async function fetchThreadSignupSheets(
  role: MessagingRole,
  threadId: number,
  fetcher: Fetcher,
): Promise<MessageChecklist[]> {
  const rows = await fetcher(`/api/${role}/messages/${threadId}/signup-sheets`) as MessageChecklist[]
  return Array.isArray(rows) ? rows : []
}

export async function createThreadSignupSheet(
  role: MessagingRole,
  threadId: number,
  fetcher: Fetcher,
  payload: {
    title: string
    sheet_type: SignupSheetType
    event_date: string
    items?: { text: string }[]
    config?: Record<string, unknown>
    closes_at?: string | null
  },
): Promise<{ signup?: MessageChecklist }> {
  return await fetcher(`/api/${role}/messages/${threadId}/signup-sheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as { signup?: MessageChecklist }
}

export async function closeThreadSignupSheet(
  role: MessagingRole,
  threadId: number,
  signupId: number,
  fetcher: Fetcher,
  isClosed: boolean,
): Promise<MessageChecklist> {
  return await fetcher(`/api/${role}/messages/${threadId}/signup-sheets/${signupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_closed: isClosed }),
  }) as MessageChecklist
}

export async function respondToSignupSheet(
  role: MessagingRole,
  threadId: number,
  messageId: number,
  fetcher: Fetcher,
  response: Record<string, unknown>,
): Promise<MessageChecklist> {
  return await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/signup/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  }) as MessageChecklist
}

export async function claimSignupItem(
  role: MessagingRole,
  threadId: number,
  messageId: number,
  fetcher: Fetcher,
  itemIndex: number,
  claimNote?: string | null,
): Promise<MessageChecklist> {
  return await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/checklist/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_index: itemIndex, claim_note: claimNote ?? null }),
  }) as MessageChecklist
}

export async function unclaimSignupItem(
  role: MessagingRole,
  threadId: number,
  messageId: number,
  fetcher: Fetcher,
  itemIndex: number,
): Promise<MessageChecklist> {
  return await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/checklist/unclaim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_index: itemIndex }),
  }) as MessageChecklist
}

export async function ignoreThreadPoll(
  role: MessagingRole,
  threadId: number,
  pollId: number,
  fetcher: Fetcher,
): Promise<void> {
  await fetcher(`/api/${role}/messages/${threadId}/polls/${pollId}/ignore`, { method: 'POST' })
}

export async function ignoreThreadSignupSheet(
  role: MessagingRole,
  threadId: number,
  signupId: number,
  fetcher: Fetcher,
): Promise<void> {
  await fetcher(`/api/${role}/messages/${threadId}/signup-sheets/${signupId}/ignore`, { method: 'POST' })
}

export async function voteThreadPoll(
  role: MessagingRole,
  threadId: number,
  messageId: number,
  fetcher: Fetcher,
  optionIndex: number,
): Promise<MessagePoll> {
  return await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/poll/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option_index: optionIndex }),
  }) as MessagePoll
}

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
): Promise<void> {
  await fetcher(`/api/admin/events/${eventId}/message-threads`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

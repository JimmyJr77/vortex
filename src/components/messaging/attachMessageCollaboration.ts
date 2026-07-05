import type { MessagingRole } from './types'
import type { CollaborationDraft } from './MessageComposerCollaboration'
import { buildCollaborationPayload } from './MessageComposerCollaboration'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export async function attachMessageCollaboration(
  role: MessagingRole,
  threadId: number,
  messageId: number,
  draft: CollaborationDraft,
  fetcher: Fetcher,
): Promise<void> {
  const payload = buildCollaborationPayload(draft)
  if (!payload) return

  if (payload.type === 'poll') {
    await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: payload.question, options: payload.options }),
    })
    return
  }

  await fetcher(`/api/${role}/messages/${threadId}/messages/${messageId}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payload.items }),
  })
}

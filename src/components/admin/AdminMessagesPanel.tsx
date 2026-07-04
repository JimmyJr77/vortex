import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import { recipientsToPayload } from '../messaging/RecipientPicker'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import MessageBubble from '../messaging/MessageBubble'
import { getMessageViewer } from '../messaging/messageBubbleStyle'
import type { MessageRow, MessageThread, RecipientOption, ThreadParticipant } from '../messaging/types'
import { participantKey } from '../messaging/types'

async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await adminApiRequest(endpoint, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed: ${res.status}`)
  }
  return (json?.data ?? json) as T
}

export default function AdminMessagesPanel() {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [threadSubject, setThreadSubject] = useState<string | null>(null)
  const [threadSubjectLocked, setThreadSubjectLocked] = useState(false)
  const [threadParticipants, setThreadParticipants] = useState<ThreadParticipant[]>([])
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const viewer = useMemo(() => getMessageViewer('admin'), [])
  const existingParticipantKeys = useMemo(
    () => threadParticipants.map((p) => participantKey(p)).filter((k): k is string => k != null),
    [threadParticipants],
  )

  useEffect(() => {
    setRecipientsLoading(true)
    adminFetch<RecipientOption[]>('/api/admin/messages/recipient-options')
      .then(setRecipientOptions)
      .catch(() => {})
      .finally(() => setRecipientsLoading(false))
  }, [])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      setThreads(await adminFetch<MessageThread[]>('/api/admin/messages'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  const openThread = async (id: number) => {
    setSelectedId(id)
    setDetailLoading(true)
    setError(null)
    try {
      const data = await adminFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/admin/messages/${id}`)
      setThreadSubject(data.thread.subject ?? null)
      setThreadSubjectLocked(Boolean(data.thread.subject_locked))
      setThreadParticipants(Array.isArray(data.thread.participants) ? data.thread.participants : [])
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setDetailLoading(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      const msg = await adminFetch<MessageRow>(`/api/admin/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ body: reply.trim() }),
      })
      setMessages((prev) => [...prev, msg])
      setReply('')
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const updateThreadSubject = async (update: { subject: string | null; subject_locked?: boolean }) => {
    if (!selectedId) return
    const updated = await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/subject`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    setThreadSubject(updated.subject ?? null)
    setThreadSubjectLocked(Boolean(updated.subject_locked))
    void loadThreads()
  }

  const addRecipients = async (recipients: RecipientOption[]) => {
    if (!selectedId || recipients.length === 0) return
    const updated = await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/recipients`, {
      method: 'PATCH',
      body: JSON.stringify(recipientsToPayload(recipients)),
    })
    setThreadParticipants(Array.isArray(updated.participants) ? updated.participants : [])
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
        </h2>
        <p className="text-sm text-gray-500">All facility messaging threads.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] min-h-[400px]">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">All threads</div>
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No threads yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selectedId === t.id ? 'bg-red-50' : ''}`}
                >
                  <div className="font-semibold text-gray-900 text-sm truncate">
                    {t.subject || (t.first_name ? `${t.first_name} ${t.last_name}` : 'Conversation')}
                  </div>
                  {t.first_name && (
                    <div className="text-xs text-gray-500 truncate">{t.first_name} {t.last_name}</div>
                  )}
                  {t.last_message_body && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">{t.last_message_body}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-h-[400px]">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">Select a thread to view and reply.</div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-semibold text-sm truncate">{threadSubject || 'Conversation'}</span>
                  {threadSubjectLocked && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">Locked</span>
                  )}
                </div>
                <ThreadHeaderMenu
                  subject={threadSubject}
                  subjectLocked={threadSubjectLocked}
                  canLock
                  canEdit
                  onUpdateSubject={updateThreadSubject}
                  recipientOptions={recipientOptions}
                  existingParticipantKeys={existingParticipantKeys}
                  recipientsLoading={recipientsLoading}
                  onAddRecipients={addRecipients}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} viewer={viewer} />
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply as admin…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendReply()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={sending || !reply.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquare, Plus } from 'lucide-react'
import { coachFetch } from '../../coach/api'

interface MemberOption {
  id: number
  name: string
}

type MemberPickerScope = 'my_classes' | 'all'

interface ThreadRow {
  id: number
  member_id: number
  subject?: string | null
  coach_user_id?: number | null
  thread_scope?: 'assigned_coach' | 'coaching_circle'
  first_name?: string
  last_name?: string
  last_message_body?: string | null
  last_message_created_at?: string | null
  last_message_at?: string | null
}

interface MessageRow {
  id: number
  body: string
  sender_name?: string | null
  sender_user_id?: number | null
  sender_member_id?: number | null
  created_at: string
}

export default function MessagesPanel() {
  const [memberScope, setMemberScope] = useState<MemberPickerScope>('my_classes')
  const [members, setMembers] = useState<MemberOption[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [threadSubject, setThreadSubject] = useState<string | null>(null)
  const [threadScope, setThreadScope] = useState<'assigned_coach' | 'coaching_circle' | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newMemberId, setNewMemberId] = useState<number | ''>('')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')

  const loadMemberOptions = useCallback(async (scope: MemberPickerScope) => {
    setMembersLoading(true)
    try {
      setMembers(await coachFetch<MemberOption[]>(`/api/coach/members?scope=${scope}`))
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMemberOptions(memberScope)
  }, [memberScope, loadMemberOptions])

  useEffect(() => {
    if (newMemberId !== '' && !members.some((m) => m.id === newMemberId)) {
      setNewMemberId('')
    }
  }, [members, newMemberId])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      setThreads(await coachFetch<ThreadRow[]>('/api/coach/messages'))
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
      const data = await coachFetch<{ thread: ThreadRow; messages: MessageRow[] }>(`/api/coach/messages/${id}`)
      setThreadSubject(data.thread.subject ?? null)
      setThreadScope(data.thread.thread_scope ?? 'coaching_circle')
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
      const msg = await coachFetch<MessageRow>(`/api/coach/messages/${selectedId}`, {
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

  const openToCoachingCircle = async () => {
    if (!selectedId) return
    try {
      const updated = await coachFetch<ThreadRow>(`/api/coach/messages/${selectedId}/open-circle`, { method: 'PATCH' })
      setThreadScope(updated.thread_scope ?? 'coaching_circle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open thread')
    }
  }

  const startThread = async () => {
    if (newMemberId === '' || !newBody.trim()) return
    setSending(true)
    try {
      const data = await coachFetch<{ thread: ThreadRow; message: MessageRow }>('/api/coach/messages', {
        method: 'POST',
        body: JSON.stringify({
          member_id: newMemberId,
          subject: newSubject.trim() || null,
          body: newBody.trim(),
        }),
      })
      setNewOpen(false)
      setNewSubject('')
      setNewBody('')
      setNewMemberId('')
      void loadThreads()
      await openThread(data.thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start thread')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
          </h2>
          <p className="text-sm text-gray-500">Feedback threads with athletes and families.</p>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
        >
          <Plus className="w-4 h-4" /> New message
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {newOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New thread</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMemberScope('my_classes')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'my_classes' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              My classes
            </button>
            <button
              type="button"
              onClick={() => setMemberScope('all')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'all' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Any athlete
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {memberScope === 'my_classes'
              ? 'Athletes enrolled in programs you teach.'
              : 'All active athletes at your facility.'}
          </p>
          <select
            value={newMemberId}
            onChange={(e) => setNewMemberId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            disabled={membersLoading}
          >
            <option value="">Select athlete…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Message…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => void startThread()} disabled={sending} className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
              Send
            </button>
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] min-h-[400px]">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">Threads</div>
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
                  <div className="font-semibold text-gray-900 text-sm">
                    {t.first_name} {t.last_name}
                  </div>
                  {t.subject && <div className="text-xs text-gray-600 truncate">{t.subject}</div>}
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
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">Select a thread or start a new message.</div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{threadSubject || 'Conversation'}</span>
                {threadScope === 'assigned_coach' && (
                  <button
                    type="button"
                    onClick={() => void openToCoachingCircle()}
                    className="text-xs font-semibold text-vortex-red hover:underline"
                  >
                    Share with coaching circle
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      m.sender_member_id ? 'bg-gray-100 text-gray-900 ml-0' : 'bg-vortex-red text-white ml-auto'
                    }`}
                  >
                    <div className="text-[10px] opacity-70 mb-0.5">{m.sender_name || 'Coach'}</div>
                    <div>{m.body}</div>
                    <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply…"
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

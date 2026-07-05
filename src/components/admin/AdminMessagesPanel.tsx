import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageSquare, Plus } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import ArchivedMessageLines from '../messaging/ArchivedMessageLines'
import MessageBubble from '../messaging/MessageBubble'
import MessageReplyComposer from '../messaging/MessageReplyComposer'
import RecipientPicker, { recipientsToPayload } from '../messaging/RecipientPicker'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import { getMessageViewer } from '../messaging/messageBubbleStyle'
import { uploadMessageAttachment } from '../messaging/messageAttachmentUpload'
import type { EnrollmentGroup, MessageRow, MessageThread, RecipientOption, ThreadParticipant } from '../messaging/types'
import { mergeRecipientOptions, participantKey } from '../messaging/types'

type AdminMessagesTab = 'active-mine' | 'active-all' | 'archived'
type ListSort = 'title' | 'created'

async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await adminApiRequest(endpoint, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed: ${res.status}`)
  }
  return (json?.data ?? json) as T
}

function threadTitle(t: MessageThread) {
  return t.subject?.trim() || (t.first_name ? `${t.first_name} ${t.last_name}`.trim() : 'Conversation')
}

export default function AdminMessagesPanel() {
  const [tab, setTab] = useState<AdminMessagesTab>('active-mine')
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [threadSubject, setThreadSubject] = useState<string | null>(null)
  const [threadSubjectLocked, setThreadSubjectLocked] = useState(false)
  const [threadParticipants, setThreadParticipants] = useState<ThreadParticipant[]>([])
  const [threadStatus, setThreadStatus] = useState<'open' | 'archived'>('open')
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newRecipients, setNewRecipients] = useState<RecipientOption[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [listSearchApplied, setListSearchApplied] = useState('')
  const [listSort, setListSort] = useState<ListSort>('title')
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [threadFavorite, setThreadFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)

  const isFlatView = tab === 'active-all' || tab === 'archived'
  const canReply = tab === 'active-mine' || tab === 'active-all'

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

  useEffect(() => {
    setGroupsLoading(true)
    adminFetch<EnrollmentGroup[]>('/api/admin/messages/enrollment-groups')
      .then(setEnrollmentGroups)
      .catch(() => setEnrollmentGroups([]))
      .finally(() => setGroupsLoading(false))
  }, [])

  const resolveEnrollmentGroup = useCallback(async (group: EnrollmentGroup) => {
    const params = new URLSearchParams({ type: group.groupType, id: String(group.id) })
    return adminFetch<RecipientOption[]>(`/api/admin/messages/group-members?${params.toString()}`)
  }, [])

  const addEnrollmentGroupToNew = useCallback(async (group: EnrollmentGroup) => {
    const added = await resolveEnrollmentGroup(group)
    setNewRecipients((prev) => mergeRecipientOptions(prev, added))
  }, [resolveEnrollmentGroup])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('status', tab === 'archived' ? 'archived' : 'open')
      if (tab === 'active-mine') {
        params.set('scope', 'mine')
      } else if (tab === 'active-all') {
        params.set('scope', 'all')
      }
      if (isFlatView) {
        params.set('sort', listSort)
        if (listSearchApplied.trim()) params.set('q', listSearchApplied.trim())
      }
      setThreads(await adminFetch<MessageThread[]>(`/api/admin/messages?${params.toString()}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [tab, isFlatView, listSort, listSearchApplied])

  useEffect(() => {
    setSelectedId(null)
    setMessages([])
    setNewOpen(false)
    void loadThreads()
  }, [loadThreads])

  const openThread = async (id: number) => {
    setSelectedId(id)
    setDetailLoading(true)
    setError(null)
    const listRow = threads.find((t) => t.id === id)
    setThreadFavorite(Boolean(listRow?.is_favorite))
    try {
      const data = await adminFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/admin/messages/${id}`)
      setThreadSubject(data.thread.subject ?? null)
      setThreadSubjectLocked(Boolean(data.thread.subject_locked))
      setThreadParticipants(Array.isArray(data.thread.participants) ? data.thread.participants : [])
      setThreadStatus(data.thread.status === 'archived' ? 'archived' : 'open')
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setDetailLoading(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || (!reply.trim() && !pendingAttachment) || !canReply) return
    setSending(true)
    try {
      let attachmentPayload: Record<string, string | null> = {}
      if (pendingAttachment) {
        attachmentPayload = await uploadMessageAttachment(pendingAttachment, () =>
          adminFetch('/api/admin/messages/upload-signature'),
        )
      }
      const msg = await adminFetch<MessageRow>(`/api/admin/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ body: reply.trim(), ...attachmentPayload }),
      })
      setMessages((prev) => [...prev, msg])
      setReply('')
      setPendingAttachment(null)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const startThread = async () => {
    if (newRecipients.length === 0 || !newBody.trim()) return
    setSending(true)
    try {
      const data = await adminFetch<{ thread: MessageThread; message: MessageRow }>('/api/admin/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject.trim() || null,
          body: newBody.trim(),
          ...recipientsToPayload(newRecipients),
        }),
      })
      setNewOpen(false)
      setNewSubject('')
      setNewBody('')
      setNewRecipients([])
      void loadThreads()
      await openThread(data.thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start thread')
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

  const hideFromInbox = async () => {
    if (!selectedId) return
    await adminFetch(`/api/admin/messages/${selectedId}/inbox`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: true }),
    })
    setSelectedId(null)
    setMessages([])
    void loadThreads()
  }

  const restoreThreadGlobally = async () => {
    if (!selectedId) return
    await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: false }),
    })
    setSelectedId(null)
    setMessages([])
    void loadThreads()
  }

  const toggleFavorite = async (favorite: boolean) => {
    if (!selectedId) return
    setFavoriteLoading(true)
    try {
      await adminFetch(`/api/admin/messages/${selectedId}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite }),
      })
      setThreadFavorite(favorite)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite')
    } finally {
      setFavoriteLoading(false)
    }
  }

  const applyListSearch = () => {
    setListSearchApplied(listSearch)
  }

  const listPanelTitle =
    tab === 'archived' ? 'Archived threads' : tab === 'active-all' ? 'All active threads' : 'Your active threads'

  const emptyDetailHint =
    tab === 'archived'
      ? 'Select an archived thread to review messages.'
      : tab === 'active-all'
        ? 'Select a thread to review the full transcript.'
        : 'Select a thread to view and reply.'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
          </h2>
          <p className="text-sm text-gray-500">
            Your conversations, facility-wide active threads, and archived history.
          </p>
        </div>
        {tab !== 'archived' && (
          <button
            type="button"
            onClick={() => setNewOpen((v) => !v)}
            className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New message
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        {(
          [
            ['active-mine', 'Active · Admin'],
            ['active-all', 'Active · All'],
            ['archived', 'Archived'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === id ? 'border-vortex-red text-vortex-red' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {tab !== 'archived' && newOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New thread</h3>
          <RecipientPicker
            options={recipientOptions}
            selected={newRecipients}
            onChange={setNewRecipients}
            loading={recipientsLoading}
            placeholder="Search members, coaches, admins…"
            enrollmentGroups={enrollmentGroups}
            onAddEnrollmentGroup={addEnrollmentGroupToNew}
            groupsLoading={groupsLoading}
            groupActionLabel="Add all enrolled in"
          />
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Thread name (optional)"
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
            <button
              type="button"
              onClick={() => void startThread()}
              disabled={sending || newRecipients.length === 0 || !newBody.trim()}
              className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              Send
            </button>
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isFlatView && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[200px] text-sm">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Search</span>
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyListSearch() }}
                placeholder="Title, user, or message text…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={applyListSearch}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Search
            </button>
            <label className="text-sm">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Sort</span>
              <select
                value={listSort}
                onChange={(e) => setListSort(e.target.value as ListSort)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="title">Title (A–Z)</option>
                <option value="created">Date created</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] min-h-[420px]">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm shrink-0">
            {listPanelTitle}
          </div>
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No threads found.</div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-y-auto max-h-[520px]">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selectedId === t.id ? 'bg-red-50' : ''}`}
                >
                  <div className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1">
                    {t.is_favorite && <span className="text-yellow-400 text-xs" aria-hidden>★</span>}
                    {threadTitle(t)}
                  </div>
                  {t.participant_names && (
                    <div className="text-xs text-gray-500 truncate">{t.participant_names}</div>
                  )}
                  {isFlatView && t.created_at && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  )}
                  {t.last_message_body && tab === 'active-mine' && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">{t.last_message_body}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`bg-white border border-gray-200 rounded-xl flex flex-col min-h-[420px] ${isFlatView ? 'font-sans' : ''}`}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">
              {emptyDetailHint}
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : isFlatView ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900">{threadSubject || 'Conversation'}</div>
                  {threadParticipants.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {threadParticipants.map((p) => p.name).filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tab === 'archived' ? (
                    <ThreadHeaderMenu
                      subject={threadSubject}
                      subjectLocked={threadSubjectLocked}
                      canLock={false}
                      canEdit={false}
                      onUpdateSubject={updateThreadSubject}
                      isGloballyArchived
                      onRestoreThread={restoreThreadGlobally}
                      isFavorite={threadFavorite}
                      onToggleFavorite={toggleFavorite}
                      favoriteLoading={favoriteLoading}
                    />
                  ) : (
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
                      enrollmentGroups={enrollmentGroups}
                      resolveEnrollmentGroup={resolveEnrollmentGroup}
                      groupsLoading={groupsLoading}
                      canHideFromInbox
                      onHideFromInbox={hideFromInbox}
                      isFavorite={threadFavorite}
                      onToggleFavorite={toggleFavorite}
                      favoriteLoading={favoriteLoading}
                      canAttach={tab === 'active-all'}
                      onAttachmentPick={setPendingAttachment}
                    />
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ArchivedMessageLines messages={messages} />
              </div>
              {canReply && (
                <MessageReplyComposer
                  reply={reply}
                  onReplyChange={setReply}
                  onSend={() => void sendReply()}
                  sending={sending}
                  placeholder="Reply as admin…"
                  pendingAttachment={pendingAttachment}
                  onClearAttachment={() => setPendingAttachment(null)}
                />
              )}
            </>
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
                  enrollmentGroups={enrollmentGroups}
                  resolveEnrollmentGroup={resolveEnrollmentGroup}
                  groupsLoading={groupsLoading}
                  canHideFromInbox
                  onHideFromInbox={hideFromInbox}
                  isFavorite={threadFavorite}
                  onToggleFavorite={toggleFavorite}
                  favoriteLoading={favoriteLoading}
                  canAttach
                  onAttachmentPick={setPendingAttachment}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} viewer={viewer} />
                ))}
              </div>
              <MessageReplyComposer
                reply={reply}
                onReplyChange={setReply}
                onSend={() => void sendReply()}
                sending={sending}
                placeholder="Reply as admin…"
                pendingAttachment={pendingAttachment}
                onClearAttachment={() => setPendingAttachment(null)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

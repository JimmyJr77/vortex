import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare, Plus, X } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import ArchivedMessageLines from '../messaging/ArchivedMessageLines'
import MessageReplyComposer from '../messaging/MessageReplyComposer'
import MessagingThreadListShell from '../messaging/MessagingThreadListShell'
import MessagingMobileShell from '../messaging/MessagingMobileShell'
import MessagingInboxTabs, { type MessagingInboxTab } from '../messaging/MessagingInboxTabs'
import MessagingThreadRow from '../messaging/MessagingThreadRow'
import MessagingContextBanner from '../messaging/MessagingContextBanner'
import MessagingInfoCard from '../messaging/MessagingInfoCard'
import CriticalMessageToggle from '../messaging/CriticalMessageToggle'
import RecipientPicker, { recipientsToPayload } from '../messaging/RecipientPicker'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import { getMessageViewer } from '../messaging/messageBubbleStyle'
import { uploadMessageAttachment, type UploadedAttachment } from '../messaging/messageAttachmentUpload'
import { markThreadRead } from '../messaging/messagingApi'
import MessagingThreadFaq, { type ThreadFaqDraft } from '../messaging/MessagingThreadFaq'
import MessagingThreadDetailShell from '../messaging/MessagingThreadDetailShell'
import MessagePinSelectionBar from '../messaging/MessagePinSelectionBar'
import { useThreadPinGroups } from '../messaging/useThreadPinGroups'
import MessagingMessageThread from '../messaging/MessagingMessageThread'
import MessagingLeftPanelTabs, { type MessagingLeftPanel } from '../messaging/MessagingLeftPanelTabs'
import MessagingFaqMasterPanel from '../messaging/MessagingFaqMasterPanel'
import { buildReplyQuote, stripReplyQuote } from '../messaging/messageFormatting'
import { prepareMessageBodyForSend, type MessageMentionPayload } from '../messaging/messageMentions'
import MessagingThreadListSortMenu, {
  defaultSortDir,
  toApiThreadSort,
  type ThreadListSortDir,
  type ThreadListSortField,
} from '../messaging/MessagingThreadListSortMenu'
import {
  countThreadsByInboxTab,
  filterMessageThreads,
  filterThreadsByInboxTab,
  messagingWorkspaceRoot,
  messagingWorkspaceShell,
  messagingWorkspaceThreadOpen,
  threadListTitle,
} from '../messaging/messagingLayout'
import type {
  CriticalComposeFlags,
  EnrollmentGroup,
  MessageRow,
  MessageThread,
  RecipientOption,
  ThreadParticipant,
} from '../messaging/types'
import { mergeRecipientOptions, participantKey } from '../messaging/types'
import { useMessageRealtime } from '../../hooks/useMessageRealtime'

type AdminMessagesTab = 'active-mine' | 'active-all' | 'archived'

async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await adminApiRequest(endpoint, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed: ${res.status}`)
  }
  return (json?.data ?? json) as T
}

export default function AdminMessagesPanel({
  initialThreadId = null,
  onInitialThreadOpened,
}: {
  initialThreadId?: number | null
  onInitialThreadOpened?: () => void
} = {}) {
  const [tab, setTab] = useState<AdminMessagesTab>('active-mine')
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
  const [replyTarget, setReplyTarget] = useState<MessageRow | null>(null)
  const [sending, setSending] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newRecipients, setNewRecipients] = useState<RecipientOption[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [listSort, setListSort] = useState<ThreadListSortField>('title')
  const [listSortDir, setListSortDir] = useState<ThreadListSortDir>(() => defaultSortDir('title'))
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [threadFavorite, setThreadFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [inboxTab, setInboxTab] = useState<MessagingInboxTab>('all')
  const [threadInfoJson, setThreadInfoJson] = useState<Record<string, unknown> | null>(null)
  const [linkedThreadId, setLinkedThreadId] = useState<number | null>(null)
  const [faqPanelOpen, setFaqPanelOpen] = useState(false)
  const [faqDraft, setFaqDraft] = useState<ThreadFaqDraft | null>(null)
  const [pendingFaqReply, setPendingFaqReply] = useState<{ question: string; prefix: string } | null>(null)
  const [criticalFlags, setCriticalFlags] = useState<CriticalComposeFlags>({
    is_critical: false,
    requires_ack: false,
  })
  const [leftPanel, setLeftPanel] = useState<MessagingLeftPanel>('threads')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isFlatView = tab === 'active-all' || tab === 'archived'
  const canReply = tab === 'active-mine' || tab === 'active-all'

  const viewer = useMemo(() => getMessageViewer('admin'), [])
  const pins = useThreadPinGroups(selectedId, 'admin', adminFetch)
  const inboxCounts = useMemo(() => countThreadsByInboxTab(threads), [threads])
  const tabFilteredThreads = useMemo(() => {
    if (tab === 'archived') return threads
    return filterThreadsByInboxTab(threads, inboxTab)
  }, [threads, inboxTab, tab])
  const displayedThreads = useMemo(
    () => filterMessageThreads(tabFilteredThreads, listSearch),
    [tabFilteredThreads, listSearch],
  )
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
        params.set('sort', toApiThreadSort(listSort))
        params.set('sortDir', listSortDir)
      }
      setThreads(await adminFetch<MessageThread[]>(`/api/admin/messages?${params.toString()}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [tab, isFlatView, listSort, listSortDir])

  useEffect(() => {
    setSelectedId(null)
    setMessages([])
    setFaqPanelOpen(false)
    setFaqDraft(null)
    setPendingFaqReply(null)
    setNewOpen(false)
    setInboxTab(tab === 'archived' ? 'archived' : 'all')
    void loadThreads()
  }, [loadThreads, tab])

  useMessageRealtime({
    role: 'admin',
    threadId: selectedId,
    onMessageCreated: (payload) => {
      if (payload.threadId === selectedId && payload.data) {
        setMessages((prev) => {
          const next = payload.data as MessageRow
          if (prev.some((m) => m.id === next.id)) return prev
          return [...prev, next]
        })
      }
      void loadThreads()
    },
    onReadUpdated: () => {
      void loadThreads()
    },
    onNotificationCreated: () => {
      void loadThreads()
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

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
      setThreadInfoJson(data.thread.info_json ?? null)
      setLinkedThreadId(data.thread.linked_thread_id ?? null)
      setFaqPanelOpen(false)
      setFaqDraft(null)
      setPendingFaqReply(null)
      setMessages(data.messages)
      const lastId = data.messages[data.messages.length - 1]?.id
      void markThreadRead('admin', id, adminFetch, lastId)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (initialThreadId == null) return
    void openThread(initialThreadId).finally(() => onInitialThreadOpened?.())
  }, [initialThreadId])

  const replyToMessage = useCallback((message: MessageRow) => {
    setPendingFaqReply(null)
    setReplyTarget(message)
    setReply(buildReplyQuote(message))
  }, [])

  const replyToMessageWithFaq = useCallback((message: MessageRow) => {
    const prefix = buildReplyQuote(message)
    setReplyTarget(message)
    setReply(prefix)
    setPendingFaqReply({
      question: message.body?.trim() || 'Question',
      prefix,
    })
  }, [])

  const showPinControls = tab !== 'archived'
  const pinHeaderProps = showPinControls
    ? {
        pinFilter: pins.pinFilter,
        onPinFilterChange: pins.togglePinFilter,
        pinControlsDisabled: pins.pinSelectionActive,
      }
    : {}

  const sendReply = async (mentions: MessageMentionPayload[] = []) => {
    if (!selectedId || (!reply.trim() && !pendingAttachment) || !canReply) return
    setSending(true)
    try {
      let attachmentPayload: Partial<UploadedAttachment> = {}
      if (pendingAttachment) {
        attachmentPayload = await uploadMessageAttachment(pendingAttachment, 'admin', adminFetch)
      }
      const replyText = reply.trim()
      const { body, mentions: resolvedMentions } = prepareMessageBodyForSend(
        replyText,
        mentions,
        replyTarget,
        threadParticipants,
      )
      const msg = await adminFetch<MessageRow>(`/api/admin/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          mentions: resolvedMentions,
          ...attachmentPayload,
          is_critical: criticalFlags.is_critical,
          requires_ack: criticalFlags.requires_ack,
        }),
      })
      setMessages((prev) => [...prev, msg])
      if (pendingFaqReply) {
        setFaqDraft({
          question: pendingFaqReply.question,
          answer: stripReplyQuote(replyText, pendingFaqReply.prefix),
        })
        setFaqPanelOpen(true)
        setPendingFaqReply(null)
      }
      setReply('')
      setReplyTarget(null)
      setPendingAttachment(null)
      setCriticalFlags({ is_critical: false, requires_ack: false })
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

  const listPanelTitle =
    tab === 'archived' ? 'Archived threads' : tab === 'active-all' ? 'All active threads' : 'Your active threads'

  const emptyDetailHint =
    tab === 'archived'
      ? 'Select an archived thread to review messages.'
      : tab === 'active-all'
        ? 'Select a thread to review the full transcript.'
        : 'Select a thread to view and reply.'

  return (
    <div
      className={`${messagingWorkspaceRoot} ${selectedId != null ? messagingWorkspaceThreadOpen : ''}`}
    >
      <div className={`shrink-0 items-center justify-between flex-wrap gap-3 ${selectedId != null ? 'hidden lg:flex' : 'flex'}`}>
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

      <div className={`shrink-0 gap-2 border-b border-gray-200 flex-wrap ${selectedId != null ? 'hidden lg:flex' : 'flex'}`}>
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

      {error && <div className="shrink-0 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {tab !== 'archived' && newOpen && (
        <div className="shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
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

      <div className={messagingWorkspaceShell}>
      <MessagingMobileShell
        selectedThreadId={selectedId}
        onSelectThread={setSelectedId}
        onBack={() => setSelectedId(null)}
        listPanel={
          leftPanel === 'faq-master' && tab !== 'archived' ? (
            <div className="flex flex-col min-h-0 h-full max-h-full overflow-hidden">
              <div className="shrink-0 px-4 py-2 border-b border-gray-100 flex justify-end bg-white">
                <MessagingLeftPanelTabs active={leftPanel} onChange={setLeftPanel} />
              </div>
              <div className="flex-1 min-h-0">
                <MessagingFaqMasterPanel role="admin" fetcher={adminFetch} threads={threads} />
              </div>
            </div>
          ) : (
          <MessagingThreadListShell
            title={listPanelTitle}
            titleAction={
              <div className="flex items-center gap-1">
                {tab !== 'archived' && (
                  <MessagingLeftPanelTabs active={leftPanel} onChange={setLeftPanel} />
                )}
                {isFlatView ? (
                  <MessagingThreadListSortMenu
                    sort={listSort}
                    sortDir={listSortDir}
                    onChange={(sort, sortDir) => {
                      setListSort(sort)
                      setListSortDir(sortDir)
                    }}
                  />
                ) : null}
              </div>
            }
            search={listSearch}
            onSearchChange={setListSearch}
            searchPlaceholder="Search threads…"
            headerExtra={
              tab === 'archived' ? undefined : (
                <MessagingInboxTabs
                  activeTab={inboxTab}
                  onChange={setInboxTab}
                  counts={inboxCounts}
                  hiddenTabs={['archived']}
                />
              )
            }
          >
            {loading ? (
              <div className="p-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : displayedThreads.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                {threads.length === 0 ? 'No threads found.' : 'No threads match your filters.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayedThreads.map((t) => (
                  <MessagingThreadRow
                    key={t.id}
                    thread={t}
                    selected={selectedId === t.id}
                    onSelect={(id) => void openThread(id)}
                    subtitle={t.participant_names}
                    meta={isFlatView && t.created_at ? `Created ${new Date(t.created_at).toLocaleDateString()}` : null}
                  />
                ))}
              </div>
            )}
          </MessagingThreadListShell>
          )
        }
        detailPanel={
          !selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">
              {emptyDetailHint}
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : isFlatView ? (
            <MessagingThreadDetailShell
              header={
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
                    {faqPanelOpen ? (
                      <button
                        type="button"
                        aria-label="Close FAQ"
                        onClick={() => setFaqPanelOpen(false)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    ) : tab === 'archived' ? (
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
                        onOpenFaq={() => setFaqPanelOpen(true)}
                        {...pinHeaderProps}
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
                        onOpenFaq={() => setFaqPanelOpen(true)}
                        {...pinHeaderProps}
                      />
                    )}
                  </div>
                </div>
              }
              footer={
                canReply && !faqPanelOpen ? (
                  <>
                    <div className="px-4 pt-2 shrink-0">
                      <CriticalMessageToggle value={criticalFlags} onChange={setCriticalFlags} disabled={sending} />
                    </div>
                    <MessageReplyComposer
                      reply={reply}
                      onReplyChange={setReply}
                      onSend={(mentions) => void sendReply(mentions)}
                      sending={sending}
                      placeholder="Reply as admin… (@ to mention)"
                      participants={threadParticipants}
                      viewer={viewer}
                      pendingAttachment={pendingAttachment}
                      onClearAttachment={() => setPendingAttachment(null)}
                    />
                  </>
                ) : undefined
              }
            >
              {faqPanelOpen ? (
                <MessagingThreadFaq
                  role="admin"
                  threadId={selectedId}
                  fetcher={adminFetch}
                  canEdit={tab !== 'archived'}
                  variant="panel"
                  initialDraft={faqDraft}
                  onSaved={() => setFaqDraft(null)}
                />
              ) : (
                <>
                  <MessagingContextBanner
                    linkedThreadId={linkedThreadId}
                    linkedThreadTitle={
                      linkedThreadId != null
                        ? threadListTitle(threads.find((t) => t.id === linkedThreadId) ?? { id: linkedThreadId })
                        : null
                    }
                    onJump={(id) => void openThread(id)}
                  />
                  <MessagingInfoCard infoJson={threadInfoJson} />
                  {pins.pinSelection && tab === 'active-all' && (
                    <MessagePinSelectionBar
                      selectedCount={pins.pinSelection.size}
                      saving={pins.saving}
                      onSave={() => void pins.savePinSelection()}
                      onCancel={pins.cancelPinSelection}
                    />
                  )}
                  {tab === 'active-all' ? (
                    <MessagingMessageThread
                      messages={messages}
                      viewer={viewer}
                      threadId={selectedId}
                      role="admin"
                      fetcher={adminFetch}
                      participants={threadParticipants}
                      messagesEndRef={messagesEndRef}
                      onReply={replyToMessage}
                      onReplyWithFaq={replyToMessageWithFaq}
                      onPinComment={(message) => pins.startPinSelection(message.id)}
                      canUnpinMessage={(message) =>
                        pins.pinFilter === 'mine' && Boolean(pins.findOwnedGroupForMessage(message.id))
                      }
                      onUnpin={(message) => void pins.unpinMessage(message.id)}
                      pinSelectionActive={pins.pinSelectionActive}
                      pinSelectedIds={pins.pinSelection ?? undefined}
                      onPinSelectionToggle={(message) => pins.togglePinSelectionMessage(message.id)}
                      displayGroups={pins.displayGroups}
                      pinFilterActive={pins.pinFilter !== 'off'}
                      onReactionsUpdated={(messageId, reactions) => {
                        setMessages((prev) =>
                          prev.map((row) => (row.id === messageId ? { ...row, reactions } : row)),
                        )
                      }}
                    />
                  ) : (
                    <div>
                      <ArchivedMessageLines messages={messages} />
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </>
              )}
            </MessagingThreadDetailShell>
          ) : (
            <MessagingThreadDetailShell
              header={
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate">{threadSubject || 'Conversation'}</span>
                    {threadSubjectLocked && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">Locked</span>
                    )}
                  </div>
                  {faqPanelOpen ? (
                    <button
                      type="button"
                      aria-label="Close FAQ"
                      onClick={() => setFaqPanelOpen(false)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
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
                      canAttach
                      onAttachmentPick={setPendingAttachment}
                      onOpenFaq={() => setFaqPanelOpen(true)}
                      {...pinHeaderProps}
                    />
                  )}
                </div>
              }
              footer={
                faqPanelOpen ? undefined : (
                <>
                  <div className="px-4 pt-2 shrink-0">
                    <CriticalMessageToggle value={criticalFlags} onChange={setCriticalFlags} disabled={sending} />
                  </div>
                  <MessageReplyComposer
                    reply={reply}
                    onReplyChange={setReply}
                    onSend={(mentions) => void sendReply(mentions)}
                    sending={sending}
                    placeholder="Reply as admin… (@ to mention)"
                    participants={threadParticipants}
                    viewer={viewer}
                    pendingAttachment={pendingAttachment}
                    onClearAttachment={() => setPendingAttachment(null)}
                  />
                </>
                )
              }
            >
              {faqPanelOpen ? (
                <MessagingThreadFaq
                  role="admin"
                  threadId={selectedId}
                  fetcher={adminFetch}
                  canEdit
                  variant="panel"
                  initialDraft={faqDraft}
                  onSaved={() => setFaqDraft(null)}
                />
              ) : (
                <>
                  <MessagingContextBanner
                    linkedThreadId={linkedThreadId}
                    linkedThreadTitle={
                      linkedThreadId != null
                        ? threadListTitle(threads.find((t) => t.id === linkedThreadId) ?? { id: linkedThreadId })
                        : null
                    }
                    onJump={(id) => void openThread(id)}
                  />
                  <MessagingInfoCard infoJson={threadInfoJson} />
                  {pins.pinSelection && (
                    <MessagePinSelectionBar
                      selectedCount={pins.pinSelection.size}
                      saving={pins.saving}
                      onSave={() => void pins.savePinSelection()}
                      onCancel={pins.cancelPinSelection}
                    />
                  )}
                  <MessagingMessageThread
                    messages={messages}
                    viewer={viewer}
                    threadId={selectedId}
                    role="admin"
                    fetcher={adminFetch}
                    participants={threadParticipants}
                    messagesEndRef={messagesEndRef}
                    onReply={replyToMessage}
                    onReplyWithFaq={replyToMessageWithFaq}
                    onPinComment={(message) => pins.startPinSelection(message.id)}
                    canUnpinMessage={(message) =>
                      pins.pinFilter === 'mine' && Boolean(pins.findOwnedGroupForMessage(message.id))
                    }
                    onUnpin={(message) => void pins.unpinMessage(message.id)}
                    pinSelectionActive={pins.pinSelectionActive}
                    pinSelectedIds={pins.pinSelection ?? undefined}
                    onPinSelectionToggle={(message) => pins.togglePinSelectionMessage(message.id)}
                    displayGroups={pins.displayGroups}
                    pinFilterActive={pins.pinFilter !== 'off'}
                    onReactionsUpdated={(messageId, reactions) => {
                      setMessages((prev) =>
                        prev.map((row) => (row.id === messageId ? { ...row, reactions } : row)),
                      )
                    }}
                  />
                </>
              )}
            </MessagingThreadDetailShell>
          )
        }
      />
      </div>
    </div>
  )
}

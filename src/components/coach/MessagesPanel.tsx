import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare, Plus, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import RecipientPicker, { recipientsToPayload } from '../messaging/RecipientPicker'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import MessageReplyComposer from '../messaging/MessageReplyComposer'
import MessagingMessageThread from '../messaging/MessagingMessageThread'
import {
  defaultSortDir,
  type ThreadListSortDir,
  type ThreadListSortField,
} from '../messaging/MessagingThreadListSortMenu'
import { buildReplyQuote, stripReplyQuote } from '../messaging/messageFormatting'
import { prepareMessageBodyForSend, type MessageMentionPayload } from '../messaging/messageMentions'
import MessagingThreadListShell from '../messaging/MessagingThreadListShell'
import MessagingMobileShell from '../messaging/MessagingMobileShell'
import MessagingInboxTabs, { type MessagingInboxTab } from '../messaging/MessagingInboxTabs'
import MessagingThreadRow from '../messaging/MessagingThreadRow'
import MessagingContextBanner from '../messaging/MessagingContextBanner'
import EventCalendarItemBanner from '../messaging/EventCalendarItemBanner'
import MessagingInfoCard from '../messaging/MessagingInfoCard'
import CriticalMessageToggle from '../messaging/CriticalMessageToggle'
import { getMessageViewer } from '../messaging/messageBubbleStyle'
import { uploadMessageAttachment, type UploadedAttachment } from '../messaging/messageAttachmentUpload'
import { markThreadRead } from '../messaging/messagingApi'
import MessagingThreadFaq, { type ThreadFaqDraft } from '../messaging/MessagingThreadFaq'
import MessagingThreadDetailShell from '../messaging/MessagingThreadDetailShell'
import MessagingMaximizeToggle from '../messaging/MessagingMaximizeToggle'
import MessagePinSelectionBar from '../messaging/MessagePinSelectionBar'
import { useThreadPinGroups } from '../messaging/useThreadPinGroups'
import MessagingThreadPollsPanel from '../messaging/MessagingThreadPollsPanel'
import MessagingThreadSignupsPanel from '../messaging/MessagingThreadSignupsPanel'
import { useThreadCollaboration } from '../messaging/useThreadCollaboration'
import { useMessagingInboxList } from '../messaging/useMessagingInboxList'
import MessagingThreadListHeaderActions from '../messaging/MessagingThreadListHeaderActions'
import { getInboxPrimaryAction } from '../messaging/messagingInboxActions'
import ClassThreadCreateModal from '../messaging/ClassThreadCreateModal'
import EventBoardCreateModal from '../messaging/EventBoardCreateModal'
import FileUploadComposeModal from '../messaging/FileUploadComposeModal'
import CalendarItemComposePanel from '../messaging/CalendarItemComposePanel'
import ScheduleItemBanner from '../messaging/ScheduleItemBanner'
import {
  countThreadsByInboxTab,
  filterThreadsByInboxTab,
  messagingWorkspaceRoot,
  messagingWorkspaceShell,
  messagingWorkspaceThreadOpen,
  defaultLandingThreadId,
  messagingViewportShowsBothPanels,
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
import { scrollToEndWithinContainer } from '../messaging/scrollMessagingContainer'

type MemberPickerScope = 'my_classes' | 'all'

export default function MessagesPanel({
  initialThreadId = null,
  onInitialThreadOpened,
  maximized = false,
  onMaximizedChange,
}: {
  initialThreadId?: number | null
  onInitialThreadOpened?: () => void
  maximized?: boolean
  onMaximizedChange?: (maximized: boolean) => void
} = {}) {
  const [memberScope, setMemberScope] = useState<MemberPickerScope>('my_classes')
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [threadSubject, setThreadSubject] = useState<string | null>(null)
  const [threadSubjectLocked, setThreadSubjectLocked] = useState(false)
  const [threadScope, setThreadScope] = useState<'assigned_coach' | 'coaching_circle' | null>(null)
  const [threadParticipants, setThreadParticipants] = useState<ThreadParticipant[]>([])
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
  const [recipientLoadError, setRecipientLoadError] = useState<string | null>(null)
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [threadFavorite, setThreadFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [threadSearch, setThreadSearch] = useState('')
  const [listSort, setListSort] = useState<ThreadListSortField>('recent')
  const [listSortDir, setListSortDir] = useState<ThreadListSortDir>(() => defaultSortDir('recent'))
  const [inboxTab, setInboxTab] = useState<MessagingInboxTab>('messages')
  const [threadInfoJson, setThreadInfoJson] = useState<Record<string, unknown> | null>(null)
  const [linkedThreadId, setLinkedThreadId] = useState<number | null>(null)
  const [faqPanelOpen, setFaqPanelOpen] = useState(false)
  const [faqDraft, setFaqDraft] = useState<ThreadFaqDraft | null>(null)
  const [pendingFaqReply, setPendingFaqReply] = useState<{ question: string; prefix: string } | null>(null)
  const [criticalFlags, setCriticalFlags] = useState<CriticalComposeFlags>({
    is_critical: false,
    requires_ack: false,
    send_critical_sms: false,
  })
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [eventBoardModalOpen, setEventBoardModalOpen] = useState(false)
  const [fileModalOpen, setFileModalOpen] = useState(false)
  const [calendarComposeOpen, setCalendarComposeOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoOpenedRef = useRef(false)
  const viewer = useMemo(() => getMessageViewer('coach'), [])
  const pins = useThreadPinGroups(selectedId, 'coach', coachFetch)
  const inboxCountsBase = useMemo(() => countThreadsByInboxTab(threads), [threads])
  const tabFilteredThreads = useMemo(
    () => filterThreadsByInboxTab(threads, inboxTab),
    [threads, inboxTab],
  )
  const inboxList = useMessagingInboxList({
    inboxTab,
    tabFilteredThreads,
    listSearch: threadSearch,
    listSort,
    listSortDir,
    role: 'coach',
    fetcher: coachFetch,
  })
  const filteredThreads = inboxList.displayedThreads
  const inboxCounts = useMemo(
    () => ({ ...inboxCountsBase, ...inboxList.inboxCountsPatch }),
    [inboxCountsBase, inboxList.inboxCountsPatch],
  )
  const primaryAction = useMemo(
    () => getInboxPrimaryAction(inboxTab, 'coach'),
    [inboxTab],
  )
  const existingParticipantKeys = useMemo(
    () => threadParticipants.map((p) => participantKey(p)).filter((k): k is string => k != null),
    [threadParticipants],
  )

  const loadRecipientOptions = useCallback(async (scope: MemberPickerScope) => {
    setRecipientsLoading(true)
    setRecipientLoadError(null)
    try {
      const raw = await coachFetch<RecipientOption[]>(`/api/coach/messages/recipient-options?scope=${scope}`)
      const list = Array.isArray(raw) ? raw : []
      setRecipientOptions(list)
      if (list.length === 0) {
        setRecipientLoadError('No recipients found. Try “Any athlete” or check class assignments.')
      }
    } catch (err) {
      setRecipientOptions([])
      setRecipientLoadError(err instanceof Error ? err.message : 'Failed to load recipients')
    } finally {
      setRecipientsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecipientOptions(memberScope)
  }, [memberScope, loadRecipientOptions])

  useEffect(() => {
    if (newOpen) void loadRecipientOptions(memberScope)
  }, [newOpen, memberScope, loadRecipientOptions])

  useEffect(() => {
    setGroupsLoading(true)
    coachFetch<EnrollmentGroup[]>('/api/coach/messages/enrollment-groups')
      .then(setEnrollmentGroups)
      .catch(() => setEnrollmentGroups([]))
      .finally(() => setGroupsLoading(false))
  }, [])

  const resolveEnrollmentGroup = useCallback(async (group: EnrollmentGroup) => {
    const params = new URLSearchParams({ type: group.groupType, id: String(group.id) })
    return coachFetch<RecipientOption[]>(`/api/coach/messages/group-members?${params.toString()}`)
  }, [])

  const addEnrollmentGroupToNew = useCallback(async (group: EnrollmentGroup) => {
    const added = await resolveEnrollmentGroup(group)
    setNewRecipients((prev) => mergeRecipientOptions(prev, added))
  }, [resolveEnrollmentGroup])

  useEffect(() => {
    setNewRecipients((prev) => prev.filter((r) => recipientOptions.some((o) => o.key === r.key)))
  }, [recipientOptions])

  useEffect(() => {
    scrollToEndWithinContainer(messagesEndRef.current)
  }, [messages, selectedId])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      setThreads(await coachFetch<MessageThread[]>('/api/coach/messages'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])
  const collaboration = useThreadCollaboration({
    role: 'coach',
    threadId: selectedId,
    fetcher: coachFetch,
    onChanged: () => void loadThreads(),
  })
  const anyTakeoverPanelOpen = faqPanelOpen || collaboration.pollPanelOpen || collaboration.signupPanelOpen
  const closeTakeoverPanels = () => {
    setFaqPanelOpen(false)
    collaboration.closePollPanel()
    collaboration.closeSignupPanel()
  }

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useMessageRealtime({
    role: 'coach',
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

  const openThread = async (rowId: number) => {
    const resolved = inboxList.resolveThreadSelection(rowId)
    const threadId = 'threadId' in resolved ? resolved.threadId : rowId
    if (threadId <= 0) return
    setCalendarComposeOpen(false)
    setSelectedId(threadId)
    setDetailLoading(true)
    setError(null)
    const listRow = threads.find((t) => t.id === threadId)
    setThreadFavorite(Boolean(listRow?.is_favorite))
    try {
      const data = await coachFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/coach/messages/${threadId}`)
      setThreadSubject(data.thread.subject ?? null)
      setThreadSubjectLocked(Boolean(data.thread.subject_locked))
      setThreadScope(data.thread.thread_scope ?? 'coaching_circle')
      setThreadParticipants(Array.isArray(data.thread.participants) ? data.thread.participants : [])
      setThreadInfoJson(data.thread.info_json ?? null)
      setLinkedThreadId(data.thread.linked_thread_id ?? null)
      setFaqPanelOpen(false)
      setFaqDraft(null)
      setPendingFaqReply(null)
      setMessages(data.messages)
      const lastId = data.messages[data.messages.length - 1]?.id
      void markThreadRead('coach', threadId, coachFetch, lastId)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (initialThreadId == null) return
    autoOpenedRef.current = true
    void openThread(initialThreadId).finally(() => onInitialThreadOpened?.())
  }, [initialThreadId])

  useEffect(() => {
    if (loading || autoOpenedRef.current || initialThreadId != null || selectedId != null) return
    // On phones/small screens only one panel shows at a time — land on the thread list instead.
    if (!messagingViewportShowsBothPanels()) return
    const landingId = defaultLandingThreadId(filteredThreads)
    if (landingId == null) return
    autoOpenedRef.current = true
    void openThread(landingId)
  }, [loading, filteredThreads, initialThreadId, selectedId])

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

  const sendReply = async (mentions: MessageMentionPayload[] = []) => {
    if (!selectedId || (!reply.trim() && !pendingAttachment)) return
    setSending(true)
    try {
      let attachmentPayload: Partial<UploadedAttachment> = {}
      if (pendingAttachment) {
        attachmentPayload = await uploadMessageAttachment(pendingAttachment, 'coach', coachFetch)
      }
      const replyText = reply.trim()
      const { body, mentions: resolvedMentions } = prepareMessageBodyForSend(
        replyText,
        mentions,
        replyTarget,
        threadParticipants,
      )
      const msg = await coachFetch<MessageRow>(`/api/coach/messages/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          mentions: resolvedMentions,
          ...attachmentPayload,
          is_critical: criticalFlags.is_critical,
          requires_ack: criticalFlags.requires_ack,
          send_critical_sms: criticalFlags.is_critical && criticalFlags.send_critical_sms,
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
      setCriticalFlags({ is_critical: false, requires_ack: false, send_critical_sms: false })
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const updateThreadSubject = async (update: { subject: string | null; subject_locked?: boolean }) => {
    if (!selectedId) return
    const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/subject`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    setThreadSubject(updated.subject ?? null)
    setThreadSubjectLocked(Boolean(updated.subject_locked))
    void loadThreads()
  }

  const addRecipients = async (recipients: RecipientOption[]) => {
    if (!selectedId || recipients.length === 0) return
    const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/recipients`, {
      method: 'PATCH',
      body: JSON.stringify(recipientsToPayload(recipients)),
    })
    setThreadParticipants(Array.isArray(updated.participants) ? updated.participants : [])
  }

  const hideFromInbox = async () => {
    if (!selectedId) return
    await coachFetch(`/api/coach/messages/${selectedId}/inbox`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: true }),
    })
    setSelectedId(null)
    setMessages([])
    void loadThreads()
  }

  const toggleFavorite = async (favorite: boolean) => {
    if (!selectedId) return
    setFavoriteLoading(true)
    try {
      await coachFetch(`/api/coach/messages/${selectedId}/favorite`, {
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

  const openToCoachingCircle = async () => {
    if (!selectedId) return
    try {
      const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/open-circle`, { method: 'PATCH' })
      setThreadScope(updated.thread_scope ?? 'coaching_circle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open thread')
    }
  }

  const handlePrimaryCreate = () => {
    if (primaryAction.disabled) return
    setNewOpen(false)
    setCalendarComposeOpen(false)
    switch (primaryAction.mode) {
      case 'message':
        setNewOpen(true)
        break
      case 'class':
        setClassModalOpen(true)
        break
      case 'eventBoard':
        setEventBoardModalOpen(true)
        break
      case 'calendarItem':
        setSelectedId(null)
        setCalendarComposeOpen(true)
        break
      case 'file':
        setFileModalOpen(true)
        break
      default:
        break
    }
  }

  const startThread = async () => {
    if (newRecipients.length === 0 || !newBody.trim()) return
    setSending(true)
    try {
      const data = await coachFetch<{ thread: MessageThread; message: MessageRow }>('/api/coach/messages', {
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

  return (
    <div
      className={`${messagingWorkspaceRoot} ${selectedId != null ? messagingWorkspaceThreadOpen : ''} ${maximized ? 'messaging-workspace--maximized' : ''}`}
    >
      <div className={`shrink-0 items-center justify-between flex-wrap gap-3 ${selectedId != null && !maximized ? 'hidden lg:flex' : maximized ? 'hidden' : 'flex'}`}>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-vortex-red" /> Messages
          </h2>
          <p className="text-sm text-gray-500">Feedback threads with athletes, coaches, and admins.</p>
        </div>
        <div className="flex items-center gap-2">
          {onMaximizedChange && (
            <MessagingMaximizeToggle
              maximized={maximized}
              onToggle={() => onMaximizedChange(!maximized)}
            />
          )}
          <button
            type="button"
            onClick={handlePrimaryCreate}
            disabled={primaryAction.hidden || primaryAction.disabled}
            title={primaryAction.disabled ? primaryAction.disabledReason : undefined}
            className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> {primaryAction.hidden ? 'New message thread' : primaryAction.label}
          </button>
        </div>
      </div>

      {error && <div className="shrink-0 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {newOpen && !maximized && (
        <div className="relative z-30 shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">New thread</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMemberScope('my_classes')
                setNewRecipients([])
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'my_classes' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              My classes
            </button>
            <button
              type="button"
              onClick={() => {
                setMemberScope('all')
                setNewRecipients([])
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${memberScope === 'all' ? 'bg-vortex-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Any athlete
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {memberScope === 'my_classes'
              ? 'Athletes in your classes, plus coaches and admins.'
              : 'All active athletes at your facility, plus coaches and admins.'}
          </p>
          {recipientLoadError && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {recipientLoadError}
            </div>
          )}
          <RecipientPicker
            options={recipientOptions}
            selected={newRecipients}
            onChange={setNewRecipients}
            loading={recipientsLoading}
            placeholder="Search athletes, coaches, admins…"
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
        onSelectThread={(id) => { if (id != null) void openThread(id) }}
        onBack={() => {
          inboxList.setActiveCalendarItem(null)
          inboxList.setActiveScheduleRow(null)
          setCalendarComposeOpen(false)
          setSelectedId(null)
        }}
        maximized={maximized}
        listPanel={
          <MessagingThreadListShell
            maximized={maximized}
            title="Threads"
            titleAction={
              <MessagingThreadListHeaderActions
                primaryAction={primaryAction}
                onPrimaryCreate={handlePrimaryCreate}
                sort={listSort}
                sortDir={listSortDir}
                onSortChange={(sort, sortDir) => {
                  setListSort(sort)
                  setListSortDir(sortDir)
                }}
                maximized={maximized}
                onMaximizedChange={onMaximizedChange}
              />
            }
            search={threadSearch}
            onSearchChange={setThreadSearch}
            searchPlaceholder="Search threads…"
            headerExtra={
              <MessagingInboxTabs activeTab={inboxTab} onChange={setInboxTab} counts={inboxCounts} />
            }
          >
            {loading ? (
              <div className="p-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                {threads.length === 0 ? 'No threads yet.' : 'No threads match your filters.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredThreads.map((t) => (
                  <MessagingThreadRow
                    key={t.id}
                    thread={t}
                    selected={selectedId === t.id}
                    onSelect={(id) => void openThread(id)}
                    subtitle={t.subject && t.first_name ? `${t.first_name} ${t.last_name}` : null}
                  />
                ))}
              </div>
            )}
          </MessagingThreadListShell>
        }
        detailPanel={
          calendarComposeOpen ? (
            <CalendarItemComposePanel
              fetcher={coachFetch}
              role="coach"
              onCancel={() => setCalendarComposeOpen(false)}
              onCreated={(_row, threadId) => {
                setCalendarComposeOpen(false)
                inboxList.refreshScheduleRows()
                void loadThreads()
                if (threadId != null) void openThread(threadId)
              }}
            />
          ) : !selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">Select a thread or start a new message.</div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
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
                  <div className="flex items-center gap-2 shrink-0">
                    {threadScope === 'assigned_coach' && (
                      <button
                        type="button"
                        onClick={() => void openToCoachingCircle()}
                        className="text-xs font-semibold text-vortex-red hover:underline"
                      >
                        Share with coaching circle
                      </button>
                    )}
                    {anyTakeoverPanelOpen ? (
                      <button
                        type="button"
                        aria-label="Close panel"
                        onClick={closeTakeoverPanels}
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
                        onOpenFaq={() => {
                          collaboration.closePollPanel()
                          collaboration.closeSignupPanel()
                          setFaqPanelOpen(true)
                        }}
                        pinFilter={pins.pinFilter}
                        onPinFilterChange={pins.togglePinFilter}
                        importantFilterActive={pins.importantFilterActive}
                        onImportantFilterChange={pins.toggleImportantFilter}
                        pinControlsDisabled={pins.pinSelectionActive}
                        hasActionablePoll={collaboration.hasActionablePoll}
                        hasActionableSignup={collaboration.hasActionableSignup}
                        onPollIconClick={() => {
                          setFaqPanelOpen(false)
                          collaboration.openPollPanel({ scrollToLatest: true })
                        }}
                        onSignupIconClick={() => {
                          setFaqPanelOpen(false)
                          collaboration.openSignupPanel({ scrollToLatest: true })
                        }}
                        onCreatePoll={() => {
                          setFaqPanelOpen(false)
                          collaboration.openPollPanel({ mode: 'create-poll' })
                        }}
                        onRespondPoll={() => {
                          setFaqPanelOpen(false)
                          collaboration.openPollPanel({ mode: 'pick-poll' })
                        }}
                        onCreateSignup={() => {
                          setFaqPanelOpen(false)
                          collaboration.openSignupPanel({ mode: 'create-signup' })
                        }}
                        onSignupNow={() => {
                          setFaqPanelOpen(false)
                          collaboration.openSignupPanel({ mode: 'pick-signup' })
                        }}
                      />
                    )}
                  </div>
                </div>
              }
              footer={
                anyTakeoverPanelOpen ? undefined : (
                <>
                  <div className="px-4 pt-2 shrink-0">
                    <CriticalMessageToggle value={criticalFlags} onChange={setCriticalFlags} disabled={sending} />
                  </div>
                  <MessageReplyComposer
                    reply={reply}
                    onReplyChange={setReply}
                    onSend={(mentions) => void sendReply(mentions)}
                    sending={sending}
                    placeholder="Type a reply… (@ to mention)"
                    participants={threadParticipants}
                    viewer={viewer}
                    pendingAttachment={pendingAttachment}
                    onClearAttachment={() => setPendingAttachment(null)}
                  />
                </>
                )
              }
            >
              {collaboration.pollPanelOpen && collaboration.panelMode ? (
                <MessagingThreadPollsPanel
                  mode={collaboration.panelMode as 'list-poll' | 'create-poll' | 'pick-poll' | 'view-poll'}
                  polls={collaboration.polls}
                  activePoll={collaboration.activePoll}
                  role="coach"
                  threadId={selectedId}
                  fetcher={coachFetch}
                  loading={collaboration.loading}
                  error={collaboration.error}
                  scrollToLatest={collaboration.scrollPollToLatest}
                  onScrollToLatestDone={collaboration.clearScrollPollToLatest}
                  onCreatePoll={collaboration.createPoll}
                  onPickPoll={collaboration.openPoll}
                  onRefresh={collaboration.refresh}
                  onClosePoll={collaboration.setPollClosed}
                  onIgnorePoll={collaboration.ignorePoll}
                />
              ) : collaboration.signupPanelOpen && collaboration.panelMode ? (
                <MessagingThreadSignupsPanel
                  mode={collaboration.panelMode as 'list-signup' | 'create-signup' | 'pick-signup' | 'view-signup'}
                  signups={collaboration.signups}
                  activeSignup={collaboration.activeSignup}
                  role="coach"
                  threadId={selectedId}
                  fetcher={coachFetch}
                  viewerUserId={viewer.userId}
                  loading={collaboration.loading}
                  error={collaboration.error}
                  scrollToLatest={collaboration.scrollSignupToLatest}
                  onScrollToLatestDone={collaboration.clearScrollSignupToLatest}
                  onCreateSignup={collaboration.createSignup}
                  onPickSignup={collaboration.openSignup}
                  onRefresh={collaboration.refresh}
                  onCloseSignup={collaboration.setSignupClosed}
                  onIgnoreSignup={collaboration.ignoreSignup}
                />
              ) : faqPanelOpen ? (
                <MessagingThreadFaq
                  role="coach"
                  threadId={selectedId}
                  fetcher={coachFetch}
                  canEdit
                  variant="panel"
                  initialDraft={faqDraft}
                  onSaved={() => setFaqDraft(null)}
                />
              ) : (
                <>
                  {pins.pinFilter === 'off' && !pins.importantFilterActive && (
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
                      <EventCalendarItemBanner item={inboxList.activeCalendarItem} />
                      <ScheduleItemBanner item={inboxList.activeScheduleRow} />
                      <MessagingInfoCard infoJson={threadInfoJson} />
                    </>
                  )}
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
                    role="coach"
                    fetcher={coachFetch}
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
                    importantFilterActive={pins.importantFilterActive}
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
      <ClassThreadCreateModal
        open={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        role="coach"
        fetcher={coachFetch}
        onCreated={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
      <EventBoardCreateModal
        open={eventBoardModalOpen}
        onClose={() => setEventBoardModalOpen(false)}
        fetcher={coachFetch}
        onCreated={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
      <FileUploadComposeModal
        open={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
        portal="coach"
        fetcher={coachFetch}
        threads={threads}
        onUploaded={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
    </div>
  )
}

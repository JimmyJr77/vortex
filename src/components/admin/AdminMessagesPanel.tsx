import MessagingResourceSidebar from '../messaging/MessagingResourceSidebar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Inbox, Loader2, MessageSquare, Plus, Search, X } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import ArchivedMessageLines from '../messaging/ArchivedMessageLines'
import MessageReplyComposer from '../messaging/MessageReplyComposer'
import MessagingThreadListShell from '../messaging/MessagingThreadListShell'
import MessagingConversationHeader from '../messaging/MessagingConversationHeader'
import MessagingEmptyState from '../messaging/MessagingEmptyState'
import NewMessageDialog from '../messaging/NewMessageDialog'
import MessagingMobileShell from '../messaging/MessagingMobileShell'
import MessagingInboxTabs, { type MessagingInboxTab } from '../messaging/MessagingInboxTabs'
import MessagingThreadRow from '../messaging/MessagingThreadRow'
import MessagingContextBanner from '../messaging/MessagingContextBanner'
import EventCalendarItemBanner from '../messaging/EventCalendarItemBanner'
import MessagingInfoCard from '../messaging/MessagingInfoCard'
import CriticalMessageToggle from '../messaging/CriticalMessageToggle'
import RecipientPicker from '../messaging/RecipientPicker'
import { recipientsToPayload } from '../messaging/recipientPayload'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import { getMessageViewer } from '../messaging/messageBubbleStyle'
import { uploadMessageAttachment, type UploadedAttachment } from '../messaging/messageAttachmentUpload'
import { markThreadRead, type ScheduleInboxRow } from '../messaging/messagingApi'
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
import MessagingMessageThread from '../messaging/MessagingMessageThread'
import { buildReplyQuote, stripReplyQuote } from '../messaging/messageFormatting'
import { prepareMessageBodyForSend, type MessageMentionPayload } from '../messaging/messageMentions'
import {
  defaultSortDir,
  toApiThreadSort,
  type ThreadListSortDir,
  type ThreadListSortField,
} from '../messaging/messagingThreadSort'
import {
  countThreadsByInboxTab,
  filterThreadsByInboxTab,
  messagingWorkspaceRoot,
  messagingWorkspaceShell,
  messagingWorkspaceThreadOpen,
  threadListTitle,
  scheduleRowVirtualId,
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
import { useMessagingHistoryScroll } from '../messaging/useMessagingHistoryScroll'
import { useMessageRealtime } from '../../hooks/useMessageRealtime'
import { useThreadReactionSync } from '../messaging/useThreadReactionSync'

type AdminMessagesTab = 'active-mine' | 'active-all' | 'archived'

interface ReplyDraft {
  reply: string
  target: MessageRow | null
  attachment: File | null
  critical: CriticalComposeFlags
  mentions: MessageMentionPayload[]
  faq: { question: string; prefix: string } | null
  error: string | null
}

const EMPTY_DRAFT: ReplyDraft = {
  reply: '', target: null, attachment: null, mentions: [], faq: null, error: null,
  critical: { is_critical: false, requires_ack: false, send_critical_sms: false },
}

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
  maximized = false,
  onMaximizedChange,
}: {
  initialThreadId?: number | null
  onInitialThreadOpened?: () => void
  maximized?: boolean
  onMaximizedChange?: (maximized: boolean) => void
} = {}) {
  const [tab, setTab] = useState<AdminMessagesTab>('active-mine')
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [threadSubject, setThreadSubject] = useState<string | null>(null)
  const [threadSubjectLocked, setThreadSubjectLocked] = useState(false)
  const [threadParticipants, setThreadParticipants] = useState<ThreadParticipant[]>([])
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<number, ReplyDraft>>({})
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newRecipients, setNewRecipients] = useState<RecipientOption[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [listSort, setListSort] = useState<ThreadListSortField>('recent')
  const [listSortDir, setListSortDir] = useState<ThreadListSortDir>(() => defaultSortDir('recent'))
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [threadFavorite, setThreadFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [inboxTab, setInboxTab] = useState<MessagingInboxTab>('messages')
  const [threadInfoJson, setThreadInfoJson] = useState<Record<string, unknown> | null>(null)
  const [linkedThreadId, setLinkedThreadId] = useState<number | null>(null)
  const [faqPanelOpen, setFaqPanelOpen] = useState(false)
  const [faqDraft, setFaqDraft] = useState<ThreadFaqDraft | null>(null)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [eventBoardModalOpen, setEventBoardModalOpen] = useState(false)
  const [fileModalOpen, setFileModalOpen] = useState(false)
  const [calendarComposeOpen, setCalendarComposeOpen] = useState(false)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const activeThreadRef = useRef<number | null>(null)
  const lastInitialThread = useRef<number | null>(null)

  const isFlatView = tab !== 'active-mine'
  const canReply = tab !== 'archived'
  const detailOpen = selectedRowId != null || calendarComposeOpen
  const { reply, target: replyTarget, attachment: pendingAttachment, critical: criticalFlags, mentions, faq: pendingFaqReply, error: replyError } =
    (selectedId == null ? undefined : drafts[selectedId]) ?? EMPTY_DRAFT

  const updateDraft = (update: Partial<ReplyDraft>) => {
    if (selectedId == null) return
    setDrafts((previous) => ({ ...previous, [selectedId]: { ...EMPTY_DRAFT, ...previous[selectedId], ...update } }))
  }
  const setReply = (value: string) => updateDraft({ reply: value })
  const setPendingAttachment = (attachment: File | null) => updateDraft({ attachment })
  const setCriticalFlags = (critical: CriticalComposeFlags) => updateDraft({ critical })

  const viewer = useMemo(() => getMessageViewer('admin'), [])
  const pins = useThreadPinGroups(selectedId, 'admin', adminFetch)
  const inboxCountsBase = useMemo(() => countThreadsByInboxTab(threads), [threads])
  const tabFilteredThreads = useMemo(() => {
    if (tab === 'archived') return threads
    return filterThreadsByInboxTab(threads, inboxTab)
  }, [threads, inboxTab, tab])
  const inboxList = useMessagingInboxList({
    inboxTab: tab === 'archived' ? 'all' : inboxTab,
    tabFilteredThreads,
    listSearch,
    listSort,
    listSortDir,
    role: 'admin',
    fetcher: adminFetch,
    enabled: tab !== 'archived',
  })
  const displayedThreads = inboxList.displayedThreads
  const inboxCounts = useMemo(
    () => ({ ...inboxCountsBase, ...inboxList.inboxCountsPatch }),
    [inboxCountsBase, inboxList.inboxCountsPatch],
  )
  const primaryAction = useMemo(
    () => getInboxPrimaryAction(inboxTab, 'admin', { archived: tab === 'archived' }),
    [inboxTab, tab],
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

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ status: tab === 'archived' ? 'archived' : 'open' })
    if (tab !== 'archived') params.set('scope', tab === 'active-mine' ? 'mine' : 'all')
    if (isFlatView) {
      params.set('sort', toApiThreadSort(listSort))
      params.set('sortDir', listSortDir)
    }
    return params.toString()
  }, [tab, isFlatView, listSort, listSortDir])
  const activeListQuery = useRef(listQuery)
  activeListQuery.current = listQuery

  const loadThreads = useCallback(async () => {
    if (listQuery !== activeListQuery.current) return
    const request = ++listRequest.current
    try {
      const next = await adminFetch<MessageThread[]>(`/api/admin/messages?${listQuery}`)
      if (request !== listRequest.current) return
      setThreads(next)
      setListError(null)
    } catch (err) {
      if (request === listRequest.current) setListError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      if (request === listRequest.current) setLoading(false)
    }
  }, [listQuery])
  const collaboration = useThreadCollaboration({
    role: 'admin',
    threadId: selectedId,
    fetcher: adminFetch,
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
    return () => { listRequest.current += 1 }
  }, [loadThreads])

  const closeDetail = () => {
    detailRequest.current += 1
    activeThreadRef.current = null
    inboxList.setActiveCalendarItem(null)
    inboxList.setActiveScheduleRow(null)
    setCalendarComposeOpen(false)
    setSelectedId(null)
    setSelectedRowId(null)
    setDetailError(null)
    setError(null)
    closeTakeoverPanels()
  }

  const changeScope = (scope: AdminMessagesTab) => {
    if (tab === scope) return
    listRequest.current += 1
    closeDetail()
    setListError(null)
    setLoading(true)
    setThreads([])
    setInboxTab(scope === 'archived' ? 'archived' : 'messages')
    setTab(scope)
  }

  const { invalidateReactions, applyReactionMutation } = useThreadReactionSync({
    role: 'admin',
    threadId: selectedId,
    activeThreadId: activeThreadRef,
    detailRequest,
    ready: !detailLoading && !detailError && canReply,
    fetcher: adminFetch,
    setMessages,
  })

  useMessageRealtime({
    role: 'admin',
    threadId: selectedId,
    onReactionsInvalidated: canReply ? invalidateReactions : undefined,
    onMessageCreated: (payload) => {
      const next = payload.data
      if (next && activeThreadRef.current != null && Number(payload.threadId) === activeThreadRef.current) {
        setMessages((previous) => previous.some((message) => Number(message.id) === Number(next.id)) ? previous : [...previous, next])
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

  const { messagesEndRef, followLatest } = useMessagingHistoryScroll({
    threadId: selectedId,
    visible: selectedId != null && !detailLoading && !detailError && !anyTakeoverPanelOpen,
    latestMessageId: messages.at(-1)?.id,
  })

  const openThread = async (rowId: number, scheduleItem?: ScheduleInboxRow) => {
    const resolved = scheduleItem
      ? { threadId: scheduleItem.discussion_thread_id ?? rowId, scheduleRow: scheduleItem }
      : inboxList.resolveThreadSelection(rowId)
    const threadId = Number(resolved.threadId)
    const { scheduleRow } = resolved
    if (threadId <= 0 && !scheduleRow) return
    if (scheduleItem) inboxList.setActiveScheduleRow(scheduleItem)

    const request = ++detailRequest.current
    activeThreadRef.current = threadId > 0 ? threadId : null
    setCalendarComposeOpen(false)
    setSelectedId(activeThreadRef.current)
    setSelectedRowId(Number(rowId))
    setDetailLoading(threadId > 0)
    setDetailError(null)
    setError(null)
    setMessages([])
    setFaqDraft(null)
    closeTakeoverPanels()
    if (threadId <= 0) return

    try {
      const data = await adminFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/admin/messages/${threadId}`)
      if (request !== detailRequest.current) return
      setThreadSubject(data.thread.subject ?? null)
      setThreadSubjectLocked(Boolean(data.thread.subject_locked))
      setThreadParticipants(data.thread.participants ?? [])
      setThreadInfoJson(data.thread.info_json ?? null)
      setLinkedThreadId(data.thread.linked_thread_id ?? null)
      setThreadFavorite(Boolean(data.thread.is_favorite ?? threads.find((thread) => Number(thread.id) === threadId)?.is_favorite))
      setMessages((pending) => {
        if (!pending.length) return data.messages
        const seen = new Set(data.messages.map(({ id }) => Number(id)))
        return [...data.messages, ...pending.filter(({ id }) => !seen.has(Number(id)))]
      })
      if (tab !== 'archived') {
        void markThreadRead('admin', threadId, adminFetch, data.messages.at(-1)?.id).then(() => {
          if (request === detailRequest.current) void loadThreads()
        })
      }
    } catch (err) {
      if (request === detailRequest.current) setDetailError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (initialThreadId === lastInitialThread.current) return
    lastInitialThread.current = initialThreadId
    if (initialThreadId != null) {
      void openThread(initialThreadId).finally(() => {
        if (lastInitialThread.current === initialThreadId) onInitialThreadOpened?.()
      })
    }
  })

  const quoteMessage = (message: MessageRow, saveToFaq = false) => {
    if (sending) return
    const body = replyTarget ? stripReplyQuote(reply, buildReplyQuote(replyTarget)) : reply
    const prefix = buildReplyQuote(message)
    updateDraft({
      target: message,
      reply: `${prefix}${body}`,
      faq: saveToFaq ? { question: message.body?.trim() || 'Question', prefix } : null,
      error: null,
    })
  }

  const showPinControls = tab !== 'archived'
  const pinHeaderProps = showPinControls
    ? {
        pinFilter: pins.pinFilter,
        onPinFilterChange: pins.togglePinFilter,
        importantFilterActive: pins.importantFilterActive,
        onImportantFilterChange: pins.toggleImportantFilter,
        pinControlsDisabled: pins.pinSelectionActive,
      }
    : {}
  const collaborationHeaderProps = {
    hasActionablePoll: collaboration.hasActionablePoll,
    hasActionableSignup: collaboration.hasActionableSignup,
    onPollIconClick: () => {
      setFaqPanelOpen(false)
      collaboration.openPollPanel({ scrollToLatest: true })
    },
    onSignupIconClick: () => {
      setFaqPanelOpen(false)
      collaboration.openSignupPanel({ scrollToLatest: true })
    },
    onCreatePoll: () => {
      setFaqPanelOpen(false)
      collaboration.openPollPanel({ mode: 'create-poll' })
    },
    onRespondPoll: () => {
      setFaqPanelOpen(false)
      collaboration.openPollPanel({ mode: 'pick-poll' })
    },
    onCreateSignup: () => {
      setFaqPanelOpen(false)
      collaboration.openSignupPanel({ mode: 'create-signup' })
    },
    onSignupNow: () => {
      setFaqPanelOpen(false)
      collaboration.openSignupPanel({ mode: 'pick-signup' })
    },
  }

  const sendReply = async (mentions: MessageMentionPayload[] = []) => {
    if (!selectedId || (!reply.trim() && !pendingAttachment) || !canReply || sending) return
    updateDraft({ error: null })
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
          send_critical_sms: criticalFlags.is_critical && criticalFlags.send_critical_sms,
        }),
      })
      const stillSelected = activeThreadRef.current === selectedId
      if (stillSelected) {
        followLatest()
        setMessages((prev) => prev.some((entry) => Number(entry.id) === Number(msg.id)) ? prev : [...prev, msg])
      }
      if (stillSelected && pendingFaqReply) {
        setFaqDraft({
          question: pendingFaqReply.question,
          answer: stripReplyQuote(replyText, pendingFaqReply.prefix),
        })
        collaboration.closePollPanel()
        collaboration.closeSignupPanel()
        setFaqPanelOpen(true)
      }
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[selectedId]
        return next
      })
      void loadThreads()
    } catch (err) {
      updateDraft({ error: err instanceof Error ? err.message : 'Failed to send message. Try again.' })
    } finally {
      setSending(false)
    }
  }

  const handlePrimaryCreate = () => {
    if (primaryAction.disabled || tab === 'archived') return
    setNewOpen(false)
    setCalendarComposeOpen(false)
    switch (primaryAction.mode) {
      case 'message':
        setComposeError(null)
        setNewOpen(true)
        break
      case 'class':
        setClassModalOpen(true)
        break
      case 'eventBoard':
        setEventBoardModalOpen(true)
        break
      case 'calendarItem':
        closeDetail()
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
    if (newRecipients.length === 0 || !newBody.trim() || creating) return
    setComposeError(null)
    setCreating(true)
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
      setComposeError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setCreating(false)
    }
  }

  const updateThreadSubject = async (update: { subject: string | null; subject_locked?: boolean }) => {
    if (!selectedId) return
    const updated = await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/subject`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    if (activeThreadRef.current === selectedId) {
      setThreadSubject(updated.subject ?? null)
      setThreadSubjectLocked(Boolean(updated.subject_locked))
    }
    void loadThreads()
  }

  const addRecipients = async (recipients: RecipientOption[]) => {
    if (!selectedId || recipients.length === 0) return
    const updated = await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/recipients`, {
      method: 'PATCH',
      body: JSON.stringify(recipientsToPayload(recipients)),
    })
    if (activeThreadRef.current === selectedId) setThreadParticipants(updated.participants ?? [])
  }

  const hideFromInbox = async () => {
    if (!selectedId) return
    await adminFetch(`/api/admin/messages/${selectedId}/inbox`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: true }),
    })
    if (activeThreadRef.current === selectedId) closeDetail()
    void loadThreads()
  }

  const restoreThreadGlobally = async () => {
    if (!selectedId) return
    await adminFetch<MessageThread>(`/api/admin/messages/${selectedId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: false }),
    })
    if (activeThreadRef.current === selectedId) closeDetail()
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
      if (activeThreadRef.current === selectedId) setThreadFavorite(favorite)
      void loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite')
    } finally {
      setFavoriteLoading(false)
    }
  }

  const scopeOptions = [
    ['active-mine', 'My inbox'],
    ['active-all', 'Facility inbox'],
    ['archived', 'Archived'],
  ] as const
  const scopeSwitch = (
    <div role="group" aria-label="Inbox scope" className="flex w-fit max-w-full gap-0.5 rounded-xl border border-slate-200 bg-white p-1">
      {scopeOptions.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={tab === id}
          onClick={() => changeScope(id)}
          className={`min-h-8 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold sm:px-3 ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`${messagingWorkspaceRoot} ${detailOpen ? messagingWorkspaceThreadOpen : ''} ${maximized ? 'messaging-workspace--maximized' : ''}`}>
      {!maximized && (
        <header className={`shrink-0 flex-col gap-3 ${detailOpen ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <MessageSquare className="size-5" aria-hidden />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Messages</h2>
            </div>
            <div className="flex items-center gap-2">
              {onMaximizedChange && <MessagingMaximizeToggle maximized={false} onToggle={() => onMaximizedChange(true)} />}
              {!primaryAction.hidden && (
                <button
                  type="button"
                  onClick={handlePrimaryCreate}
                  disabled={primaryAction.disabled}
                  title={primaryAction.disabledReason}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 sm:px-4"
                >
                  <Plus className="size-4" aria-hidden />
                  {primaryAction.mode === 'message' ? 'New message' : primaryAction.label}
                </button>
              )}
            </div>
          </div>
          {scopeSwitch}
        </header>
      )}

      {error && (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-red-100"><X className="size-4" aria-hidden /></button>
        </div>
      )}

      <NewMessageDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={() => void startThread()}
        sending={creating}
        canSend={newRecipients.length > 0 && Boolean(newBody.trim())}
        error={composeError}
      >
        <div>
          <RecipientPicker
            options={recipientOptions}
            selected={newRecipients}
            onChange={setNewRecipients}
            loading={recipientsLoading}
            placeholder="Search members, coaches, or admins"
            enrollmentGroups={enrollmentGroups}
            onAddEnrollmentGroup={addEnrollmentGroupToNew}
            groupsLoading={groupsLoading}
            groupActionLabel="Add all enrolled in"
          />
        </div>
        <label className="block text-sm font-medium">
          Subject <span className="font-normal text-slate-500">(optional)</span>
          <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="What’s this about?" className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Message
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Write your message…" rows={4} className="mt-1.5 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
      </NewMessageDialog>

      <div className={messagingWorkspaceShell}>
        <MessagingMobileShell
        preferenceRole="admin"
        preferenceFetcher={adminFetch}
        preferenceAccountKey={viewer.userId ? `admin:${viewer.userId}` : undefined}
        resourcePanel={maximized ? (visibility) => <MessagingResourceSidebar {...visibility} role="admin" fetcher={adminFetch} messages={messages} selectedThreadId={selectedId} loading={detailLoading} error={detailError} /> : undefined}
          selectedThreadId={selectedId}
          detailOpen={detailOpen}
          onBack={closeDetail}
          maximized={maximized}
          listPanel={
            <MessagingThreadListShell
              title={tab === 'archived' ? 'Archived conversations' : 'Conversations'}
              resultCount={!loading && !listError ? displayedThreads.length : undefined}
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
                  showCreate={maximized}
                  maximized={maximized}
                  onMaximizedChange={onMaximizedChange}
                />
              }
              search={listSearch}
              onSearchChange={setListSearch}
              headerExtra={
                <>
                  {maximized && scopeSwitch}
                  {tab !== 'archived' && <MessagingInboxTabs activeTab={inboxTab} onChange={setInboxTab} counts={inboxCounts} hiddenTabs={['archived']} />}
                </>
              }
            >
              {loading ? (
                <p role="status" className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading conversations…</p>
              ) : listError && !threads.length ? (
                <MessagingEmptyState compact title="Couldn’t load conversations" description={listError}
                  action={<button type="button" onClick={() => void loadThreads()} className="text-sm font-semibold text-blue-700 hover:underline">Try again</button>} />
              ) : displayedThreads.length === 0 ? (
                <MessagingEmptyState
                  compact
                  icon={listSearch.trim() ? Search : tab === 'archived' ? Archive : Inbox}
                  title={listSearch.trim() ? 'No results' : tab === 'archived' ? 'No archived conversations' : inboxTab === 'unread' ? 'You’re all caught up' : 'No conversations to show'}
                  description={listSearch.trim() ? 'Try a different name or keyword.' : inboxTab === 'pinned' ? 'Favorite a conversation to find it here.' : undefined}
                  action={listSearch.trim() ? <button type="button" onClick={() => setListSearch('')} className="text-sm font-semibold text-blue-700 hover:underline">Clear search</button> : undefined}
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayedThreads.map((t) => (
                    <MessagingThreadRow
                      key={t.id}
                      thread={t}
                      selected={selectedRowId === Number(t.id)}
                      onSelect={(id) => void openThread(id)}
                    />
                  ))}
                </div>
              )}
            </MessagingThreadListShell>
          }
          detailPanel={
            calendarComposeOpen ? (
              <CalendarItemComposePanel
                fetcher={adminFetch}
                role="admin"
                onCancel={() => setCalendarComposeOpen(false)}
                onCreated={(row, threadId) => {
                  setCalendarComposeOpen(false)
                  inboxList.refreshScheduleRows()
                  void loadThreads()
                  if (row) void openThread(scheduleRowVirtualId(row.row_key), row)
                  else if (threadId != null) void openThread(threadId)
                }}
              />
            ) : !selectedId && inboxList.activeScheduleRow ? (
              <MessagingThreadDetailShell header={<MessagingConversationHeader title={inboxList.activeScheduleRow.title} subtitle="Schedule details" />}>
                <ScheduleItemBanner item={inboxList.activeScheduleRow} />
              </MessagingThreadDetailShell>
            ) : !selectedId ? (
              <MessagingEmptyState
                title="Select a conversation"
                description={tab === 'archived' ? 'Choose an archived conversation to review its history.' : 'Choose a conversation from the list to read it and reply.'}
              />
            ) : detailLoading ? (
              <p role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading conversation…</p>
            ) : detailError ? (
              <MessagingEmptyState title="Couldn’t open conversation" description={detailError}
                action={<button type="button" onClick={() => { if (selectedRowId != null) void openThread(selectedRowId, inboxList.activeScheduleRow ?? undefined) }} className="text-sm font-semibold text-blue-700 hover:underline">Try again</button>} />
            ) : (
              <MessagingThreadDetailShell
                key={selectedId}
                header={
                  <MessagingConversationHeader
                    title={threadSubject?.trim() || threadListTitle(threads.find((thread) => Number(thread.id) === selectedId) ?? { id: selectedId })}
                    subtitle={threadParticipants.map((participant) => participant.name).filter(Boolean).join(' · ')}
                    badge={tab === 'archived' ? 'Archived' : threadSubjectLocked ? 'Locked' : undefined}
                  >
                    {anyTakeoverPanelOpen ? (
                      <button
                        type="button"
                        aria-label="Close panel"
                        onClick={closeTakeoverPanels}
                        className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                      >
                        <X className="size-5" aria-hidden />
                      </button>
                    ) : (
                      <ThreadHeaderMenu
                        subject={threadSubject}
                        subjectLocked={threadSubjectLocked}
                        canLock={canReply}
                        canEdit={canReply}
                        onUpdateSubject={updateThreadSubject}
                        isGloballyArchived={tab === 'archived'}
                        onRestoreThread={tab === 'archived' ? restoreThreadGlobally : undefined}
                        recipientOptions={recipientOptions}
                        existingParticipantKeys={existingParticipantKeys}
                        recipientsLoading={recipientsLoading}
                        onAddRecipients={canReply ? addRecipients : undefined}
                        enrollmentGroups={enrollmentGroups}
                        resolveEnrollmentGroup={resolveEnrollmentGroup}
                        groupsLoading={groupsLoading}
                        canHideFromInbox={canReply}
                        onHideFromInbox={canReply ? hideFromInbox : undefined}
                        isFavorite={threadFavorite}
                        onToggleFavorite={toggleFavorite}
                        favoriteLoading={favoriteLoading}
                        onOpenFaq={() => {
                          collaboration.closePollPanel()
                          collaboration.closeSignupPanel()
                          setFaqPanelOpen(true)
                        }}
                        {...pinHeaderProps}
                        {...collaborationHeaderProps}
                      />
                    )}
                  </MessagingConversationHeader>
                }
                footer={canReply && !anyTakeoverPanelOpen ? (
                  <>
                    {replyError && <p role="alert" className="mx-4 mt-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{replyError}</p>}
                    <MessageReplyComposer
                      reply={reply}
                      onReplyChange={setReply}
                      onSend={(mentions) => void sendReply(mentions)}
                      sending={sending}
                      placeholder="Write a reply…"
                      participants={threadParticipants}
                      viewer={viewer}
                      pendingAttachment={pendingAttachment}
                      onAttachmentPick={setPendingAttachment}
                      onClearAttachment={() => setPendingAttachment(null)}
                      mentions={mentions}
                      onMentionsChange={(value) => updateDraft({ mentions: value })}
                      auxiliaryActions={<CriticalMessageToggle value={criticalFlags} onChange={setCriticalFlags} disabled={sending} compact />}
                    />
                  </>
                ) : undefined}
              >
                {collaboration.pollPanelOpen && collaboration.panelMode ? (
                  <MessagingThreadPollsPanel
                    mode={collaboration.panelMode as 'list-poll' | 'create-poll' | 'pick-poll' | 'view-poll'}
                    polls={collaboration.polls}
                    activePoll={collaboration.activePoll}
                    role="admin"
                    threadId={selectedId}
                    fetcher={adminFetch}
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
                    role="admin"
                    threadId={selectedId}
                    fetcher={adminFetch}
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
                    role="admin"
                    threadId={selectedId}
                    fetcher={adminFetch}
                    canEdit={canReply}
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
                    {canReply ? (
                      <MessagingMessageThread
                        messages={messages}
                        viewer={viewer}
                        threadId={selectedId}
                        role="admin"
                        fetcher={adminFetch}
                        participants={threadParticipants}
                        messagesEndRef={messagesEndRef}
                        onReply={quoteMessage}
                        onReplyWithFaq={(message) => quoteMessage(message, true)}
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
                        onReactionsUpdated={applyReactionMutation}
                      />
                    ) : (
                      <div>
                        <ArchivedMessageLines messages={messages} participants={threadParticipants} viewer={viewer} />
                        <div ref={messagesEndRef} />
                      </div>
                    )}
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
        role="admin"
        fetcher={adminFetch}
        onCreated={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
      <EventBoardCreateModal
        open={eventBoardModalOpen}
        onClose={() => setEventBoardModalOpen(false)}
        fetcher={adminFetch}
        onCreated={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
      <FileUploadComposeModal
        open={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
        portal="admin"
        fetcher={adminFetch}
        threads={threads}
        onUploaded={(threadId) => {
          void loadThreads()
          void openThread(threadId)
        }}
      />
    </div>
  )
}

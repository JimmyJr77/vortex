import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, CircleAlert, Loader2, MessageSquare, Plus, Search, UsersRound, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import ArchivedMessageLines from '../messaging/ArchivedMessageLines'
import RecipientPicker from '../messaging/RecipientPicker'
import { recipientsToPayload } from '../messaging/recipientPayload'
import ThreadHeaderMenu from '../messaging/ThreadHeaderMenu'
import MessageReplyComposer from '../messaging/MessageReplyComposer'
import MessagingMessageThread from '../messaging/MessagingMessageThread'
import {
  defaultSortDir,
  type ThreadListSortDir,
  type ThreadListSortField,
} from '../messaging/messagingThreadSort'
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
import MessagingConversationHeader from '../messaging/MessagingConversationHeader'
import MessagingEmptyState from '../messaging/MessagingEmptyState'
import NewMessageDialog from '../messaging/NewMessageDialog'
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
  scheduleRowVirtualId,
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
import { useThreadReactionSync } from '../messaging/useThreadReactionSync'
import { useMessagingHistoryScroll } from '../messaging/useMessagingHistoryScroll'

type MemberPickerScope = 'my_classes' | 'all'

interface ReplyDraft {
  body: string
  target: MessageRow | null
  attachment: File | null
  mentions: MessageMentionPayload[]
  criticalFlags: CriticalComposeFlags
  faq: { question: string; prefix: string } | null
  error: string | null
}

const EMPTY_REPLY: ReplyDraft = {
  body: '',
  target: null,
  attachment: null,
  mentions: [],
  criticalFlags: { is_critical: false, requires_ack: false, send_critical_sms: false },
  faq: null,
  error: null,
}

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-vortex-red focus:outline-none focus:ring-1 focus:ring-vortex-red'
const TEXT_ACTION_CLASS = 'rounded-md px-2.5 py-1.5 text-sm font-semibold text-vortex-red hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vortex-red'

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
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [thread, setThread] = useState<MessageThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, ReplyDraft>>({})
  const [sendingReplies, setSendingReplies] = useState<number[]>([])
  const [startingThread, setStartingThread] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)
  const [groupAddError, setGroupAddError] = useState<string | null>(null)
  const [newRecipients, setNewRecipients] = useState<RecipientOption[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [recipientLoadError, setRecipientLoadError] = useState<string | null>(null)
  const [enrollmentGroups, setEnrollmentGroups] = useState<EnrollmentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [threadSearch, setThreadSearch] = useState('')
  const [listSort, setListSort] = useState<ThreadListSortField>('recent')
  const [listSortDir, setListSortDir] = useState<ThreadListSortDir>(() => defaultSortDir('recent'))
  const [inboxTab, setInboxTab] = useState<MessagingInboxTab>('messages')
  const [faqPanelOpen, setFaqPanelOpen] = useState(false)
  const [faqDraft, setFaqDraft] = useState<ThreadFaqDraft | null>(null)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [eventBoardModalOpen, setEventBoardModalOpen] = useState(false)
  const [fileModalOpen, setFileModalOpen] = useState(false)
  const [calendarComposeOpen, setCalendarComposeOpen] = useState(false)
  const recipientRequest = useRef(0)
  const listRequest = useRef(0)
  const inboxStatus = useRef<'open' | 'archived'>('open')
  const detailRequest = useRef(0)
  const activeThreadId = useRef<number | null>(null)
  const openedInitialThreadId = useRef<number | null>(null)
  const threadSubject = thread?.subject ?? null
  const threadSubjectLocked = Boolean(thread?.subject_locked)
  const threadParticipants = useMemo<ThreadParticipant[]>(() => thread?.participants ?? [], [thread?.participants])
  const linkedThreadId = thread?.linked_thread_id ?? null
  const threadArchived = thread?.status === 'archived'
  const replyDraft = (selectedId == null ? null : replyDrafts[selectedId]) ?? EMPTY_REPLY
  const sendingReply = selectedId != null && sendingReplies.includes(selectedId)
  const detailOpen = calendarComposeOpen || selectedRowId != null
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
    const request = ++recipientRequest.current
    setRecipientsLoading(true)
    setRecipientOptions([])
    setRecipientLoadError(null)
    try {
      const raw = await coachFetch<RecipientOption[]>(`/api/coach/messages/recipient-options?scope=${scope}`)
      if (request !== recipientRequest.current) return
      const list = Array.isArray(raw) ? raw : []
      setRecipientOptions(list)
      if (list.length === 0) {
        setRecipientLoadError('No recipients found. Try “All athletes” or check class assignments.')
      }
    } catch (err) {
      if (request !== recipientRequest.current) return
      setRecipientOptions([])
      setRecipientLoadError(err instanceof Error ? err.message : 'Failed to load recipients')
    } finally {
      if (request === recipientRequest.current) setRecipientsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecipientOptions(memberScope)
  }, [memberScope, loadRecipientOptions])

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

  const addEnrollmentGroupToNew = async (group: EnrollmentGroup) => {
    setGroupAddError(null)
    try {
      const added = await resolveEnrollmentGroup(group)
      setNewRecipients((prev) => mergeRecipientOptions(prev, added))
    } catch (err) {
      setGroupAddError(err instanceof Error ? err.message : 'Could not add the enrollment group')
    }
  }

  const loadThreads = useCallback(async () => {
    const request = ++listRequest.current
    const status = inboxStatus.current
    const currentRequest = () => request === listRequest.current && status === inboxStatus.current
    try {
      const rows = await coachFetch<MessageThread[]>(status === 'archived'
        ? '/api/coach/messages?status=archived'
        : '/api/coach/messages')
      if (!currentRequest()) return
      setThreads(rows)
      setListError(null)
    } catch (err) {
      if (currentRequest()) {
        setListError(err instanceof Error ? err.message : 'Failed to load messages')
      }
    } finally {
      if (currentRequest()) setLoading(false)
    }
  }, [])
  const collaboration = useThreadCollaboration({
    role: 'coach',
    threadId: selectedId,
    fetcher: coachFetch,
    onChanged: () => void loadThreads(),
  })
  const anyTakeoverPanelOpen = faqPanelOpen || collaboration.pollPanelOpen || collaboration.signupPanelOpen
  const { messagesEndRef, followLatest } = useMessagingHistoryScroll({
    threadId: selectedId,
    visible: thread != null && !detailLoading && !detailError && !anyTakeoverPanelOpen,
    latestMessageId: messages.at(-1)?.id,
  })

  const { closePollPanel, closeSignupPanel } = collaboration
  const closeTakeoverPanels = useCallback(() => {
    setFaqPanelOpen(false)
    closePollPanel()
    closeSignupPanel()
  }, [closePollPanel, closeSignupPanel])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  const { invalidateReactions, applyReactionMutation } = useThreadReactionSync({
    role: 'coach',
    threadId: selectedId,
    activeThreadId,
    detailRequest,
    ready: thread != null && !detailLoading && !detailError,
    fetcher: coachFetch,
    setMessages,
  })

  useMessageRealtime({
    role: 'coach',
    threadId: selectedId,
    onReactionsInvalidated: invalidateReactions,
    onMessageCreated: (payload) => {
      const next = payload.data
      if (Number(payload.threadId) === activeThreadId.current && next) {
        setMessages((current) => current.some((message) => message.id === next.id) ? current : [...current, next])
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

  const dismissThread = () => {
    detailRequest.current += 1
    activeThreadId.current = null
    setCalendarComposeOpen(false)
    setSelectedId(null)
    setSelectedRowId(null)
    setThread(null)
    setMessages([])
    setDetailLoading(false)
    setActionError(null)
    inboxList.setActiveCalendarItem(null)
    inboxList.setActiveScheduleRow(null)
    closeTakeoverPanels()
  }

  const changeInboxTab = (tab: MessagingInboxTab) => {
    const status = tab === 'archived' ? 'archived' : 'open'
    setInboxTab(tab)
    if (status === inboxStatus.current) return
    inboxStatus.current = status
    dismissThread()
    setListError(null)
    setLoading(true)
    void loadThreads()
  }

  const openThread = useCallback(async (rowId: number, scheduleRow?: ScheduleInboxRow) => {
    const resolvedId = Number(scheduleRow
      ? scheduleRow.discussion_thread_id
      : inboxList.resolveThreadSelection(rowId).threadId)
    const threadId = resolvedId > 0 ? resolvedId : null
    if (scheduleRow) inboxList.setActiveScheduleRow(scheduleRow)
    const request = ++detailRequest.current
    activeThreadId.current = threadId
    setCalendarComposeOpen(false)
    setSelectedRowId(Number(rowId))
    setSelectedId(threadId)
    setDetailError(null)
    setActionError(null)
    setFavoriteLoading(false)
    setThread(null)
    setMessages([])
    closeTakeoverPanels()
    setFaqDraft(null)
    inboxList.setActiveCalendarItem(null)
    if (threadId == null) {
      setDetailLoading(false)
      return
    }

    setDetailLoading(true)
    try {
      const data = await coachFetch<{ thread: MessageThread; messages: MessageRow[] }>(`/api/coach/messages/${threadId}`)
      if (request !== detailRequest.current) return
      setThread({
        ...data.thread,
        participants: Array.isArray(data.thread.participants) ? data.thread.participants : [],
        is_favorite: data.thread.is_favorite ?? threads.find((row) => Number(row.id) === threadId)?.is_favorite,
      })
      setMessages((current) => {
        const loadedIds = new Set(data.messages.map((message) => message.id))
        return [...data.messages, ...current.filter((message) => !loadedIds.has(message.id))]
      })
      if (data.thread.status !== 'archived') {
        void markThreadRead('coach', threadId, coachFetch, data.messages.at(-1)?.id).then(loadThreads)
      }
    } catch (err) {
      if (request === detailRequest.current) {
        setDetailError(err instanceof Error ? err.message : 'Failed to load thread')
      }
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }, [closeTakeoverPanels, inboxList, loadThreads, threads])

  useEffect(() => {
    if (initialThreadId == null) {
      openedInitialThreadId.current = null
      return
    }
    if (openedInitialThreadId.current === initialThreadId) return
    openedInitialThreadId.current = initialThreadId
    void openThread(initialThreadId)
    onInitialThreadOpened?.()
  }, [initialThreadId, onInitialThreadOpened, openThread])

  const updateDraft = (threadId: number, changes: Partial<ReplyDraft>) => {
    setReplyDrafts((current) => ({
      ...current,
      [threadId]: { ...(current[threadId] ?? EMPTY_REPLY), ...changes },
    }))
  }

  const replyToMessage = (message: MessageRow, createFaq = false) => {
    if (selectedId == null || sendingReply) return
    const prefix = buildReplyQuote(message)
    const body = replyDraft.target
      ? stripReplyQuote(replyDraft.body, buildReplyQuote(replyDraft.target))
      : replyDraft.body
    updateDraft(selectedId, {
      target: message,
      body: `${prefix}${body}`,
      faq: createFaq ? { question: message.body?.trim() || 'Question', prefix } : null,
      error: null,
    })
  }

  const sendReply = async (mentions: MessageMentionPayload[] = []) => {
    if (selectedId == null || threadArchived || sendingReply || (!replyDraft.body.trim() && !replyDraft.attachment)) return
    const threadId = selectedId
    const { attachment, target, criticalFlags, faq } = replyDraft
    setSendingReplies((current) => [...current, threadId])
    updateDraft(threadId, { error: null })
    try {
      let attachmentPayload: Partial<UploadedAttachment> = {}
      if (attachment) {
        attachmentPayload = await uploadMessageAttachment(attachment, 'coach', coachFetch)
      }
      const replyText = replyDraft.body.trim()
      const { body, mentions: resolvedMentions } = prepareMessageBodyForSend(
        replyText,
        mentions,
        target,
        threadParticipants,
      )
      const msg = await coachFetch<MessageRow>(`/api/coach/messages/${threadId}`, {
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
      if (activeThreadId.current === threadId) {
        followLatest()
        setMessages((current) => current.some((message) => message.id === msg.id) ? current : [...current, msg])
        if (faq) {
          setFaqDraft({
            question: faq.question,
            answer: stripReplyQuote(replyText, faq.prefix),
          })
          setFaqPanelOpen(true)
        }
      }
      setReplyDrafts((current) => {
        const next = { ...current }
        delete next[threadId]
        return next
      })
      void loadThreads()
    } catch (err) {
      updateDraft(threadId, { error: err instanceof Error ? err.message : 'Failed to send message' })
    } finally {
      setSendingReplies((current) => current.filter((id) => id !== threadId))
    }
  }

  const updateThreadSubject = async (update: { subject: string | null; subject_locked?: boolean }) => {
    if (!selectedId) return
    const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/subject`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    if (activeThreadId.current === selectedId) {
      setThread((current) => current && {
        ...current,
        subject: updated.subject ?? null,
        subject_locked: Boolean(updated.subject_locked),
      })
    }
    void loadThreads()
  }

  const addRecipients = async (recipients: RecipientOption[]) => {
    if (!selectedId || recipients.length === 0) return
    const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/recipients`, {
      method: 'PATCH',
      body: JSON.stringify(recipientsToPayload(recipients)),
    })
    if (activeThreadId.current === selectedId) {
      setThread((current) => current && {
        ...current,
        participants: Array.isArray(updated.participants) ? updated.participants : [],
      })
    }
  }

  const hideFromInbox = async () => {
    if (!selectedId) return
    await coachFetch(`/api/coach/messages/${selectedId}/inbox`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: true }),
    })
    if (activeThreadId.current === selectedId) dismissThread()
    void loadThreads()
  }

  const toggleFavorite = async (favorite: boolean) => {
    if (!selectedId) return
    setFavoriteLoading(true)
    setActionError(null)
    try {
      await coachFetch(`/api/coach/messages/${selectedId}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite }),
      })
      if (activeThreadId.current === selectedId) {
        setThread((current) => current && { ...current, is_favorite: favorite })
      }
      void loadThreads()
    } catch (err) {
      if (activeThreadId.current === selectedId) {
        setActionError(err instanceof Error ? err.message : 'Failed to update favorite')
      }
    } finally {
      if (activeThreadId.current === selectedId) setFavoriteLoading(false)
    }
  }

  const openToCoachingCircle = async () => {
    if (!selectedId) return
    setActionError(null)
    try {
      const updated = await coachFetch<MessageThread>(`/api/coach/messages/${selectedId}/open-circle`, { method: 'PATCH' })
      if (activeThreadId.current === selectedId) {
        setThread((current) => current && { ...current, thread_scope: updated.thread_scope ?? 'coaching_circle' })
      }
      void loadThreads()
    } catch (err) {
      if (activeThreadId.current === selectedId) {
        setActionError(err instanceof Error ? err.message : 'Failed to share the conversation')
      }
    }
  }

  const handlePrimaryCreate = () => {
    if (primaryAction.disabled || primaryAction.hidden) return
    setNewOpen(false)
    setCalendarComposeOpen(false)
    switch (primaryAction.mode) {
      case 'message':
        setNewError(null)
        setGroupAddError(null)
        if (recipientLoadError) void loadRecipientOptions(memberScope)
        setNewOpen(true)
        break
      case 'class':
        setClassModalOpen(true)
        break
      case 'eventBoard':
        setEventBoardModalOpen(true)
        break
      case 'calendarItem':
        dismissThread()
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
    if (startingThread || newRecipients.length === 0 || !newBody.trim()) return
    setStartingThread(true)
    setNewError(null)
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
      setInboxTab('messages')
      setThreadSearch('')
      void openThread(data.thread.id)
    } catch (err) {
      setNewError(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setStartingThread(false)
    }
  }

  const clearSearchAction = (
    <button type="button" onClick={() => setThreadSearch('')} className={TEXT_ACTION_CLASS}>
      Clear search
    </button>
  )
  const retryListAction = (
    <button type="button" onClick={() => void loadThreads()} className={TEXT_ACTION_CLASS}>
      Retry
    </button>
  )
  const retryDetailAction = selectedRowId != null && (
    <button
      type="button"
      onClick={() => void openThread(selectedRowId, inboxList.activeScheduleRow ?? undefined)}
      className={TEXT_ACTION_CLASS}
    >
      Retry
    </button>
  )
  const participantNames = threadParticipants
    .filter((participant) => participantKey(participant) !== (viewer.userId ? `user:${viewer.userId}` : null))
    .map((participant) => participant.name?.trim())
    .filter(Boolean)
  const participantSummary = participantNames.length > 2
    ? `${participantNames.slice(0, 2).join(', ')} +${participantNames.length - 2}`
    : participantNames.join(', ')
  const conversationTitle = thread
    ? threadListTitle(thread, participantNames.length === 1 ? participantSummary : 'Conversation')
    : 'Conversation'

  return (
    <div
      className={`${messagingWorkspaceRoot} ${detailOpen ? messagingWorkspaceThreadOpen : ''} ${maximized ? 'messaging-workspace--maximized' : ''}`}
    >
      {!maximized && (
        <header className={`shrink-0 items-center justify-between gap-3 ${detailOpen ? 'hidden lg:flex' : 'flex'}`}>
          <h2 className="min-w-0 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">Messages</h2>
          <div className="flex shrink-0 items-center gap-2">
            {onMaximizedChange && (
              <MessagingMaximizeToggle maximized={false} onToggle={() => onMaximizedChange(true)} />
            )}
            {!primaryAction.hidden && !primaryAction.disabled && (
              <button
                type="button"
                onClick={handlePrimaryCreate}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-vortex-red px-3.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vortex-red"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {primaryAction.mode === 'message' ? 'New message' : primaryAction.label}
              </button>
            )}
          </div>
        </header>
      )}

      <NewMessageDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={() => void startThread()}
        sending={startingThread}
        canSend={newRecipients.length > 0 && Boolean(newBody.trim())}
        error={newError}
      >
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-slate-800">Athlete access</legend>
          <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
            {([{ id: 'my_classes', label: 'My classes' }, { id: 'all', label: 'All athletes' }] as const).map((scope) => (
              <button
                key={scope.id}
                type="button"
                aria-pressed={memberScope === scope.id}
                onClick={() => setMemberScope(scope.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-vortex-red ${memberScope === scope.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {scope.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            {memberScope === 'my_classes'
              ? 'Athletes in your classes, plus coaches and admins.'
              : 'Active athletes at your facility, plus coaches and admins.'}
          </p>
        </fieldset>
        {(recipientLoadError || groupAddError) && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {groupAddError || recipientLoadError}
          </p>
        )}
        <RecipientPicker
          options={recipientOptions}
          selected={newRecipients}
          onChange={setNewRecipients}
          loading={recipientsLoading}
          placeholder="Find athletes, coaches, or admins"
          enrollmentGroups={enrollmentGroups}
          onAddEnrollmentGroup={addEnrollmentGroupToNew}
          groupsLoading={groupsLoading}
          groupActionLabel="Add an enrollment group"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">
            Subject <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className={CONTROL_CLASS} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">Message</span>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Write your message…"
            rows={4}
            className={`${CONTROL_CLASS} min-h-24 resize-y`}
          />
        </label>
      </NewMessageDialog>

      <div className={messagingWorkspaceShell}>
      <MessagingMobileShell
        selectedThreadId={selectedId}
        detailOpen={detailOpen}
        onBack={dismissThread}
        maximized={maximized}
        listPanel={
          <MessagingThreadListShell
            title={inboxTab === 'archived' ? 'Archived conversations' : 'Conversations'}
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
                showCreate={maximized}
              />
            }
            search={threadSearch}
            onSearchChange={setThreadSearch}
            searchPlaceholder="Search conversations…"
            headerExtra={
              <MessagingInboxTabs activeTab={inboxTab} onChange={changeInboxTab} counts={inboxCounts} />
            }
          >
            {listError && filteredThreads.length > 0 && (
              <div role="status" className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>Couldn’t refresh conversations.</span>
                {retryListAction}
              </div>
            )}
            {loading ? (
              <div role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading conversations…
              </div>
            ) : listError && filteredThreads.length === 0 ? (
              <MessagingEmptyState compact icon={CircleAlert} title="Couldn’t load conversations" description={listError} action={retryListAction} />
            ) : filteredThreads.length === 0 ? (
              threadSearch.trim() ? (
                <MessagingEmptyState compact icon={Search} title="No search results" description="Try a different name or keyword." action={clearSearchAction} />
              ) : (
                <MessagingEmptyState
                  compact
                  icon={inboxTab === 'archived' ? Archive : MessageSquare}
                  title={inboxTab === 'unread' ? 'You’re all caught up' : inboxTab === 'archived' ? 'No archived conversations' : 'Nothing here yet'}
                  description={inboxTab === 'unread' ? 'New conversations will appear here when you have unread messages.' : undefined}
                />
              )
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredThreads.map((t) => (
                  <MessagingThreadRow
                    key={t.id}
                    thread={t}
                    selected={selectedRowId === Number(t.id)}
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
            <MessagingEmptyState icon={MessageSquare} title="Choose a conversation" description="Select a conversation to read messages and reply." />
          ) : detailLoading ? (
            <div role="status" className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading conversation…
            </div>
          ) : detailError || !thread ? (
            <MessagingEmptyState icon={CircleAlert} title="Couldn’t open conversation" description={detailError ?? undefined} action={retryDetailAction} />
          ) : (
            <MessagingThreadDetailShell
              header={
                <>
                  <MessagingConversationHeader
                    title={conversationTitle}
                    subtitle={participantSummary === conversationTitle ? undefined : participantSummary || undefined}
                    badge={threadArchived ? 'Archived' : threadSubjectLocked ? 'Subject locked' : undefined}
                  >
                    {!threadArchived && thread.thread_scope === 'assigned_coach' && (
                      <button
                        type="button"
                        onClick={() => void openToCoachingCircle()}
                        aria-label="Share with coaching circle"
                        title="Share with coaching circle"
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-vortex-red hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vortex-red"
                      >
                        <UsersRound className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden xl:inline">Share</span>
                      </button>
                    )}
                    {!threadArchived && (anyTakeoverPanelOpen ? (
                      <button
                        type="button"
                        aria-label="Back to conversation"
                        title="Back to conversation"
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
                        isFavorite={Boolean(thread.is_favorite)}
                        onToggleFavorite={toggleFavorite}
                        favoriteLoading={favoriteLoading}
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
                    ))}
                  </MessagingConversationHeader>
                  {actionError && <div role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">{actionError}</div>}
                </>
              }
              footer={
                threadArchived || anyTakeoverPanelOpen ? undefined : (
                <>
                  {replyDraft.error && <div role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">{replyDraft.error}</div>}
                  <MessageReplyComposer
                    key={selectedId}
                    reply={replyDraft.body}
                    onReplyChange={(body) => updateDraft(selectedId, { body })}
                    mentions={replyDraft.mentions}
                    onMentionsChange={(mentions) => updateDraft(selectedId, { mentions })}
                    onSend={(mentions) => void sendReply(mentions)}
                    sending={sendingReply}
                    placeholder="Write a reply…"
                    participants={threadParticipants}
                    viewer={viewer}
                    pendingAttachment={replyDraft.attachment}
                    onAttachmentPick={(attachment) => updateDraft(selectedId, { attachment })}
                    onClearAttachment={() => updateDraft(selectedId, { attachment: null })}
                    auxiliaryActions={
                      <CriticalMessageToggle
                        compact
                        value={replyDraft.criticalFlags}
                        onChange={(criticalFlags) => updateDraft(selectedId, { criticalFlags })}
                        disabled={sendingReply}
                      />
                    }
                  />
                </>
                )
              }
            >
              {threadArchived ? (
                <>
                  <ArchivedMessageLines messages={messages} />
                  <div ref={messagesEndRef} />
                </>
              ) : collaboration.pollPanelOpen && collaboration.panelMode ? (
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
                      <MessagingInfoCard infoJson={thread.info_json ?? null} />
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
                    onReply={(message) => replyToMessage(message)}
                    onReplyWithFaq={(message) => replyToMessage(message, true)}
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

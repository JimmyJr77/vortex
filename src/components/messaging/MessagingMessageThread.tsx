import { Pin } from 'lucide-react'
import type { RefObject } from 'react'
import MessageBubble from './MessageBubble'
import MessagingEmptyState from './MessagingEmptyState'
import { formatMessageDayLabel, isFirstMessageOfDay } from './messageFormatting'
import type { MessageViewer } from './messageBubbleStyle'
import type { MessageDisplayGroup, MessageReactionGroup, MessageRow, MessagingRole, ThreadParticipant } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

function isImportantMessage(message: MessageRow): boolean {
  return (
    Boolean(message.is_critical)
    || message.sender_kind === 'coach'
    || message.sender_kind === 'admin'
  )
}

interface MessagingMessageThreadProps {
  messages: MessageRow[]
  viewer: MessageViewer
  threadId: number
  role: MessagingRole
  fetcher: Fetcher
  participants?: ThreadParticipant[]
  messagesEndRef?: RefObject<HTMLDivElement | null>
  onReply?: (message: MessageRow) => void
  onReplyWithFaq?: (message: MessageRow) => void
  onPinComment?: (message: MessageRow) => void
  canUnpinMessage?: (message: MessageRow) => boolean
  onUnpin?: (message: MessageRow) => void
  pinSelectionActive?: boolean
  pinSelectedIds?: Set<number>
  onPinSelectionToggle?: (message: MessageRow) => void
  displayGroups?: MessageDisplayGroup[]
  pinFilterActive?: boolean
  importantFilterActive?: boolean
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  className?: string
}

function renderBubble(
  m: MessageRow,
  props: Omit<MessagingMessageThreadProps, 'messages' | 'displayGroups' | 'pinFilterActive' | 'importantFilterActive' | 'className' | 'messagesEndRef'>,
) {
  const {
    viewer,
    threadId,
    role,
    fetcher,
    participants,
    onReply,
    onReplyWithFaq,
    onPinComment,
    canUnpinMessage,
    onUnpin,
    pinSelectionActive,
    pinSelectedIds,
    onPinSelectionToggle,
    onReactionsUpdated,
  } = props

  return (
    <MessageBubble
      message={m}
      viewer={viewer}
      threadId={threadId}
      role={role}
      fetcher={fetcher}
      participants={participants}
      onReply={onReply}
      onReplyWithFaq={onReplyWithFaq}
      onPinComment={onPinComment}
      canUnpin={canUnpinMessage?.(m) ?? false}
      onUnpin={onUnpin}
      pinSelectionActive={pinSelectionActive}
      pinSelected={pinSelectedIds?.has(m.id) ?? false}
      onPinSelectionToggle={onPinSelectionToggle}
      onReactionsUpdated={onReactionsUpdated}
    />
  )
}

export default function MessagingMessageThread({
  messages,
  viewer,
  threadId,
  role,
  fetcher,
  participants = [],
  messagesEndRef,
  onReply,
  onReplyWithFaq,
  onPinComment,
  canUnpinMessage,
  onUnpin,
  pinSelectionActive = false,
  pinSelectedIds,
  onPinSelectionToggle,
  displayGroups,
  pinFilterActive = false,
  importantFilterActive = false,
  onReactionsUpdated,
  className = 'px-4 py-5 sm:px-6',
}: MessagingMessageThreadProps) {
  const bubbleProps = {
    viewer,
    threadId,
    role,
    fetcher,
    participants,
    onReply,
    onReplyWithFaq,
    onPinComment,
    canUnpinMessage,
    onUnpin,
    pinSelectionActive,
    pinSelectedIds,
    onPinSelectionToggle,
    onReactionsUpdated,
  }

  const visibleMessages = importantFilterActive ? messages.filter(isImportantMessage) : messages
  let groups = visibleMessages.length > 0 ? [{ key: 'conversation', messages: visibleMessages }] : []
  if (pinFilterActive) {
    const messageMap = new Map(messages.map((message) => [Number(message.id), message]))
    groups = (displayGroups ?? []).flatMap((group, index) => {
      const pinnedMessages = group.messageIds
        .map((id) => messageMap.get(Number(id)))
        .filter((message): message is MessageRow => message != null)
      return pinnedMessages.length ? [{ key: `pin-group-${group.groupId ?? index}`, messages: pinnedMessages }] : []
    })
  }

  if (groups.length === 0) {
    const emptyCopy = pinFilterActive
      ? 'No pinned messages in this view'
      : importantFilterActive ? 'No staff or critical messages in this thread' : 'No messages yet'
    return (
      <div className={className} role="status">
        <MessagingEmptyState title={emptyCopy} icon={pinFilterActive ? Pin : undefined} compact />
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className={className} key={threadId} role="log" aria-label="Conversation history">
      <div className="mx-auto max-w-5xl space-y-5 divide-y divide-slate-200">
        {groups.map((group, groupIndex) => (
          <ol key={group.key} className={`space-y-4 ${groupIndex > 0 ? 'pt-5' : ''}`}>
            {group.messages.map((message, index) => (
              <li key={message.id}>
                {!pinFilterActive && isFirstMessageOfDay(group.messages, index) && (
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                    <time dateTime={message.created_at} className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                      {formatMessageDayLabel(message.created_at)}
                    </time>
                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  </div>
                )}
                {renderBubble(message, bubbleProps)}
              </li>
            ))}
          </ol>
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  )
}

import type { RefObject } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDayLabel, isFirstMessageOfDay } from './messageFormatting'
import type { MessageReactionGroup } from './MessageReactionBar'
import type { MessageViewer } from './messageBubbleStyle'
import type { MessageChecklist, MessageDisplayGroup, MessagePoll, MessageRow, MessagingRole, ThreadParticipant } from './types'

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
  showSenderName?: boolean
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
  onOpenPoll?: (poll: MessagePoll) => void
  onOpenSignup?: (signup: MessageChecklist) => void
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
    showSenderName,
    onReply,
    onReplyWithFaq,
    onPinComment,
    canUnpinMessage,
    onUnpin,
    pinSelectionActive,
    pinSelectedIds,
    onPinSelectionToggle,
    onReactionsUpdated,
    onOpenPoll,
    onOpenSignup,
  } = props

  return (
    <MessageBubble
      message={m}
      viewer={viewer}
      showSenderName={showSenderName}
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
      onOpenPoll={onOpenPoll}
      onOpenSignup={onOpenSignup}
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
  showSenderName = true,
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
  onOpenPoll,
  onOpenSignup,
  className = 'p-4 space-y-3',
}: MessagingMessageThreadProps) {
  const bubbleProps = {
    viewer,
    threadId,
    role,
    fetcher,
    participants,
    showSenderName,
    onReply,
    onReplyWithFaq,
    onPinComment,
    canUnpinMessage,
    onUnpin,
    pinSelectionActive,
    pinSelectedIds,
    onPinSelectionToggle,
    onReactionsUpdated,
    onOpenPoll,
    onOpenSignup,
  }

  if (pinFilterActive) {
    if (!displayGroups || displayGroups.length === 0) {
      return (
        <div className={`${className} text-center text-sm text-gray-500 py-8`}>
          No pinned messages in this view.
        </div>
      )
    }

    const messageMap = new Map(messages.map((m) => [Number(m.id), m]))
    const pinnedMessages = displayGroups.flatMap((group) =>
      group.messageIds
        .map((messageId) => messageMap.get(Number(messageId)))
        .filter((message): message is MessageRow => message != null),
    )
    if (pinnedMessages.length === 0) {
      return (
        <div className={`${className} text-center text-sm text-gray-500 py-8`}>
          No pinned messages in this view.
        </div>
      )
    }
    return (
      <div className={className}>
        {displayGroups.map((group, groupIndex) => (
          <div key={group.groupId ?? `super-${groupIndex}`} className="space-y-3">
            {groupIndex > 0 && <div className="border-t border-gray-200 pt-3" />}
            {group.messageIds.map((messageId) => {
              const message = messageMap.get(Number(messageId))
              if (!message) return null
              return (
                <div key={message.id}>
                  {renderBubble(message, bubbleProps)}
                </div>
              )
            })}
          </div>
        ))}
        {messagesEndRef ? <div ref={messagesEndRef} /> : null}
      </div>
    )
  }

  if (importantFilterActive) {
    const filtered = messages.filter(isImportantMessage)
    if (filtered.length === 0) {
      return (
        <div className={`${className} text-center text-sm text-gray-500 py-8`}>
          No staff or critical messages in this thread.
        </div>
      )
    }
    return (
      <div className={className}>
        {filtered.map((m, index) => (
          <div key={m.id}>
            {isFirstMessageOfDay(filtered, index) && (
              <div className="text-center text-[11px] font-medium text-gray-400 py-2">
                {formatMessageDayLabel(m.created_at)}
              </div>
            )}
            {renderBubble(m, bubbleProps)}
          </div>
        ))}
        {messagesEndRef ? <div ref={messagesEndRef} /> : null}
      </div>
    )
  }

  return (
    <div className={className}>
      {messages.map((m, index) => (
        <div key={m.id}>
          {isFirstMessageOfDay(messages, index) && (
            <div className="text-center text-[11px] font-medium text-gray-400 py-2">
              {formatMessageDayLabel(m.created_at)}
            </div>
          )}
          {renderBubble(m, bubbleProps)}
        </div>
      ))}
      {messagesEndRef ? <div ref={messagesEndRef} /> : null}
    </div>
  )
}

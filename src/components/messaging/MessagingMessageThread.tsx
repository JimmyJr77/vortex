import type { RefObject } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDayLabel, isFirstMessageOfDay } from './messageFormatting'
import type { MessageReactionGroup } from './MessageReactionBar'
import type { MessageViewer } from './messageBubbleStyle'
import type { MessageDisplayGroup, MessageRow, MessagingRole, ThreadParticipant } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

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
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  className?: string
}

function renderBubble(
  m: MessageRow,
  props: Omit<MessagingMessageThreadProps, 'messages' | 'displayGroups' | 'pinFilterActive' | 'className' | 'messagesEndRef'>,
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
  onReactionsUpdated,
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
  }

  if (pinFilterActive && displayGroups) {
    if (displayGroups.length === 0) {
      return (
        <div className={`${className} text-center text-sm text-gray-500 py-8`}>
          No pinned messages in this view.
        </div>
      )
    }

    const messageMap = new Map(messages.map((m) => [m.id, m]))
    return (
      <div className={className}>
        {displayGroups.map((group, groupIndex) => (
          <div key={group.groupId ?? `super-${groupIndex}`} className="space-y-3">
            {groupIndex > 0 && <div className="border-t border-gray-200 pt-3" />}
            {group.messageIds.map((messageId) => {
              const message = messageMap.get(messageId)
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

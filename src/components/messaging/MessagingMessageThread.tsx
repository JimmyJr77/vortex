import type { RefObject } from 'react'
import MessageBubble from './MessageBubble'
import { formatMessageDayLabel, isFirstMessageOfDay } from './messageFormatting'
import type { MessageReactionGroup } from './MessageReactionBar'
import type { MessageViewer } from './messageBubbleStyle'
import type { MessageRow, MessagingRole, ThreadParticipant } from './types'

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
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  className?: string
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
  onReactionsUpdated,
  className = 'p-4 space-y-3',
}: MessagingMessageThreadProps) {
  return (
    <div className={className}>
      {messages.map((m, index) => (
        <div key={m.id}>
          {isFirstMessageOfDay(messages, index) && (
            <div className="text-center text-[11px] font-medium text-gray-400 py-2">
              {formatMessageDayLabel(m.created_at)}
            </div>
          )}
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
            onReactionsUpdated={onReactionsUpdated}
          />
        </div>
      ))}
      {messagesEndRef ? <div ref={messagesEndRef} /> : null}
    </div>
  )
}

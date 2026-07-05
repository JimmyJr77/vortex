import type { MessageRow } from './types'
import { messageBubbleClassName, senderLabel, type MessageViewer } from './messageBubbleStyle'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'

interface MessageBubbleProps {
  message: MessageRow
  viewer: MessageViewer
  showSenderName?: boolean
}

export default function MessageBubble({ message, viewer, showSenderName = true }: MessageBubbleProps) {
  const label = showSenderName ? senderLabel(message, viewer) : null
  return (
    <div className={messageBubbleClassName(message, viewer)}>
      {label && <div className="text-[10px] opacity-70 mb-0.5">{label}</div>}
      {message.body && <div>{message.body}</div>}
      {message.attachment_url && (
        <MessageAttachmentDisplay
          url={message.attachment_url}
          name={message.attachment_name}
          mime={message.attachment_mime}
        />
      )}
      <div className="text-[10px] opacity-60 mt-1">{new Date(message.created_at).toLocaleString()}</div>
    </div>
  )
}

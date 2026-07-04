import type { MessageRow } from './types'
import { messageBubbleClassName, senderLabel, type MessageViewer } from './messageBubbleStyle'

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
      <div>{message.body}</div>
      <div className="text-[10px] opacity-60 mt-1">{new Date(message.created_at).toLocaleString()}</div>
    </div>
  )
}

import type { MessageRow } from './types'
import { messageBubbleClassName, senderLabel, type MessageViewer } from './messageBubbleStyle'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'
import MessagingFileChip from './MessagingFileChip'
import MessageReactionBar, { type MessageReactionGroup } from './MessageReactionBar'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface MessageBubbleProps {
  message: MessageRow
  viewer: MessageViewer
  showSenderName?: boolean
  threadId?: number
  role?: MessagingRole
  fetcher?: Fetcher
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  reactionsDisabled?: boolean
}

export default function MessageBubble({
  message,
  viewer,
  showSenderName = true,
  threadId,
  role,
  fetcher,
  onReactionsUpdated,
  reactionsDisabled = false,
}: MessageBubbleProps) {
  const label = showSenderName ? senderLabel(message, viewer) : null
  const timestamp = new Date(message.created_at).toLocaleString()
  const isDeleted = Boolean(message.deleted_at)
  const isEdited = Boolean(message.edited_at) && !isDeleted
  const files = message.files ?? []

  return (
    <div className={`${messageBubbleClassName(message, viewer)} flex flex-col`}>
      {(message.is_critical || isDeleted || isEdited) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {message.is_critical && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Critical
            </span>
          )}
          {message.requires_ack && message.is_critical && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
              Ack required
            </span>
          )}
          {isDeleted && (
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              Deleted
            </span>
          )}
          {isEdited && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Edited
            </span>
          )}
        </div>
      )}
      <div className="text-left">
        {isDeleted ? (
          <div className="italic text-gray-500 text-sm">This message was deleted.</div>
        ) : (
          message.body && <div className="whitespace-pre-wrap">{message.body}</div>
        )}
        {!isDeleted && message.attachment_url && (
          <MessageAttachmentDisplay
            url={message.attachment_url}
            name={message.attachment_name}
            mime={message.attachment_mime}
          />
        )}
        {!isDeleted && files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <MessagingFileChip key={file.id ?? `${file.url}-${index}`} file={file} compact />
            ))}
          </div>
        )}
        {!isDeleted && threadId != null && role && fetcher && (
          <MessageReactionBar
            role={role}
            threadId={threadId}
            messageId={message.id}
            fetcher={fetcher}
            reactions={message.reactions}
            disabled={reactionsDisabled}
            onUpdated={(reactions) => onReactionsUpdated?.(message.id, reactions)}
          />
        )}
      </div>
      <div className="mt-1.5 text-[10px] text-right">
        {label && <div className="opacity-70">{label}</div>}
        <div className="opacity-60">
          {timestamp}
          {isEdited && !isDeleted && message.edited_at && (
            <span className="ml-1">· edited {new Date(message.edited_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}

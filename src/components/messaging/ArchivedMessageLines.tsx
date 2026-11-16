import type { MessageRow, ThreadParticipant } from './types'
import type { MessageViewer } from './messageBubbleStyle'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'
import MessageMentionBody from './MessageMentionBody'
import MessagingEmptyState from './MessagingEmptyState'
import { formatMessageSenderDisplayName } from './messageFormatting'

function senderPortalLabel(portal?: string) {
  if (portal === 'admin') return 'Admin portal'
  if (portal === 'coach') return 'Coach portal'
  if (portal === 'member') return 'Member portal'
  return 'Unknown portal'
}

export default function ArchivedMessageLines({
  messages, participants, viewer = { portal: 'admin' },
}: {
  messages: MessageRow[]
  participants?: ThreadParticipant[]
  viewer?: MessageViewer
}) {
  if (!messages.length) return <MessagingEmptyState title="No messages in this conversation" compact />

  return (
    <ol aria-label="Archived conversation history" className="mx-auto max-w-5xl space-y-2 px-3 py-4 sm:px-5">
      {messages.map((message) => (
        <li key={message.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 sm:px-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{formatMessageSenderDisplayName(message)}</span>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium">{senderPortalLabel(message.sender_portal ?? message.sender_kind)}</span>
            <span className="ml-auto tabular-nums" aria-label={`Message ${message.id}`}>#{message.id}</span>
          </div>
          {message.deleted_at ? (
            <p className="italic text-slate-600">Message deleted</p>
          ) : (
            <>
              <MessageMentionBody body={message.body ?? ''} participants={participants} viewer={viewer} />
              {message.attachment_url && (
                <MessageAttachmentDisplay url={message.attachment_url} name={message.attachment_name} mime={message.attachment_mime} />
              )}
              {message.files?.filter((file) => file.url !== message.attachment_url).map((file) => (
                <MessageAttachmentDisplay key={file.id ?? file.url} url={file.url} name={file.name} mime={file.mime} />
              ))}
            </>
          )}
        </li>
      ))}
    </ol>
  )
}

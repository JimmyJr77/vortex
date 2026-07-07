import type { MessageRow } from './types'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'
import YoutubeLinkifiedText from '../YoutubeLinkifiedText'
import { formatMessageSenderDisplayName } from './messageFormatting'

interface ArchivedMessageLinesProps {
  messages: MessageRow[]
}

function senderPortalLabel(portal?: string) {
  if (portal === 'admin') return 'Admin portal'
  if (portal === 'coach') return 'Coach portal'
  if (portal === 'member') return 'Member portal'
  return 'Unknown portal'
}

export default function ArchivedMessageLines({ messages }: ArchivedMessageLinesProps) {
  if (messages.length === 0) {
    return <div className="p-4 text-sm text-gray-500">No messages in this thread.</div>
  }

  return (
    <div className="border-t border-gray-200">
      {messages.map((m) => (
        <div key={m.id} className="border-b border-gray-100 px-3 py-2.5 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-1">
            <span className="tabular-nums">{new Date(m.created_at).toLocaleString()}</span>
            <span className="text-gray-700">{formatMessageSenderDisplayName(m)}</span>
            <span className="uppercase tracking-wide text-[10px] text-gray-400">
              {senderPortalLabel(m.sender_portal ?? m.sender_kind)}
            </span>
            <span className="text-gray-400">#{m.id}</span>
          </div>
          <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">
            <YoutubeLinkifiedText text={m.body ?? ''} />
          </div>
          {m.attachment_url && (
            <div className="mt-1">
              <MessageAttachmentDisplay url={m.attachment_url} name={m.attachment_name} mime={m.attachment_mime} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

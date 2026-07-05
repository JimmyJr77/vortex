import { Paperclip, X } from 'lucide-react'

interface MessageReplyComposerProps {
  reply: string
  onReplyChange: (value: string) => void
  onSend: () => void
  sending?: boolean
  placeholder?: string
  sendLabel?: string
  pendingAttachment?: File | null
  onClearAttachment?: () => void
}

export default function MessageReplyComposer({
  reply,
  onReplyChange,
  onSend,
  sending = false,
  placeholder = 'Type a reply…',
  sendLabel = 'Send',
  pendingAttachment = null,
  onClearAttachment,
}: MessageReplyComposerProps) {
  const canSend = Boolean(reply.trim() || pendingAttachment)

  return (
    <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
      {pendingAttachment && (
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          <Paperclip className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate flex-1">{pendingAttachment.name}</span>
          {onClearAttachment && (
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={onClearAttachment}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend && !sending) onSend()
            }
          }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !canSend}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {sendLabel}
        </button>
      </div>
    </div>
  )
}

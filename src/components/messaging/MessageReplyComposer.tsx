import { useMemo, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import type { MessageViewer } from './messageBubbleStyle'
import {
  filterParticipantsForMentionQuery,
  findActiveMentionQuery,
  mentionKey,
  mentionPayloadFromParticipant,
  type MessageMentionPayload,
} from './messageMentions'
import type { ThreadParticipant } from './types'

interface MessageReplyComposerProps {
  reply: string
  onReplyChange: (value: string) => void
  onSend: (mentions: MessageMentionPayload[]) => void
  sending?: boolean
  placeholder?: string
  sendLabel?: string
  pendingAttachment?: File | null
  onClearAttachment?: () => void
  participants?: ThreadParticipant[]
  viewer?: MessageViewer
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
  participants = [],
  viewer,
}: MessageReplyComposerProps) {
  const canSend = Boolean(reply.trim() || pendingAttachment)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [pendingMentions, setPendingMentions] = useState<MessageMentionPayload[]>([])

  const mentionOptions = useMemo(
    () => filterParticipantsForMentionQuery(participants, mentionQuery, viewer),
    [participants, mentionQuery, viewer],
  )

  const showMentionMenu = mentionStart != null && participants.length > 0

  const syncMentionMenu = (text: string, caret: number) => {
    const active = findActiveMentionQuery(text, caret)
    if (!active) {
      setMentionStart(null)
      setMentionQuery('')
      return
    }
    setMentionStart(active.start)
    setMentionQuery(active.query)
  }

  const insertMention = (participant: ThreadParticipant) => {
    const payload = mentionPayloadFromParticipant(participant)
    const name = participant.name?.trim()
    if (!payload || !name || mentionStart == null) return

    const caret = inputRef.current?.selectionStart ?? reply.length
    const before = reply.slice(0, mentionStart)
    const after = reply.slice(caret)
    const insert = `@${name} `
    const next = `${before}${insert}${after}`
    onReplyChange(next)
    setPendingMentions((prev) => {
      const key = mentionKey(payload)
      if (!key || prev.some((m) => mentionKey(m) === key)) return prev
      return [...prev, payload]
    })
    setMentionStart(null)
    setMentionQuery('')
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      const pos = before.length + insert.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const handleSend = () => {
    if (!canSend || sending) return
    onSend(pendingMentions)
    setPendingMentions([])
    setMentionStart(null)
    setMentionQuery('')
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 pb-4 pt-2 bg-white">
      {pendingAttachment && (
        <div className="mb-2 shrink-0 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
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
      <div className="flex gap-2 items-end flex-1 min-h-0">
        <div className="relative flex-1 min-h-0 flex flex-col">
          {showMentionMenu && mentionOptions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg z-20">
              {mentionOptions.slice(0, 8).map((participant) => {
                const key = participant.user_id
                  ? `user:${participant.user_id}`
                  : `member:${participant.member_id}`
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      insertMention(participant)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {participant.name}
                  </button>
                )
              })}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={reply}
            onChange={(e) => {
              onReplyChange(e.target.value)
              syncMentionMenu(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onClick={(e) => {
              syncMentionMenu(reply, e.currentTarget.selectionStart ?? reply.length)
            }}
            onKeyUp={(e) => {
              syncMentionMenu(reply, e.currentTarget.selectionStart ?? reply.length)
            }}
            placeholder={placeholder}
            className="w-full flex-1 min-h-[42px] border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            onKeyDown={(e) => {
              if (showMentionMenu && mentionOptions.length > 0 && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                insertMention(mentionOptions[0])
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !canSend}
          className="h-[42px] shrink-0 inline-flex items-center justify-center bg-gray-900 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {sendLabel}
        </button>
      </div>
    </div>
  )
}

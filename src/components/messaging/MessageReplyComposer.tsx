import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AtSign, FileText, Loader2, Paperclip, Send, X } from 'lucide-react'
import { MESSAGE_ATTACHMENT_ACCEPT, MESSAGE_ATTACHMENT_MAX_BYTES } from './messageAttachmentUpload'
import type { MessageViewer } from './messageBubbleStyle'
import {
  filterParticipantsForMentionQuery,
  findActiveMentionQuery,
  mentionPayloadFromParticipant,
  mergeMentionPayloads,
  tokenizeMentionsInBody,
  type MessageMentionPayload,
} from './messageMentions'
import { participantKey, type ThreadParticipant } from './types'

interface MessageReplyComposerProps {
  reply: string
  onReplyChange: (value: string) => void
  onSend: (mentions: MessageMentionPayload[]) => void
  sending?: boolean
  placeholder?: string
  sendLabel?: string
  pendingAttachment?: File | null
  onAttachmentPick?: (file: File) => void
  onClearAttachment?: () => void
  participants?: ThreadParticipant[]
  viewer?: MessageViewer
  mentions?: MessageMentionPayload[]
  onMentionsChange?: (mentions: MessageMentionPayload[]) => void
  auxiliaryActions?: ReactNode
}

interface MentionMenu {
  text: string
  start: number
  query: string
  activeIndex: number
  dismissed?: boolean
}

const EMPTY_PARTICIPANTS: ThreadParticipant[] = []
const TOOL_BUTTON = 'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red disabled:opacity-50'

function mentionsInText(text: string, mentions: MessageMentionPayload[], participants: ThreadParticipant[]) {
  return mentions.filter((mention) => tokenizeMentionsInBody(text, [mention], participants) !== text)
}

export default function MessageReplyComposer({
  reply,
  onReplyChange,
  onSend,
  sending = false,
  placeholder = 'Write a reply…',
  sendLabel = 'Send',
  pendingAttachment = null,
  onAttachmentPick,
  onClearAttachment,
  participants = EMPTY_PARTICIPANTS,
  viewer,
  mentions,
  onMentionsChange,
  auxiliaryActions,
}: MessageReplyComposerProps) {
  const id = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeMentionRef = useRef<HTMLButtonElement>(null)
  const [mentionMenu, setMentionMenu] = useState<MentionMenu | null>(null)
  const [localMentions, setLocalMentions] = useState<MessageMentionPayload[]>([])
  const [attachmentError, setAttachmentError] = useState('')

  const canSend = Boolean(reply.trim() || pendingAttachment)
  const storedMentions = mentions ?? localMentions
  const activeMention = mentionMenu?.text === reply && !mentionMenu.dismissed && !sending ? mentionMenu : null
  const mentionable = useMemo(
    () => filterParticipantsForMentionQuery(participants, '', viewer).filter((participant) => participantKey(participant) !== null),
    [participants, viewer],
  )
  const mentionOptions = activeMention
    ? filterParticipantsForMentionQuery(mentionable, activeMention.query).slice(0, 8)
    : []
  const activeIndex = Math.min(activeMention?.activeIndex ?? 0, mentionOptions.length - 1)
  const showMentions = Boolean(activeMention && mentionable.length)
  const mentionListId = `${id}-mentions`

  useEffect(() => {
    activeMentionRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeIndex])

  const updateReply = (text: string, addedMention?: MessageMentionPayload) => {
    const current = mentionsInText(reply, storedMentions, participants)
    const retained = mentionsInText(text, current, participants)
    const next = addedMention ? mergeMentionPayloads(retained, [addedMention]) : retained
    if (next.length !== storedMentions.length || next.some((mention, index) => mention !== storedMentions[index])) {
      (onMentionsChange ?? setLocalMentions)(next)
    }
    onReplyChange(text)
  }

  const syncMentionMenu = (text: string, start: number, end: number) => {
    const query = start === end ? findActiveMentionQuery(text, start) : null
    setMentionMenu((current) => {
      if (!query) return null
      if (current?.text === text && current.start === query.start && current.query === query.query) return current
      return { ...query, text, activeIndex: 0 }
    })
  }

  const focusEditorAt = (position: number) => {
    inputRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(position, position)
    })
  }

  const insertMention = (participant: ThreadParticipant) => {
    const payload = mentionPayloadFromParticipant(participant)
    const name = participant.name?.trim()
    if (!payload || !name || !activeMention) return

    const caret = inputRef.current?.selectionStart ?? reply.length
    const before = reply.slice(0, activeMention.start)
    const after = reply.slice(caret)
    const insert = `@${name} `
    updateReply(`${before}${insert}${after}`, payload)
    setMentionMenu(null)
    focusEditorAt(before.length + insert.length)
  }

  const startMention = () => {
    const start = inputRef.current?.selectionStart ?? reply.length
    const end = inputRef.current?.selectionEnd ?? start
    const query = start === end ? findActiveMentionQuery(reply, start) : null
    if (query) {
      setMentionMenu({ ...query, text: reply, activeIndex: 0 })
      focusEditorAt(start)
      return
    }

    const before = reply.slice(0, start)
    const insert = before && !/\s$/.test(before) ? ' @' : '@'
    const text = `${before}${insert}${reply.slice(end)}`
    const caret = start + insert.length
    updateReply(text)
    syncMentionMenu(text, caret, caret)
    focusEditorAt(caret)
  }

  const handleSend = () => {
    if (!canSend || sending) return
    setMentionMenu(null)
    setAttachmentError('')
    onSend(mentionsInText(reply, storedMentions, participants))
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sending || event.nativeEvent.isComposing || event.keyCode === 229) return

    if (showMentions && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setMentionMenu((current) => current && { ...current, dismissed: true })
      return
    }
    if (mentionOptions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (activeIndex + step + mentionOptions.length) % mentionOptions.length
      setMentionMenu((current) => current && { ...current, activeIndex: next })
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (event.repeat) return
      const participant = mentionOptions[activeIndex]
      if (participant) insertMention(participant)
      else handleSend()
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-1 sm:px-4 sm:pb-4"
      aria-label="Reply composer"
      role="group"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMentionMenu(null)
      }}
    >
      {onAttachmentPick && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={MESSAGE_ATTACHMENT_ACCEPT}
          disabled={sending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
              setAttachmentError('Choose a file that is 8 MB or smaller.')
              return
            }
            setAttachmentError('')
            onAttachmentPick(file)
          }}
        />
      )}
      {auxiliaryActions && <div className="mb-1 shrink-0">{auxiliaryActions}</div>}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-slate-400">
        {showMentions && (
          <div className="absolute inset-x-0 bottom-full z-30 mb-2 max-w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500">Mention someone</div>
            {mentionOptions.length ? (
              <div id={mentionListId} role="listbox" aria-label="Mention suggestions" className="max-h-48 overflow-auto overscroll-contain p-1">
                {mentionOptions.map((participant, index) => (
                  <button
                    key={participantKey(participant)}
                    id={`${mentionListId}-${index}`}
                    ref={index === activeIndex ? activeMentionRef : undefined}
                    role="option"
                    aria-selected={index === activeIndex}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(participant)}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-slate-100 ${index === activeIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`}
                  >
                    <AtSign className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">{participant.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p role="status" className="px-3 pb-3 text-sm text-slate-600">No matching participants.</p>
            )}
          </div>
        )}
        {pendingAttachment && (
          <div className="mx-3 mt-2 flex w-fit max-w-[calc(100%_-_1.5rem)] shrink-0 items-center gap-2 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700">
            <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 truncate" title={pendingAttachment.name}>{pendingAttachment.name}</span>
            {onClearAttachment && (
              <button
                type="button"
                aria-label="Remove attachment"
                title="Remove attachment"
                disabled={sending}
                onClick={() => {
                  setAttachmentError('')
                  onClearAttachment()
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {attachmentError && <p role="alert" className="mx-3 mt-2 text-xs font-medium text-red-700">{attachmentError}</p>}
        <textarea
          ref={inputRef}
          id={id}
          value={reply}
          aria-label="Reply message"
          aria-describedby={`${id}-keyboard`}
          aria-autocomplete={mentionable.length ? 'list' : undefined}
          aria-controls={mentionOptions.length ? mentionListId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${mentionListId}-${activeIndex}` : undefined}
          readOnly={sending}
          rows={2}
          onChange={(event) => {
            const { value, selectionStart, selectionEnd } = event.currentTarget
            updateReply(value)
            syncMentionMenu(value, selectionStart, selectionEnd)
          }}
          onSelect={(event) => {
            const { value, selectionStart, selectionEnd } = event.currentTarget
            syncMentionMenu(value, selectionStart, selectionEnd)
          }}
          onKeyDown={handleEditorKeyDown}
          placeholder={placeholder}
          className="min-h-12 w-full flex-1 resize-none rounded-t-xl bg-transparent px-3 pb-1 pt-2.5 text-base leading-6 text-slate-900 placeholder:text-slate-500 focus:outline-none sm:text-sm"
        />
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 pb-2">
          <div className="flex min-w-0 flex-wrap items-center">
            {onAttachmentPick && (
              <button type="button" disabled={sending} onClick={() => fileInputRef.current?.click()} className={TOOL_BUTTON} title="Attach a file">
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                Attach
              </button>
            )}
            {mentionable.length > 0 && (
              <button type="button" disabled={sending} onClick={startMention} className={TOOL_BUTTON} title="Mention a participant">
                <AtSign className="h-4 w-4" aria-hidden="true" />
                Mention
              </button>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span id={`${id}-keyboard`} className="sr-only text-xs text-slate-600 lg:not-sr-only">
              Enter to send · Shift+Enter for a new line
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !canSend}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-vortex-red px-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2 disabled:!bg-slate-100 disabled:!text-slate-500"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {sending ? 'Sending…' : sendLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

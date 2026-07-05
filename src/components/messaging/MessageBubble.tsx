import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import type { MessageRow } from './types'
import { messageBubbleClassName, messageFooterMeta, type MessageViewer } from './messageBubbleStyle'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'
import MessagingFileChip from './MessagingFileChip'
import MessageReactionBar, { type MessageReactionGroup } from './MessageReactionBar'
import MessageMentionBody from './MessageMentionBody'
import { viewerIsMentioned } from './messageMentions'
import type { MessagingRole, ThreadParticipant } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE_PX = 12

interface MessageBubbleProps {
  message: MessageRow
  viewer: MessageViewer
  showSenderName?: boolean
  threadId?: number
  role?: MessagingRole
  fetcher?: Fetcher
  participants?: ThreadParticipant[]
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  onReply?: (message: MessageRow) => void
  onReplyWithFaq?: (message: MessageRow) => void
  reactionsDisabled?: boolean
}

export default function MessageBubble({
  message,
  viewer,
  threadId,
  role,
  fetcher,
  participants = [],
  onReactionsUpdated,
  onReply,
  onReplyWithFaq,
  reactionsDisabled = false,
}: MessageBubbleProps) {
  const footerMeta = messageFooterMeta(message, viewer)
  const isDeleted = Boolean(message.deleted_at)
  const isEdited = Boolean(message.edited_at) && !isDeleted
  const mentionedYou = viewerIsMentioned(message, viewer)
  const files = message.files ?? []
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const longPressHandled = useRef(false)
  const [actionMenu, setActionMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!actionMenu) return
    const close = () => setActionMenu(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [actionMenu])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const openActionMenu = (x: number, y: number, e?: SyntheticEvent) => {
    if (!onReply || isDeleted) return
    e?.preventDefault()
    if (!onReplyWithFaq) {
      onReply(message)
      return
    }
    setActionMenu({ x, y })
  }

  return (
    <div
      className={`${messageBubbleClassName(message, viewer)}${
        mentionedYou ? ' ring-2 ring-vortex-red ring-offset-1' : ''
      } flex flex-col touch-manipulation`}
      onContextMenu={(e) => {
        if (longPressHandled.current) {
          e.preventDefault()
          longPressHandled.current = false
          return
        }
        openActionMenu(e.clientX, e.clientY, e)
      }}
      onTouchStart={(e) => {
        if (!onReply || isDeleted) return
        longPressHandled.current = false
        const t = e.touches[0]
        if (!t) return
        touchStart.current = { x: t.clientX, y: t.clientY }
        clearLongPress()
        longPressTimer.current = setTimeout(() => {
          longPressHandled.current = true
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10)
          }
          openActionMenu(t.clientX, t.clientY)
        }, LONG_PRESS_MS)
      }}
      onTouchMove={(e) => {
        if (!touchStart.current) return
        const t = e.touches[0]
        if (!t) return
        const dx = Math.abs(t.clientX - touchStart.current.x)
        const dy = Math.abs(t.clientY - touchStart.current.y)
        if (dx > LONG_PRESS_MOVE_TOLERANCE_PX || dy > LONG_PRESS_MOVE_TOLERANCE_PX) {
          clearLongPress()
        }
      }}
      onTouchEnd={() => {
        clearLongPress()
        touchStart.current = null
      }}
      onTouchCancel={() => {
        clearLongPress()
        touchStart.current = null
      }}
    >
      {actionMenu && (
        <div
          className="fixed z-50 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: actionMenu.x, top: actionMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setActionMenu(null)
              onReply?.(message)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => {
              setActionMenu(null)
              onReplyWithFaq?.(message)
            }}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-vortex-red hover:bg-red-50"
          >
            Reply + FAQ
          </button>
        </div>
      )}
      {(message.is_critical || isDeleted || isEdited || mentionedYou) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {mentionedYou && (
            <span className="inline-flex items-center rounded-full bg-vortex-red/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-vortex-red">
              Mentioned you
            </span>
          )}
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
          message.body && (
            <MessageMentionBody body={message.body} participants={participants} viewer={viewer} />
          )
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
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0 w-full">
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
        <div className="ml-auto shrink-0 text-[10px] text-right opacity-70 tabular-nums whitespace-nowrap leading-tight">
          {footerMeta}
          {isEdited && !isDeleted && message.edited_at && (
            <span className="ml-1 opacity-80">· edited</span>
          )}
        </div>
      </div>
    </div>
  )
}

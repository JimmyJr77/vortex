import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { AlertCircle, Check, Ellipsis, ListPlus, Pin, PinOff, Reply } from 'lucide-react'
import PortalOverlay from '../portal/PortalOverlay'
import MessageAttachmentDisplay from './MessageAttachmentDisplay'
import MessageMentionBody from './MessageMentionBody'
import MessageReactionBar from './MessageReactionBar'
import MessagingFileChip from './MessagingFileChip'
import { isOwnMessage, messageBubbleClassName, type MessageViewer } from './messageBubbleStyle'
import { formatMessageSenderDisplayName, formatMessageTime } from './messageFormatting'
import type { MessageReactionGroup, MessageRow, MessagingRole, ThreadParticipant } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE_PX = 12
const MENU_GUTTER_PX = 8
const actionButtonClass = 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700'

type ActionMenuPosition = { x: number; y: number; anchorTop: number; followsTrigger?: boolean }

function positionActionMenu(menu: HTMLDivElement, { x, y, anchorTop }: ActionMenuPosition) {
  const { width, height } = menu.getBoundingClientRect()
  const left = Math.max(MENU_GUTTER_PX, Math.min(x, window.innerWidth - width - MENU_GUTTER_PX))
  const top = y + height + MENU_GUTTER_PX <= window.innerHeight
    ? y
    : anchorTop - height - MENU_GUTTER_PX
  menu.style.left = `${left}px`
  menu.style.top = `${Math.max(MENU_GUTTER_PX, top)}px`
}

function getTriggerPosition(trigger: HTMLButtonElement): ActionMenuPosition {
  const bounds = trigger.getBoundingClientRect()
  return { x: bounds.left, y: bounds.bottom + MENU_GUTTER_PX, anchorTop: bounds.top, followsTrigger: true }
}

interface MessageBubbleProps {
  message: MessageRow
  viewer: MessageViewer
  threadId?: number
  role?: MessagingRole
  fetcher?: Fetcher
  participants?: ThreadParticipant[]
  onReactionsUpdated?: (messageId: number, reactions: MessageReactionGroup[]) => void
  onReply?: (message: MessageRow) => void
  onReplyWithFaq?: (message: MessageRow) => void
  onPinComment?: (message: MessageRow) => void
  canUnpin?: boolean
  onUnpin?: (message: MessageRow) => void
  pinSelectionActive?: boolean
  pinSelected?: boolean
  onPinSelectionToggle?: (message: MessageRow) => void
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
  onPinComment,
  canUnpin = false,
  onUnpin,
  pinSelectionActive = false,
  pinSelected = false,
  onPinSelectionToggle,
  reactionsDisabled = false,
}: MessageBubbleProps) {
  const ownMessage = isOwnMessage(message, viewer)
  const senderName = ownMessage ? 'You' : formatMessageSenderDisplayName(message)
  const isDeleted = Boolean(message.deleted_at)
  const isEdited = Boolean(message.edited_at) && !isDeleted
  const isCritical = Boolean(message.is_critical) && !isDeleted
  const files = message.files ?? []
  const reactions = message.reactions ?? []
  const actionId = useId()
  const actionTriggerRef = useRef<HTMLButtonElement>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const longPressHandled = useRef(false)
  const [actionMenu, setActionMenu] = useState<ActionMenuPosition | null>(null)
  const [reactionPending, setReactionPending] = useState(false)
  const [reactionError, setReactionError] = useState<string | null>(null)

  const canReact = !isDeleted && threadId != null && Boolean(role && fetcher) && !reactionsDisabled && !pinSelectionActive
  const hasActions = !isDeleted && !pinSelectionActive
    && Boolean(canReact || onReply || onReplyWithFaq || onPinComment || (canUnpin && onUnpin))
  const canSelect = !isDeleted && pinSelectionActive && Boolean(onPinSelectionToggle)
  const openMenu = hasActions ? actionMenu : null

  useLayoutEffect(() => {
    const menu = actionMenuRef.current
    if (!openMenu || !menu) return

    positionActionMenu(menu, openMenu)
    menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }, [openMenu])

  useEffect(() => {
    if (!openMenu) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && (
        actionMenuRef.current?.contains(target) || actionTriggerRef.current?.contains(target)
      )) return
      setActionMenu(null)
    }
    const onViewportChange = (event: Event) => {
      if (event.target instanceof Node && actionMenuRef.current?.contains(event.target)) return
      const trigger = actionTriggerRef.current
      const menu = actionMenuRef.current
      if (openMenu.followsTrigger && trigger && menu) {
        const position = getTriggerPosition(trigger)
        if (position.y > 0 && position.anchorTop < window.innerHeight) {
          positionActionMenu(menu, position)
          return
        }
      }
      if (actionMenuRef.current?.contains(document.activeElement)) {
        actionTriggerRef.current?.focus({ preventScroll: true })
      }
      setActionMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setActionMenu(null)
      actionTriggerRef.current?.focus({ preventScroll: true })
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
    document.addEventListener('keydown', closeOnEscape, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('scroll', onViewportChange, true)
      document.removeEventListener('keydown', closeOnEscape, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [openMenu])

  useEffect(() => () => {
    if (longPressTimer.current !== null) clearTimeout(longPressTimer.current)
  }, [])

  const clearLongPress = () => {
    if (longPressTimer.current === null) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  const closeMenu = () => {
    setActionMenu(null)
    actionTriggerRef.current?.focus({ preventScroll: true })
  }

  const toggleReaction = async (reaction: MessageReactionGroup, trigger: HTMLButtonElement, fromPicker = false) => {
    if (!canReact || reactionPending || !role || !fetcher || threadId == null) return

    const path = `/api/${role}/messages/${threadId}/messages/${message.id}/reactions`
    const removing = reaction.reacted_by_viewer === true
    const picker = fromPicker ? actionMenuRef.current : null
    setReactionPending(true)
    setReactionError(null)
    try {
      const updated = removing
        ? await fetcher(`${path}/${encodeURIComponent(reaction.emoji)}`, { method: 'DELETE' })
        : await fetcher(path, { method: 'POST', body: JSON.stringify({ emoji: reaction.emoji }) })
      if (!Array.isArray(updated)) throw new Error('Reactions were unavailable.')

      const groups = updated as MessageReactionGroup[]
      if (!fromPicker && removing && document.activeElement === trigger
        && !groups.some((group) => group.emoji === reaction.emoji)) {
        actionTriggerRef.current?.focus({ preventScroll: true })
      }
      onReactionsUpdated?.(message.id, groups)
    } catch {
      setReactionError('Could not update your reaction. Try again.')
    } finally {
      setReactionPending(false)
      if (picker && actionMenuRef.current === picker) closeMenu()
    }
  }

  const openAtTrigger = () => {
    const trigger = actionTriggerRef.current
    if (!trigger) return
    setActionMenu(getTriggerPosition(trigger))
  }

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasActions || (event.target as HTMLElement).closest('a, button')) return
    event.preventDefault()
    if (longPressHandled.current) {
      longPressHandled.current = false
      return
    }
    if (event.clientX === 0 && event.clientY === 0) {
      openAtTrigger()
      return
    }
    setActionMenu({ x: event.clientX, y: event.clientY, anchorTop: event.clientY })
  }

  const runAction = (action: (row: MessageRow) => void) => {
    closeMenu()
    action(message)
  }

  return (
    <article className={`flex items-end gap-2 ${ownMessage ? 'flex-row-reverse' : ''}`}>
      <div className="min-w-[min(12rem,80%,calc(100%-2.75rem))] lg:min-w-[min(20rem,80%,calc(100%-2.75rem))] max-w-[calc(100%-2.75rem)] sm:max-w-[min(80%,40rem)]">
        <div className={`mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5 text-xs ${ownMessage ? 'justify-end' : ''}`}>
          <span className="min-w-0 break-words font-semibold !text-slate-800">{senderName}</span>
          <time dateTime={message.created_at} className="shrink-0 tabular-nums font-medium !text-slate-600">
            {formatMessageTime(message.created_at)}
          </time>
          {isEdited && <span className="!text-slate-600">Edited</span>}
        </div>
        <div
          className={`${messageBubbleClassName(message, ownMessage)}${pinSelected ? ' ring-2 ring-blue-700 ring-offset-1' : ''}${canSelect ? ' cursor-pointer' : ''}`}
          onClick={canSelect ? (event) => {
            if (!(event.target as HTMLElement).closest('a, button')) onPinSelectionToggle?.(message)
          } : undefined}
          onContextMenu={handleContextMenu}
          onTouchStart={(event) => {
            if (!hasActions || (event.target as HTMLElement).closest('a, button')) return
            if (event.touches.length !== 1) {
              clearLongPress()
              touchStart.current = null
              return
            }
            longPressHandled.current = false
            const { clientX: x, clientY: y } = event.touches[0]
            touchStart.current = { x, y }
            clearLongPress()
            longPressTimer.current = setTimeout(() => {
              longPressHandled.current = true
              setActionMenu({ x, y, anchorTop: y })
            }, LONG_PRESS_MS)
          }}
          onTouchMove={(event) => {
            const start = touchStart.current
            if (!start) return
            const touch = event.touches[0]
            if (!touch || Math.abs(touch.clientX - start.x) > LONG_PRESS_MOVE_TOLERANCE_PX
              || Math.abs(touch.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX) clearLongPress()
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
          {isCritical && (
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-red-800">
              {isCritical && (
                <span className="inline-flex items-center gap-1">
                  <AlertCircle size={13} aria-hidden="true" /> Critical
                </span>
              )}
              {isCritical && message.requires_ack && <span className="font-medium">Acknowledgment required</span>}
            </div>
          )}
          {isDeleted ? (
            <p className="italic">This message was deleted.</p>
          ) : (
            <>
              {message.body && <MessageMentionBody body={message.body} participants={participants} viewer={viewer} />}
              {message.attachment_url && (
                <MessageAttachmentDisplay url={message.attachment_url} name={message.attachment_name} mime={message.attachment_mime} />
              )}
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {files.map((file, index) => (
                    <MessagingFileChip key={file.id ?? `${file.url}-${index}`} file={file} compact />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!isDeleted && reactions.length > 0 && threadId != null && role && fetcher && (
          <MessageReactionBar
            reactions={reactions}
            disabled={!canReact || reactionPending}
            className={`mt-1.5 px-0.5 ${ownMessage ? 'justify-end' : ''}`}
            onToggle={(reaction, trigger) => void toggleReaction(reaction, trigger)}
          />
        )}
        {reactionError && <p role="alert" className="mt-1.5 px-0.5 text-xs text-red-700">{reactionError}</p>}
      </div>
      {canSelect && (
        <button
          type="button"
          aria-label={`Select message from ${senderName} to pin`}
          aria-pressed={pinSelected}
          onClick={() => onPinSelectionToggle?.(message)}
          className={`mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${pinSelected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-700'}`}
        >
          {pinSelected && <Check size={16} aria-hidden="true" />}
        </button>
      )}
      {hasActions && (
        <button
          ref={actionTriggerRef}
          type="button"
          aria-label={`Actions for message from ${senderName}`}
          title="Message actions"
          aria-expanded={Boolean(openMenu)}
          aria-controls={openMenu ? actionId : undefined}
          onClick={() => openMenu ? closeMenu() : openAtTrigger()}
          className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-expanded:bg-slate-200/70 aria-expanded:text-slate-900"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
      )}
      {openMenu && (
        <PortalOverlay>
          <div
            id={actionId}
            ref={actionMenuRef}
            role="group"
            aria-label="Message actions"
            className="fixed z-[100] max-h-[calc(100dvh-1rem)] w-52 max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return
              const items = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
              const edge = event.shiftKey ? items[0] : items[items.length - 1]
              if (event.target === edge) closeMenu()
            }}
          >
            {canReact && (
              <div className="px-1.5 pb-1.5 pt-1">
                <p className="mb-1 px-1 text-xs font-semibold text-slate-600">React</p>
                <MessageReactionBar
                  reactions={reactions}
                  mode="picker"
                  disabled={reactionPending}
                  onToggle={(reaction, trigger) => void toggleReaction(reaction, trigger, true)}
                />
              </div>
            )}
            {onReply && (
              <button type="button" onClick={() => runAction(onReply)} className={actionButtonClass}>
                <Reply size={15} aria-hidden="true" /> Reply
              </button>
            )}
            {onReplyWithFaq && (
              <button type="button" onClick={() => runAction(onReplyWithFaq)} className={actionButtonClass}>
                <ListPlus size={15} aria-hidden="true" /> Reply and add to FAQ
              </button>
            )}
            {onPinComment && (
              <button type="button" onClick={() => runAction(onPinComment)} className={actionButtonClass}>
                <Pin size={15} aria-hidden="true" /> Pin message
              </button>
            )}
            {canUnpin && onUnpin && (
              <button type="button" onClick={() => runAction(onUnpin)} className={actionButtonClass}>
                <PinOff size={15} aria-hidden="true" /> Unpin message
              </button>
            )}
          </div>
        </PortalOverlay>
      )}
    </article>
  )
}

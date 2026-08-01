import type { MessageRow } from './types'
import { formatMessageSenderDisplayName, formatMessageTime } from './messageFormatting'

export type SenderKind = 'member' | 'coach' | 'admin'
export type SenderPortal = 'member' | 'coach' | 'admin'

export interface MessageViewer {
  portal: 'member' | 'coach' | 'admin'
  userId?: number | null
  memberId?: number | null
}

export function getMessageViewer(portal: 'member' | 'coach' | 'admin'): MessageViewer {
  if (portal === 'admin') {
    const id = localStorage.getItem('vortex-admin-id')
    return { portal, userId: id ? Number(id) : null }
  }
  try {
    const raw = localStorage.getItem('vortex_member')
    if (!raw) return { portal, userId: null, memberId: null }
    const account = JSON.parse(raw) as { id?: number; memberId?: number | null }
    return {
      portal,
      userId: account.id ?? null,
      memberId: account.memberId ?? null,
    }
  } catch {
    return { portal, userId: null, memberId: null }
  }
}

export function resolveSenderKind(message: MessageRow): SenderKind {
  if (message.sender_kind) return message.sender_kind
  if (message.sender_member_id != null) return 'member'
  return 'coach'
}

export function resolveSenderPortal(message: MessageRow): SenderPortal {
  if (message.sender_portal) return message.sender_portal
  if (message.sender_member_id != null) return 'member'
  if (message.sender_kind === 'admin') return 'admin'
  if (message.sender_kind === 'coach') return 'coach'
  return 'member'
}

export function isOwnMessage(message: MessageRow, viewer: MessageViewer): boolean {
  if (viewer.portal === 'member') {
    if (message.sender_member_id != null && viewer.memberId != null) {
      return Number(message.sender_member_id) === Number(viewer.memberId)
    }
    return false
  }
  if (message.sender_user_id != null && viewer.userId != null) {
    return Number(message.sender_user_id) === Number(viewer.userId)
  }
  return false
}

function portalBubbleStyles(portal: SenderPortal, ownMessage: boolean): string {
  switch (portal) {
    case 'coach':
      return 'bg-orange-100 text-orange-950'
    case 'admin':
      return 'bg-pink-100 text-pink-950'
    default:
      return ownMessage ? 'bg-blue-100 text-blue-950' : 'bg-green-100 text-green-950'
  }
}

export function portalShortLabel(portal: SenderPortal): string {
  if (portal === 'admin') return 'Admin portal'
  if (portal === 'coach') return 'Coach portal'
  return 'Member portal'
}

export function messageBubbleClassName(message: MessageRow, viewer: MessageViewer): string {
  const base = 'rounded-lg px-3 py-2 text-sm max-w-[85%]'
  const portal = resolveSenderPortal(message)
  const ownMessage = isOwnMessage(message, viewer)
  const align = ownMessage ? 'ml-auto' : 'ml-0'
  const color = message.is_critical && !message.deleted_at
    ? 'bg-red-600 text-white'
    : portalBubbleStyles(portal, ownMessage)
  return `${base} ${align} ${color}`
}

export function senderLabel(message: MessageRow, viewer: MessageViewer): string | null {
  const portal = portalShortLabel(resolveSenderPortal(message))
  if (isOwnMessage(message, viewer)) {
    return portal
  }
  return `${formatMessageSenderDisplayName(message)} · ${portal}`
}

export function messageFooterMeta(message: MessageRow, viewer: MessageViewer): string {
  const time = formatMessageTime(message.created_at)
  if (isOwnMessage(message, viewer)) {
    return `You · ${time}`
  }
  return `${formatMessageSenderDisplayName(message)} · ${time}`
}

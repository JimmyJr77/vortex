import type { MessageRow } from './types'

export type SenderKind = 'member' | 'coach' | 'admin'

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

export function messageBubbleClassName(message: MessageRow, viewer: MessageViewer): string {
  const base = 'rounded-lg px-3 py-2 text-sm max-w-[85%]'
  if (isOwnMessage(message, viewer)) {
    return `${base} ml-auto bg-green-100 text-gray-900 border border-green-200`
  }
  switch (resolveSenderKind(message)) {
    case 'coach':
      return `${base} ml-0 bg-red-50 text-gray-900 border border-red-400`
    case 'admin':
      return `${base} ml-0 bg-gray-100 text-gray-900 border border-gray-600`
    default:
      return `${base} ml-0 bg-blue-50 text-gray-900 border border-blue-100`
  }
}

export function senderLabel(message: MessageRow, viewer: MessageViewer): string | null {
  if (isOwnMessage(message, viewer)) return null
  return message.sender_name || null
}

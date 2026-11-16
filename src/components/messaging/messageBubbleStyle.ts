import type { MessageRow } from './types'

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

export function messageBubbleClassName(message: MessageRow, ownMessage: boolean): string {
  const base = 'min-w-0 rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed'
  const corner = ownMessage ? 'rounded-tr-md' : 'rounded-tl-md'
  if (message.deleted_at) return `${base} ${corner} border-slate-200 bg-slate-100 text-slate-600`
  if (message.is_critical) return `${base} ${corner} border-red-300 bg-red-50 text-slate-900`
  if (ownMessage) return `${base} ${corner} border-slate-200 bg-slate-100 text-slate-900`
  return `${base} ${corner} border-slate-200 bg-white text-slate-900`
}

export const NOTIFICATION_NAV_EVENT = 'vortex:navigate-notification'

export interface NotificationNavigateDetail {
  portal: 'member' | 'coach' | 'admin'
  /** Member / coach portal tab id */
  tab?: string
  /** Admin sidebar group */
  group?: string
  /** Admin section tab id */
  section?: string
  threadId?: number
  submissionId?: number
}

function positiveInt(raw: unknown): number | null {
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function threadIdFromPayload(payload?: Record<string, unknown>): number | null {
  if (!payload) return null
  return positiveInt(payload.thread_id ?? payload.threadId)
}

export function resolveNotificationTarget(
  kind: string,
  payload: Record<string, unknown> | undefined,
  portal: NotificationNavigateDetail['portal'],
): NotificationNavigateDetail | null {
  const threadId = threadIdFromPayload(payload)
  if (threadId != null) {
    if (portal === 'admin') {
      return { portal, group: 'messaging', section: 'messages', threadId }
    }
    return { portal, tab: 'messages', threadId }
  }

  const payloadType = payload?.type != null ? String(payload.type) : null

  if (portal === 'coach' && (payloadType === 'form_review' || kind === 'form_review')) {
    const submissionId = positiveInt(payload?.submission_id ?? payload?.submissionId)
    if (submissionId != null) {
      return { portal, tab: 'reviews', submissionId }
    }
  }

  if (portal === 'member' && kind === 'assignment') {
    return { portal, tab: 'training' }
  }

  if (portal === 'member' && (kind === 'personal_record' || kind === 'achievement')) {
    return { portal, tab: 'progress' }
  }

  if (portal === 'coach' && kind === 'system' && payload?.wellness_checkin_id != null) {
    return { portal, tab: 'roster' }
  }

  return null
}

export function isNotificationNavigable(
  kind: string,
  payload: Record<string, unknown> | undefined,
  portal: NotificationNavigateDetail['portal'],
): boolean {
  return resolveNotificationTarget(kind, payload, portal) != null
}

export function dispatchNotificationNavigate(detail: NotificationNavigateDetail): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_NAV_EVENT, { detail }))
}

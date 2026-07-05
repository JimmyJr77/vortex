export function isHighlightNotification(
  kind: string,
  payload?: Record<string, unknown> | null,
): boolean {
  if (kind === 'message_mention') return true
  if (payload?.mentioned === true) return true
  if (payload?.critical === true) return true
  if (kind === 'message') return false
  return true
}

export function highlightNotificationLabel(
  kind: string,
  payload?: Record<string, unknown> | null,
): string | null {
  if (kind === 'message_mention' || payload?.mentioned === true) return 'Directed at you'
  if (payload?.critical === true) return 'Critical message'
  return null
}

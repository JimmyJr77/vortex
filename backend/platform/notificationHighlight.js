/**
 * In-app notifications that should light the bell: @mentions, critical messages,
 * and other non-routine kinds (assignments, reviews, etc.).
 * Routine thread replies (kind = message, no special payload) are excluded.
 */

export const HIGHLIGHT_NOTIFICATION_SQL = `
  (
    kind = 'message_mention'
    OR COALESCE((payload->>'mentioned')::boolean, false) = true
    OR COALESCE((payload->>'critical')::boolean, false) = true
    OR kind NOT IN ('message', 'message_mention')
  )
`

export function isHighlightNotification(kind, payload) {
  if (kind === 'message_mention') return true
  if (payload?.mentioned === true) return true
  if (payload?.critical === true) return true
  if (kind === 'message') return false
  return true
}

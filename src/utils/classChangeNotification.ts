import type { VortexEmailSignature } from './emailSignature'

export interface ClassChangeEmailPreview {
  subject: string
  body: string
  recipientCount: number
  missingContactCount: number
  signature?: VortexEmailSignature
}

export interface ClassChangeNotifications {
  sent: number
  pending: number
  failed: number
  recipientCount: number
  missingContactCount: number
}

export function classChangeDeliveryMessage(notifications?: ClassChangeNotifications, summaryUnavailable = false) {
  if (summaryUnavailable) return 'Parent update emails are queued, but delivery status is temporarily unavailable.'
  if (!notifications) return 'Parent email delivery could not be confirmed.'
  const parts = [`${notifications.sent} parent update email${notifications.sent === 1 ? '' : 's'} sent.`]
  if (notifications.pending) parts.push(`${notifications.pending} pending; delivery will retry automatically.`)
  if (notifications.failed) parts.push(`${notifications.failed} could not be delivered. Please review the email delivery records.`)
  if (notifications.missingContactCount) parts.push(`${notifications.missingContactCount} student${notifications.missingContactCount === 1 ? ' has' : 's have'} no valid parent or account email on file.`)
  return parts.join(' ')
}

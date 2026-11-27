import type { CalendarCancellationNotifications } from './schedulingApi'

export function cancellationDeliveryMessage(notifications?: CalendarCancellationNotifications, summaryUnavailable = false) {
  if (summaryUnavailable) return 'Cancellation saved. Parent notifications are queued, but delivery status is temporarily unavailable.'
  if (!notifications) return 'Cancellation saved. Email delivery could not be confirmed.'
  const parts = [`Cancellation saved. ${notifications.sent} notification email${notifications.sent === 1 ? '' : 's'} sent.`]
  if (notifications.pending) parts.push(`${notifications.pending} pending; delivery will retry automatically.`)
  if (notifications.failed) parts.push(`${notifications.failed} could not be delivered. Please review the email delivery records.`)
  if (notifications.missingContactCount) parts.push(`${notifications.missingContactCount} student${notifications.missingContactCount === 1 ? ' has' : 's have'} no valid parent or account email on file.`)
  return parts.join(' ')
}

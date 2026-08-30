import type { RecipientOption } from './types'

export function recipientsToPayload(selected: RecipientOption[]) {
  const recipient_user_ids: number[] = []
  const recipient_member_ids: number[] = []
  for (const recipient of selected) {
    if (recipient.kind === 'member') recipient_member_ids.push(recipient.id)
    else recipient_user_ids.push(recipient.id)
  }
  return { recipient_user_ids, recipient_member_ids }
}

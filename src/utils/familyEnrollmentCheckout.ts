import { emptyMemberEnrollmentDraft, memberEnrollmentDraftKey, saveMemberEnrollmentDraft,
  type MemberEnrollmentCartItem } from './memberEnrollmentDrafts'
import { loginMemberWithCredentials, persistMemberSession } from './portalSession'

export interface PendingFamilyEnrollment extends Omit<MemberEnrollmentCartItem, 'cartKey' | 'lineType'> {
  memberId: number
  enrollmentStartDate: string
}

export function saveFamilyCheckoutSelections(payerMemberId: number, selections: PendingFamilyEnrollment[]): void {
  for (const memberId of new Set(selections.map((item) => item.memberId))) {
    const items = selections.filter((item) => item.memberId === memberId)
    const draft = emptyMemberEnrollmentDraft()
    draft.cart = items.map((item) => ({
      ...item,
      lineType: 'slot',
      cartKey: `${item.classEventId}:${item.slotGroupId}:${item.timeSlotId}`,
    }))
    draft.enrollmentStartDate = items[0].enrollmentStartDate
    draft.selectedPricingByProgram = Object.fromEntries(items
      .filter((item) => item.programsId != null && item.selectedPricingOptionKey)
      .map((item) => [item.programsId!, item.selectedPricingOptionKey!]))
    saveMemberEnrollmentDraft(memberEnrollmentDraftKey(payerMemberId, memberId), draft)
  }
}

// The account already exists if login fails. Keep the selections and show a
// login link, rather than invite the user to submit account creation again.
export async function continueFamilyEnrollmentCheckout(apiUrl: string, result: {
  payerMemberId: number
  pendingEnrollments: PendingFamilyEnrollment[]
}, credentials: { email?: string; username?: string; password: string }, destination = '/?enrollment=review'): Promise<boolean> {
  saveFamilyCheckoutSelections(Number(result.payerMemberId), result.pendingEnrollments)
  try {
    const { token, member } = await loginMemberWithCredentials(apiUrl, {
      emailOrUsername: credentials.username || credentials.email || '',
      password: credentials.password,
    })
    persistMemberSession(token, member)
    window.location.assign(destination)
    return true
  } catch {
    // Account creation succeeded; the user can resume with a normal login.
  }
  return false
}

import { emptyMemberEnrollmentDraft, memberEnrollmentDraftKey, saveMemberEnrollmentDraft,
  type MemberEnrollmentCartItem } from './memberEnrollmentDrafts'
import { persistMemberSession, type PortalAccount } from './portalSession'

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
}, credentials: { email?: string; username?: string; password: string }): Promise<boolean> {
  saveFamilyCheckoutSelections(Number(result.payerMemberId), result.pendingEnrollments)
  try {
    const response = await fetch(`${apiUrl}/api/members/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: credentials.email || credentials.username, password: credentials.password }),
    })
    const data = await response.json()
    if (response.ok && data.success && data.token && data.member) {
      persistMemberSession(data.token, data.member as PortalAccount)
      window.location.assign('/?enrollment=review')
      return true
    }
  } catch {
    // Account creation succeeded; the user can resume with a normal login.
  }
  return false
}

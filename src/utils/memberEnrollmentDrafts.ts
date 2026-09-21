import { PROGRAM_PRICING_OPTION_DEFS, type ProgramPricingOptionKey } from './programPricingOptions'

export interface MemberEnrollmentCartItem {
  cartKey: string
  lineType: 'slot' | 'multi_class_pass'
  classEventId?: number
  formId?: number
  slotGroupId?: number
  timeSlotId?: number
  classLabel?: string
  scheduleLabel?: string
  priceLabel?: string | null
  programsId?: number
  programName?: string
  packageId?: string
  packageLabel?: string
  selectedPricingOptionKey?: ProgramPricingOptionKey
}

export interface MemberEnrollmentDraft {
  cart: MemberEnrollmentCartItem[]
  enrollmentStartDate: string
  selectedPricingByProgram: Record<number, ProgramPricingOptionKey>
  promoCodes: string[]
}

export const MEMBER_ENROLLMENT_DRAFT_PREFIX = 'vortex_member_enrollment_draft_v1:'

export function emptyMemberEnrollmentDraft(): MemberEnrollmentDraft {
  return { cart: [], enrollmentStartDate: '', selectedPricingByProgram: {}, promoCodes: [] }
}

export function memberEnrollmentDraftKey(accountMemberId: number, athleteId: number): string {
  return `${MEMBER_ENROLLMENT_DRAFT_PREFIX}${accountMemberId}:${athleteId}`
}

export function loadMemberEnrollmentDraft(key: string): MemberEnrollmentDraft {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(key) || 'null')
    if (!draft || !Array.isArray(draft.cart)) return emptyMemberEnrollmentDraft()
    const validId = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    const cart = draft.cart.filter((item: MemberEnrollmentCartItem) => item && typeof item.cartKey === 'string' && (
      item.lineType === 'slot'
        ? [item.classEventId, item.formId, item.slotGroupId, item.timeSlotId].every(validId)
        : item.lineType === 'multi_class_pass' && validId(item.programsId) && typeof item.packageId === 'string'
    ))
    return {
      cart,
      enrollmentStartDate: typeof draft.enrollmentStartDate === 'string' ? draft.enrollmentStartDate : '',
      selectedPricingByProgram: Object.fromEntries(
        Object.entries(draft.selectedPricingByProgram || {}).filter(([id, key]) =>
          validId(Number(id)) && PROGRAM_PRICING_OPTION_DEFS.some((option) => option.key === key),
        ),
      ) as Record<number, ProgramPricingOptionKey>,
      promoCodes: Array.isArray(draft.promoCodes) ? draft.promoCodes.filter((code: unknown) => typeof code === 'string') : [],
    }
  } catch {
    return emptyMemberEnrollmentDraft()
  }
}

export function saveMemberEnrollmentDraft(key: string, draft: MemberEnrollmentDraft): void {
  try {
    if (draft.cart.length === 0) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Enrollment remains usable when browser storage is unavailable.
  }
}

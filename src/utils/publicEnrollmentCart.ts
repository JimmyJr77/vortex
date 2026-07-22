import type { ProgramPricingOptionKey } from './programPricingOptions'
import type { PendingInviteEnrollment } from '../components/signup/signupEnrollmentUtils'

export const PUBLIC_ENROLLMENT_CART_KEY = 'vortex_public_enrollment_cart_v1'

export interface PublicEnrollmentCartItem extends PendingInviteEnrollment {
  classEventId: number
  programsId: number
  schedulingFormId: number
  slotGroupId: number
  timeSlotId: number
  offeringId?: number
  programName: string
  className: string
  scheduleLabel: string
  priceCents?: number
  priceLabel?: string
  selectedPricingOptionKey?: ProgramPricingOptionKey
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCartItem(value: unknown): value is PublicEnrollmentCartItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<PublicEnrollmentCartItem>
  return (
    isFiniteNumber(row.classEventId) &&
    isFiniteNumber(row.programsId) &&
    isFiniteNumber(row.schedulingFormId) &&
    isFiniteNumber(row.slotGroupId) &&
    isFiniteNumber(row.timeSlotId) &&
    typeof row.programName === 'string' &&
    typeof row.className === 'string' &&
    typeof row.scheduleLabel === 'string'
  )
}

export function loadPublicEnrollmentCart(): PublicEnrollmentCartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PUBLIC_ENROLLMENT_CART_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : []
  } catch {
    return []
  }
}

export function savePublicEnrollmentCart(items: PublicEnrollmentCartItem[]) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(PUBLIC_ENROLLMENT_CART_KEY, JSON.stringify(items))
}

export function clearPublicEnrollmentCart() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(PUBLIC_ENROLLMENT_CART_KEY)
}

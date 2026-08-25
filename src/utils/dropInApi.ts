import { getApiUrl } from './api'
import { getMemberSessionToken } from './portalSession'

export interface DropInClass {
  formId: number
  classId: number
  className: string
  classDescription: string | null
  programId: number
  programName: string | null
  programDescription: string | null
  sportName: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  excludedFromDropIns?: boolean
  monthlyCents: number
  baseCents: number
  discountPercent: number
  discountCents: number
  totalCents: number
}

export interface DropInSession extends DropInClass {
  slotGroupId: number
  offeringId?: number | null
  scheduleDayOfWeek?: number | null
  activeStart?: string | null
  activeEnd?: string | null
  date: string
  startTime: string
  endTime: string
  maxParticipants: number
  monthlyEnrolled: number
  dropInEnrolled: number
  totalAttending: number
  enrolled: number
  spotsRemaining: number
  isFull: boolean
}

export interface DropInBenefits {
  annualMember: boolean
  annualCycleStartedAt?: string | null
  annualCycleExpiresAt?: string | null
  annualCreditsGranted?: number
  annualCreditsRemaining: number
  adminCreditsRemaining: number
  freePassesRemaining?: number
  trialAvailable: boolean
  discountPercent: number
}

function authHeaders(): HeadersInit {
  const token = getMemberSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDropIns(): Promise<{ classes: DropInClass[]; sessions: DropInSession[]; benefits: DropInBenefits }> {
  const response = await fetch(`${getApiUrl()}/api/public/drop-ins`, { headers: authHeaders() })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(body.message || 'Failed to load drop-in classes')
  return body.data
}

export async function registerDropIn(input: {
  slotGroupId: number
  classDate: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  useFreeTrial: boolean
  promoCode?: string
}) {
  const response = await fetch(`${getApiUrl()}/api/public/drop-ins/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(body.message || 'Failed to register')
  return body.data as {
    id: number
    status: string
    benefitType: 'paid' | 'free_trial' | 'annual_credit' | 'admin_credit' | 'free_pass' | 'promo_code'
    totalCents: number
    enrollmentStartDate: string
    accountRequired: boolean
    signupUrl: string | null
  }
}

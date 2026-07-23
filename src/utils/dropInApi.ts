import { getApiUrl } from './api'
import { getMemberSessionToken } from './portalSession'

export interface DropInSession {
  slotGroupId: number
  formId: number
  classId: number
  className: string
  programId: number
  programName: string | null
  sportName: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  date: string
  startTime: string
  endTime: string
  maxParticipants: number
  enrolled: number
  spotsRemaining: number
  isFull: boolean
  monthlyCents: number
  baseCents: number
  discountPercent: number
  discountCents: number
  totalCents: number
}

export interface DropInBenefits {
  annualMember: boolean
  annualCreditsRemaining: number
  trialAvailable: boolean
  discountPercent: number
}

function authHeaders(): HeadersInit {
  const token = getMemberSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDropIns(email?: string): Promise<{ sessions: DropInSession[]; benefits: DropInBenefits }> {
  const query = email ? `?email=${encodeURIComponent(email)}` : ''
  const response = await fetch(`${getApiUrl()}/api/public/drop-ins${query}`, { headers: authHeaders() })
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
    benefitType: 'paid' | 'free_trial' | 'annual_credit'
    totalCents: number
    accountRequired: boolean
    signupUrl: string | null
  }
}

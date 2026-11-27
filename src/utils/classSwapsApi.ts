import { adminApiRequest } from './api'
import type { ClassChangeEmailPreview, ClassChangeNotifications } from './classChangeNotification'

export type ClassSwapMode = 'temporary' | 'permanent'
export type SwapEnrollmentKind = 'recurring' | 'multi_class' | 'trial' | 'drop_in'

export interface SwapEnrollment {
  key: string
  source: 'scheduling' | 'drop_in'
  signupId: number
  formId: number
  slotGroupId: number
  timeSlotId: number | null
  className: string
  programName: string | null
  scheduleLabel: string
  startDate: string | null
  classDate: string | null
  kind: SwapEnrollmentKind
  canPermanent: boolean
  wholeGroup?: boolean
  groupScheduleLabel?: string | null
  requiredReplacementCount?: number
  sourceSchedules?: { timeSlotId: number; scheduleLabel: string }[]
  canSwap?: boolean
  isClassSwap?: boolean
}

export interface SwapStudent {
  key: string
  memberId: number | null
  name: string
  enrollments: SwapEnrollment[]
}

export interface SwapClass {
  key: string
  formId: number
  slotGroupId: number
  timeSlotId: number | null
  className: string
  programName: string | null
  scheduleLabel: string
  date: string | null
  capacity: number | null
  enrolledCount: number
  availableSpots: number | null
}

export interface ClassSwapInput {
  source: SwapEnrollment['source']
  signupId: number
  mode: ClassSwapMode
  effectiveDate: string
  sourceDate?: string
  sourceTimeSlotId?: number | null
  targetFormId: number
  targetSlotGroupId: number
  targetTimeSlotId: number | null
  targetSelections?: { formId: number; slotGroupId: number; timeSlotId: number | null }[]
  reason: string
  emailBody?: string
}

export interface ClassSwapPreview {
  message?: string
  notificationEmail?: ClassChangeEmailPreview
  billingImpact?: {
    sourceFirstPeriodCents: number
    replacementFirstMonthCents: number
    replacementMonthlyCents: number
    resultingBalanceCents: number
    laterSourceCreditCents?: number
    replacementCatchupCents?: number
  } | null
}

const endpoint = '/api/admin/scheduling/class-swaps'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminApiRequest(`${endpoint}${path}`, options)
  const body = await response.json()
  if (!response.ok || body?.success === false) throw new Error(body?.message || 'Unable to load class swaps.')
  return body.data as T
}

export function fetchSwapStudents(signal?: AbortSignal) {
  return request<{ students: SwapStudent[] }>('/students', { signal })
}

export function fetchSwapClasses(mode: ClassSwapMode, effectiveDate: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ mode, effectiveDate })
  return request<{ classes: SwapClass[] }>(`/classes?${query}`, { signal })
}

export function previewClassSwap(input: ClassSwapInput, signal?: AbortSignal) {
  return request<ClassSwapPreview>('/preview', { method: 'POST', body: JSON.stringify(input), signal })
}

export function finalizeClassSwap(input: ClassSwapInput, confirmation: string, requestKey: string) {
  return request<{ message?: string; replayed?: boolean; notifications?: ClassChangeNotifications; notificationSummaryUnavailable?: boolean }>('', {
    method: 'POST', headers: { 'Idempotency-Key': requestKey },
    body: JSON.stringify({ ...input, confirmation, requestKey }),
  })
}

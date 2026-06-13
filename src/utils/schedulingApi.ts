import { adminApiRequest, getApiUrl } from './api'
import { dateInputValue } from './dateUtils'

function normalizeSchedulingDate(value: string | null | undefined): string | null {
  const iso = dateInputValue(value)
  return iso || null
}

export interface SchedulingCategory {
  id: number
  formId: number | null
  name: string
  sortOrder: number
  isActive: boolean
}

export interface SchedulingFormCategory {
  id: number | null
  formId: number | null
  name: string
  sortOrder: number
  isActive: boolean
}

export interface SchedulingTimeSlot {
  id: number
  slotGroupId?: number | null
  formId: number
  categoryId: number | null
  scheduleMode: 'day' | 'date'
  weekLetter: string | null
  dayOfWeek: number | null
  dayName: string | null
  specificDate: string | null
  startTime: string
  endTime: string
  maxParticipants: number
  signupCount: number
  waitlistCount?: number
  spotsRemaining: number
  isFull: boolean
  hasWaitlist?: boolean
  activeStart: string | null
  activeEnd: string | null
  datesTbd: boolean
  inheritsFormDates?: boolean
  isActive: boolean
  displayLabel?: string
}

export interface SchedulingSlotGroup {
  id: number
  formId: number
  categoryId: number | null
  scheduleMode: 'day' | 'date'
  maxParticipants: number
  signupCount: number
  waitlistCount?: number
  spotsRemaining: number
  isFull: boolean
  hasWaitlist?: boolean
  activeStart: string | null
  activeEnd: string | null
  datesTbd: boolean
  inheritsFormDates?: boolean
  isActive: boolean
  displayLabel?: string
  occurrences: SchedulingTimeSlot[]
}

export interface SchedulePreviewWeek {
  weekLetter: string
  days: { dayName: string; times: { startTime: string; endTime: string }[] }[]
}

export interface SlotsByCategory {
  categoryId: number | null
  categoryName: string
  slots: SchedulingTimeSlot[]
  groups?: SchedulingSlotGroup[]
  preview: {
    weeks: SchedulePreviewWeek[]
    specificDates: { date: string; times: { startTime: string; endTime: string }[] }[]
  }
}

export interface SchedulingMonthlyPricing {
  totalSlots: number
  freeSlotsRemaining: number
  costPerSlotMonthly: number
  nonDiscountedMonthly: number
  discountMonthly: number
  discountedMonthly: number
  hasFreeSlots: boolean
  hasPricing: boolean
}

export interface SchedulingFormSummary {
  id: number
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  signupFields: string[]
  mandateWaiver: boolean
  isActive: boolean
  maxSlotsPerUser?: number | null
  slotCostMonthlyCents?: number
  freeSlotsPerUser?: number
}

export interface SchedulingFormDetail extends SchedulingFormSummary {
  categories: SchedulingFormCategory[]
  allCategories?: SchedulingCategory[]
  slotGroups: SchedulingSlotGroup[]
  timeSlots: SchedulingTimeSlot[]
  slotsByCategory: SlotsByCategory[]
  schedulePreview: SlotsByCategory['preview']
}

export interface SchedulingOrphanedSnapshot {
  formTitle: string
  categoryName: string
  slotLabel: string
  occurrences?: {
    weekLetter?: string | null
    dayOfWeek?: number | null
    specificDate?: string | null
    startTime?: string
    endTime?: string
    scheduleMode?: string
  }[]
  activeStart?: string | null
  activeEnd?: string | null
  slotGroupId: number
}

export interface SchedulingOrphanedSignup {
  id: number
  formId: number
  formTitle: string
  memberId?: number | null
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  statusAtOrphaning: 'confirmed' | 'waitlisted' | 'cancelled'
  orphanedAt: string
  orphanedSnapshot: SchedulingOrphanedSnapshot
}

export interface SchedulingSignup {
  id: number
  formId: number
  memberId?: number | null
  categoryId: number | null
  timeSlotId?: number | null
  slotGroupId?: number | null
  responses: Record<string, string | boolean | number | string[]>
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  status: 'confirmed' | 'waitlisted' | 'cancelled'
  signupNumber?: number | null
  maxParticipants?: number | null
  waitlistPosition?: number | null
  totalSlotsForUser?: number
  profileComplete?: boolean
  pricing?: SchedulingMonthlyPricing
  createdAt: string
  categoryName?: string
  slotLabel?: string
  formTitle?: string
  confirmationEmailSentAt?: string | null
  waiverEmailSentAt?: string | null
  promotionEmailSentAt?: string | null
  demotionEmailSentAt?: string | null
}

export interface SchedulingEmailCheckResult {
  exists: boolean
  hasPassword: boolean
  firstName: string | null
  lastName: string | null
  profileComplete: boolean | null
}

export interface SchedulingAuthSession {
  signupAuthToken: string
  memberId: number
  profileComplete: boolean
  firstName: string
  lastName: string
  email: string
}

export interface SlotBatchPayload {
  categoryId: number | null
  offeringId?: number | null
  activeDatesMode: 'inherit' | 'custom' | 'tbd'
  activeStart?: string | null
  activeEnd?: string | null
  scheduleMode: 'day' | 'date'
  maxParticipants: number
  daySchedule?: {
    weeks: {
      weekLetter: string
      days: {
        dayOfWeek: number
        activeStart?: string | null
        activeEnd?: string | null
        times: { startTime: string; endTime: string; maxParticipants?: number }[]
      }[]
    }[]
  }
  dateSchedule?: {
    entries: {
      type: 'single' | 'range'
      date?: string
      startDate?: string
      endDate?: string
      times: { startTime: string; endTime: string; maxParticipants?: number }[]
    }[]
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok || !data.success) {
    if (response.status === 404) {
      throw new Error(
        'Scheduling API is not available on the server yet. Redeploy the Render backend (vortex-backend) from the latest main branch.',
      )
    }
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

export async function fetchPublicSchedulingForms(): Promise<SchedulingFormSummary[]> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/forms`)
  return parseJson(res)
}

export async function fetchPublicSchedulingForm(
  id: number,
  categoryId?: number | null,
  options?: { fromEvent?: boolean },
): Promise<SchedulingFormDetail> {
  const params = new URLSearchParams()
  if (categoryId === null) params.set('uncategorized', '1')
  else if (categoryId != null) params.set('categoryId', String(categoryId))
  if (options?.fromEvent) params.set('fromEvent', '1')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${getApiUrl()}/api/scheduling/forms/${id}${qs}`)
  return parseJson(res)
}

export async function checkSchedulingEmail(
  formId: number,
  email: string,
): Promise<SchedulingEmailCheckResult> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, email }),
  })
  return parseJson(res)
}

export async function loginSchedulingAuth(
  formId: number,
  email: string,
  password: string,
): Promise<SchedulingAuthSession> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, email, password }),
  })
  return parseJson(res)
}

export async function requestSchedulingMagicLink(formId: number, email: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, email }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to send sign-in link')
  }
}

export async function verifySchedulingAuthToken(
  formId: number,
  email: string,
  token: string,
): Promise<SchedulingAuthSession> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/auth/verify-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, email, token }),
  })
  return parseJson(res)
}

export async function submitSchedulingSignup(payload: {
  formId: number
  categoryId: number | null
  slotGroupId: number
  responses: Record<string, string | boolean | number | string[]>
  signupAuthToken?: string
  password?: string
}): Promise<SchedulingSignup> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminFetchSchedulingForms(): Promise<SchedulingFormSummary[]> {
  const res = await adminApiRequest('/api/admin/scheduling/forms')
  return parseJson(res)
}

export async function adminFetchSchedulingForm(id: number): Promise<SchedulingFormDetail> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${id}`)
  return parseJson(res)
}

export async function adminSaveSchedulingForm(
  payload: Partial<SchedulingFormSummary> & { title: string },
  id?: number,
): Promise<SchedulingFormSummary> {
  const res = await adminApiRequest(
    id ? `/api/admin/scheduling/forms/${id}` : '/api/admin/scheduling/forms',
    {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        startDate: normalizeSchedulingDate(payload.startDate),
        endDate: normalizeSchedulingDate(payload.endDate),
        isActive: payload.isActive,
        maxSlotsPerUser: payload.maxSlotsPerUser ?? null,
        slotCostMonthlyCents: payload.slotCostMonthlyCents ?? 0,
        freeSlotsPerUser: payload.freeSlotsPerUser ?? 0,
      }),
    },
  )
  return parseJson(res)
}

export async function adminUpdateSignupFields(
  formId: number,
  signupFields: string[],
  mandateWaiver?: boolean,
): Promise<SchedulingFormSummary> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/signup-fields`, {
    method: 'PUT',
    body: JSON.stringify({ signupFields, mandateWaiver: Boolean(mandateWaiver) }),
  })
  return parseJson(res)
}

export async function adminDeleteSchedulingForm(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete form')
  }
}

export async function adminFetchAllCategories(): Promise<SchedulingCategory[]> {
  const res = await adminApiRequest('/api/admin/scheduling/categories')
  return parseJson(res)
}

export async function adminFetchFormCategories(formId: number): Promise<SchedulingCategory[]> {
  const res = await adminApiRequest(`/api/admin/scheduling/categories?formId=${formId}`)
  return parseJson(res)
}

export async function adminCreateCategory(name: string, formId?: number): Promise<SchedulingCategory> {
  const res = await adminApiRequest('/api/admin/scheduling/categories', {
    method: 'POST',
    body: JSON.stringify({ name, formId }),
  })
  return parseJson(res)
}

export async function adminUpdateCategory(id: number, name: string): Promise<SchedulingCategory> {
  const res = await adminApiRequest(`/api/admin/scheduling/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
  return parseJson(res)
}

export async function adminDeleteCategory(id: number): Promise<void> {
  await adminApiRequest(`/api/admin/scheduling/categories/${id}`, { method: 'DELETE' })
}

export type CategorySelection = number | 'none' | null

export interface SchedulingOffering {
  id: number
  formId: number
  categoryId: number | null
  startDate: string
  endDate: string
  label: string | null
  isSelected: boolean
  createdAt: string
  updatedAt: string
}

export async function adminFetchOfferings(
  formId: number,
  categoryId?: number | null,
): Promise<SchedulingOffering[]> {
  const qs =
    categoryId === null
      ? '?categoryId=none'
      : categoryId != null
        ? `?categoryId=${categoryId}`
        : ''
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/offerings${qs}`)
  return parseJson(res)
}

export async function adminCreateOffering(
  formId: number,
  payload: { categoryId: number | null; startDate: string; endDate: string; label?: string | null },
): Promise<SchedulingOffering> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/offerings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminUpdateOffering(
  id: number,
  payload: Partial<{ startDate: string; endDate: string; label: string | null }>,
): Promise<SchedulingOffering> {
  const res = await adminApiRequest(`/api/admin/scheduling/offerings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminSelectOffering(id: number): Promise<SchedulingOffering> {
  const res = await adminApiRequest(`/api/admin/scheduling/offerings/${id}/select`, {
    method: 'PATCH',
  })
  return parseJson(res)
}

export async function adminDeleteOffering(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/offerings/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete offering')
  }
}

export async function adminCreateSlotBatch(
  formId: number,
  payload: SlotBatchPayload,
): Promise<SchedulingSlotGroup> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/slot-batches`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.message || 'Failed')
  return data.data
}

export async function adminUpdateTimeSlot(
  id: number,
  payload: SlotBatchPayload,
): Promise<SchedulingTimeSlot> {
  const res = await adminApiRequest(`/api/admin/scheduling/time-slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminDeleteTimeSlot(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/time-slots/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete time slot')
  }
}

export async function adminDeleteSlotGroup(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/slot-groups/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete time slot')
  }
}

export async function adminFetchSignups(formId?: number): Promise<SchedulingSignup[]> {
  const qs = formId ? `?formId=${formId}` : ''
  const res = await adminApiRequest(`/api/admin/scheduling/signups${qs}`)
  return parseJson(res)
}

export async function adminFetchOrphanedSignups(formId: number): Promise<SchedulingOrphanedSignup[]> {
  const res = await adminApiRequest(`/api/admin/scheduling/orphaned-signups?formId=${formId}`)
  return parseJson(res)
}

export async function adminReEnrollOrphanedSignup(
  orphanId: number,
  payload: { targetFormId: number; categoryId: number | null; slotGroupId: number },
): Promise<SchedulingSignup> {
  const res = await adminApiRequest(`/api/admin/scheduling/orphaned-signups/${orphanId}/re-enroll`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminDeleteOrphanedSignup(orphanId: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/orphaned-signups/${orphanId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to remove orphaned signup')
  }
}

export async function adminUpdateSignupStatus(
  id: number,
  status: 'confirmed' | 'cancelled',
): Promise<SchedulingSignup> {
  const res = await adminApiRequest(`/api/admin/scheduling/signups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return parseJson(res)
}

export async function adminResendSignupEmail(
  id: number,
  emailType: 'confirmation' | 'waiver',
): Promise<SchedulingSignup> {
  const res = await adminApiRequest(`/api/admin/scheduling/signups/${id}/resend-email`, {
    method: 'POST',
    body: JSON.stringify({ emailType }),
  })
  return parseJson(res)
}

export async function adminUpdateSignupMemberPassword(
  signupId: number,
  password: string,
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/signups/${signupId}/member-password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update password')
  }
}

export async function adminUpdateSlotGroupMax(
  id: number,
  maxParticipants: number,
): Promise<SchedulingSlotGroup> {
  const res = await adminApiRequest(`/api/admin/scheduling/slot-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ maxParticipants }),
  })
  return parseJson(res)
}

export const SCHEDULING_DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export const DAY_ABBREVIATIONS = ['Sun', 'M', 'Tu', 'W', 'Th', 'F', 'Sat'] as const

export function dayAbbrev(dayOfWeek: number | null | undefined): string | null {
  if (dayOfWeek == null) return null
  return DAY_ABBREVIATIONS[dayOfWeek] ?? null
}

/** True when day-mode slots span more than one week letter (e.g. A and B). */
export function schedulingHasMultipleWeeks(groups: SchedulingSlotGroup[]): boolean {
  const letters = new Set<string>()
  for (const group of groups) {
    if (group.scheduleMode === 'date') continue
    for (const occ of group.occurrences) {
      letters.add(occ.weekLetter || 'A')
    }
  }
  return letters.size > 1
}

/** User-facing occurrence label; week letter only when multiple weeks exist. */
export function formatSchedulingOccurrenceLabel(
  occ: SchedulingTimeSlot,
  options: { includeWeek: boolean; formatTime?: (time: string) => string },
): string {
  const formatTime =
    options.formatTime ??
    ((time: string) => {
      const [h, m] = time.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      return `${hour}:${String(m).padStart(2, '0')} ${period}`
    })

  const parts: string[] = []
  if (options.includeWeek && occ.weekLetter) {
    parts.push(`${occ.weekLetter}-Week`)
  }
  if (occ.scheduleMode === 'date' && occ.specificDate) {
    parts.push(occ.specificDate)
  } else if (occ.dayName) {
    parts.push(occ.dayName)
  } else if (occ.dayOfWeek != null) {
    parts.push(SCHEDULING_DAYS.find((d) => d.value === occ.dayOfWeek)?.label ?? '')
  }
  if (occ.startTime && occ.endTime) {
    parts.push(`${formatTime(occ.startTime)} – ${formatTime(occ.endTime)}`)
  }
  return parts.filter(Boolean).join(' · ')
}

export const WEEK_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

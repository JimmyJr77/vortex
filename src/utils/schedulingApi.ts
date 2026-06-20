import { adminApiRequest, getApiUrl } from './api'
import { dateInputValue } from './dateUtils'
import { ENROLL_PATH, type EnrollSiteKey } from '../config/enrollSites'
import { getCurrentEnrollSiteKey } from './enrollSite'
import {
  adaptCategoryUpdateForApi,
  adaptFormEnrollSitesBody,
  getSchedulingEnrollApiCapabilities,
} from './schedulingEnrollApi'

export type { EnrollSiteKey }

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
  enrollSites?: EnrollSiteKey[]
}

export const NO_CATEGORY_NAME = 'No Category'

export function isNoCategoryCategory(cat: Pick<SchedulingCategory, 'formId' | 'name'>): boolean {
  return cat.formId == null && cat.name === NO_CATEGORY_NAME
}

export function isNoCategorySelection(
  categoryId: number | null | undefined,
  categoryName?: string | null,
  categories: SchedulingCategory[] = [],
): boolean {
  if (categoryId == null) return true
  if (categoryName === NO_CATEGORY_NAME) return true
  const match = categories.find((cat) => cat.id === categoryId)
  return match != null && isNoCategoryCategory(match)
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
  offeringId?: number | null
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
  hoursPerSlotMonthly?: number | null
  costUnit?: CostUnit | null
}

export interface SignupOrderPreviewClass {
  id?: number
  formId: number
  formTitle: string
  categoryName: string
  slotLabel: string
  slotKey?: string
  slotGroupId?: number
  timeSlotId?: number | null
  offeringId?: number | null
  status?: string
  incrementalMonthly?: number
  passCreditCents?: number
  passItems?: FreePassLineItem[]
  hoursPerMonth?: number | null
  isNew: boolean
}

export interface SignupOrderPreviewFormSummary {
  formId: number
  formTitle: string
  existingSlotCount: number
  newSlotCount: number
  totalSlotCount: number
  pricingBefore: SchedulingMonthlyPricing | null
  pricingAfter: SchedulingMonthlyPricing | null
  incrementalMonthly: number
  discountMonthly: number
}

export interface OrderDiscountAppliedLine {
  ruleId: number
  name: string
  type: string
  amountCents: number
  kind: 'discount' | 'free'
}

export interface OrderDiscountLine {
  key: string
  baseCents: number
  discountCents: number
  finalCents: number
  applied: OrderDiscountAppliedLine[]
}

export interface OrderDiscountSummary {
  ruleId: number
  name: string
  type: string
  amountCents: number
}

export interface OrderDiscountBreakdown {
  enabled: boolean
  lines: OrderDiscountLine[]
  orderDiscounts: OrderDiscountSummary[]
  freeGrants: Array<{ ruleId: number; lineKey: string; unit: string; quantity: number; amountCents: number }>
  subtotalCents: number
  totalDiscountCents: number
  totalCents: number
}

export type AdditionalFeeApplyBasis =
  | 'per_order'
  | 'per_slot'
  | 'per_class'
  | 'per_offering'
  | 'per_month'
  | 'per_year'

export type AdditionalFeeTriggerType = 'each_enrollment' | 'new_member' | 'once_per_year'

export interface AdditionalFee {
  id: number
  facilityId: number | null
  name: string
  description: string | null
  amountCents: number
  applyBasis: AdditionalFeeApplyBasis
  applyInterval: number
  triggerType: AdditionalFeeTriggerType
  scopeLevel: DiscountScopeLevel
  scopeRefId: number | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
  priority: number
  config: Record<string, unknown>
}

export type AdditionalFeeInput = Omit<AdditionalFee, 'id' | 'facilityId'>

export interface AdditionalFeeLineItem {
  feeId: number
  name: string
  applyBasis: AdditionalFeeApplyBasis
  applyInterval: number
  triggerType: AdditionalFeeTriggerType
  quantity: number
  amountCents: number
  recurring: boolean
  scopeLevel: DiscountScopeLevel
}

export interface AdditionalFeesBreakdown {
  enabled: boolean
  items: AdditionalFeeLineItem[]
  totalOneTimeCents: number
  totalMonthlyCents: number
  totalCents: number
}

export interface SignupOrderPreview {
  memberId: number | null
  existingClasses: SignupOrderPreviewClass[]
  newSignups: SignupOrderPreviewClass[]
  formSummaries: SignupOrderPreviewFormSummary[]
  existingMonthlyTotal: number
  newSignupMonthlyTotal: number
  estimatedMonthlyTotal: number
  totalDiscountMonthly: number
  freePasses?: FreePassBreakdown
  discounts?: OrderDiscountBreakdown
  additionalFees?: AdditionalFeesBreakdown
  additionalFeesMonthly?: number
  additionalFeesOneTime?: number
  hasPricing: boolean
  disclaimer: string
}

export type FreePassBenefitUnit = 'slot' | 'offering' | 'day' | 'week' | 'month' | 'hour'
export type FreePassApplicationMethod = 'waive_enrollment' | 'monthly_prorate'
export type FreePassScopeLevel = 'global' | 'sport' | 'program' | 'class' | 'offering'

export interface FreePassTemplate {
  id: number
  facilityId: number | null
  name: string
  description: string | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
  benefitUnit: FreePassBenefitUnit
  benefitQuantity: number
  applicationMethod: FreePassApplicationMethod
  scopeLevel: FreePassScopeLevel
  scopeRefId: number | null
  dayOfWeek: number | null
  offeringIds: number[]
  eligibility: Record<string, unknown>
  issuance: Record<string, unknown>
  debitsFreeClassAllowance: boolean
  stackable: boolean
  exclusivityGroup: string | null
  maxRedemptions: number | null
  maxRedemptionsPerMember: number | null
  redeemedCount: number
  config: Record<string, unknown>
}

export type FreePassTemplateInput = Omit<
  FreePassTemplate,
  'id' | 'facilityId' | 'redeemedCount'
>

export interface FreePassAttachment {
  id?: number
  scopeLevel: 'program' | 'class'
  scopeRefId: number
  passTemplateId: number
  autoApply: boolean
  sortOrder: number
}

export type BenefitScopeLevel = 'sport' | 'program' | 'class' | 'category'

export interface PricingBenefitSelection {
  id?: number
  scopeLevel: BenefitScopeLevel
  scopeRefId: number
  benefitType: 'discount_rule' | 'free_pass'
  benefitId: number
  autoApply: boolean
  allowMemberCode: boolean
  sortOrder: number
}

export interface PricingBenefitSelectionInput {
  benefitType: 'discount_rule' | 'free_pass'
  benefitId: number
  autoApply: boolean
  allowMemberCode: boolean
  sortOrder?: number
}

export interface MemberFreePassGrant {
  id: number
  memberId: number
  passTemplateId: number
  quantityGranted: number
  quantityRemaining: number
  issuedAt: string
  expiresAt: string | null
  issuedBy: 'promo' | 'admin' | 'auto'
  sourceRef: string | null
  templateName: string | null
}

export interface FreePassLineItem {
  lineKey: string
  templateId: number
  templateName: string
  creditCents: number
  benefitUnit: FreePassBenefitUnit
  prorated?: boolean
}

export interface FreePassBreakdown {
  enabled: boolean
  items: FreePassLineItem[]
  totalCreditCents: number
  redemptions: Array<Record<string, unknown>>
}

export const FREE_PASS_BENEFIT_LABELS: Record<FreePassBenefitUnit, string> = {
  slot: 'Slot (full enrollment)',
  offering: 'Offering (full run)',
  day: 'Day(s)',
  week: 'Week(s)',
  month: 'Month(s)',
  hour: 'Hour(s)',
}

export const DAY_OF_WEEK_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export type CostUnit =
  | 'per_slot'
  | 'per_class'
  | 'per_week'
  | 'per_month'
  | 'per_offering'
  | 'per_hour'

export const COST_UNIT_LABELS: Record<CostUnit, string> = {
  per_slot: 'Per slot',
  per_class: 'Per class',
  per_week: 'Per week',
  per_month: 'Per month',
  per_offering: 'Per offering',
  per_hour: 'Per hour',
}

export const COST_AMOUNT_LABELS: Record<CostUnit, string> = {
  per_slot: 'Cost ($)',
  per_class: 'Cost ($)',
  per_week: 'Cost per week ($)',
  per_month: 'Cost per month ($)',
  per_offering: 'Cost per offering ($)',
  per_hour: 'Cost per hour ($)',
}

export type DiscountType =
  | 'promo_code'
  | 'school'
  | 'city'
  | 'multi_class'
  | 'multi_child'
  | 'free_classes'

export type DiscountAmountType = 'percent' | 'fixed'
export type DiscountApplyTo = 'per_class' | 'order_total'
export type DiscountCalcBase = 'pre' | 'post'
export type DiscountScopeLevel = 'global' | 'sport' | 'program' | 'class' | 'offering'

export interface DiscountRuleTier {
  id?: number
  threshold: number
  amountType: DiscountAmountType
  amountValue: number
}

export interface DiscountRuleConfig {
  code?: string
  discountKind?: 'amount' | 'free_access'
  amount_applies_to?: string
  benefit_type?: string
  application_method?: string
  class_offering_ids?: number[]
  eligibility_rules?: Array<{
    field: 'school' | 'graduation_year' | 'grade_level'
    operator: 'is' | 'is_not' | 'in' | 'not_in'
    value: string | number | string[] | number[]
  }>
  school_names?: string[]
  match?: 'exact' | 'contains'
  cities?: string[]
  grant_unit?: 'days' | 'weeks' | 'months' | 'offering' | 'slot'
  quantity?: number
  offering_id?: number | null
  [key: string]: unknown
}

export interface DiscountRule {
  id: number
  facilityId: number | null
  name: string
  description: string | null
  type: DiscountType
  amountType: DiscountAmountType
  amountValue: number
  applyTo: DiscountApplyTo
  calcBase: DiscountCalcBase
  priority: number
  stackable: boolean
  exclusivityGroup: string | null
  maxDiscountCents: number | null
  scopeLevel: DiscountScopeLevel
  scopeRefId: number | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  redeemedCount: number
  config: DiscountRuleConfig
  tiers: DiscountRuleTier[]
}

export type DiscountRuleInput = Omit<DiscountRule, 'id' | 'facilityId' | 'redeemedCount'>

export interface DiscountGlobalSettings {
  maxFreeUnitsTotal: number | null
  maxDiscountRedemptionsTotal: number | null
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
  enrollSites?: EnrollSiteKey[]
  programsId?: number | null
  programDisplayName?: string | null
  classDisplayName?: string | null
  maxSlotsPerUser?: number | null
  slotCostMonthlyCents?: number
  costUnit?: CostUnit
  freeSlotsPerUser?: number
  maxFreeSlotsTotal?: number | null
  pricingOverridesProgram?: boolean
  formMaxSlotsPerUser?: number | null
  formSlotCostMonthlyCents?: number
  formCostUnit?: CostUnit | null
  formFreeSlotsPerUser?: number
  formMaxFreeSlotsTotal?: number | null
  programMaxSlotsPerUser?: number | null
  programSlotCostMonthlyCents?: number
  programCostUnit?: CostUnit | null
  programFreeSlotsPerUser?: number
  programMaxFreeSlotsTotal?: number | null
}

export interface LegacySchedulingForm extends SchedulingFormSummary {
  programId: number | null
  programsId: number | null
  eventLinked: boolean
  signupCount: number
  slotGroupCount: number
}

export interface SchedulingFormDetail extends SchedulingFormSummary {
  categories: SchedulingFormCategory[]
  allCategories?: SchedulingCategory[]
  slotGroups: SchedulingSlotGroup[]
  timeSlots: SchedulingTimeSlot[]
  slotsByCategory: SlotsByCategory[]
  schedulePreview: SlotsByCategory['preview']
}

export type CalendarFormActiveFilter = 'all' | 'active' | 'inactive'

export interface PublicSchedulingClassOption {
  id: number
  displayName: string
  programName: string | null
  formId: number
}

export function schedulingSignupPath(
  formId: number,
  categoryId?: number | null,
): string {
  return schedulingEnrollPath({ formId, categoryId })
}

export function schedulingEnrollPath(options?: {
  formId?: number
  programsId?: number
  categoryId?: number | null
}): string {
  if (!options?.formId && options?.programsId == null) {
    return ENROLL_PATH
  }
  const params = new URLSearchParams()
  if (options.formId != null) {
    params.set('form', String(options.formId))
  } else if (options.programsId != null) {
    params.set('programsId', String(options.programsId))
  }
  if (options.categoryId != null) {
    params.set('categoryId', String(options.categoryId))
  }
  return `${ENROLL_PATH}?${params.toString()}`
}

export function buildSchedulingSignupUrl(
  formId: number,
  categoryId?: number | null,
): string {
  const path = schedulingSignupPath(formId, categoryId)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return path
}

export interface SchedulingCalendarEvent {
  id: string
  date: string
  startTime: string
  endTime: string
  formId: number
  classEventId: number | null
  programsId: number | null
  programName: string | null
  className: string
  classDescription: string | null
  skillLevel: string | null
  ageMin: number | null
  ageMax: number | null
  categoryId: number | null
  categoryName: string | null
  offeringLabel: string | null
  offeringStartDate: string | null
  offeringEndDate: string | null
  formActive: boolean
  enrollVisible?: boolean
  classActive: boolean
  slotGroupActive: boolean
  slotActive: boolean
  weekLetter?: string | null
}

export interface SchedulingCalendarTbd {
  formId: number
  classEventId: number | null
  programsId: number | null
  programName: string | null
  className: string
  classDescription: string | null
  categoryId: number | null
  categoryName: string | null
  offeringLabel: string | null
  formActive: boolean
  enrollVisible?: boolean
  classActive: boolean
  slotGroupActive: boolean
  scheduleMode: 'day' | 'date'
  weekLetter: string | null
  dayOfWeek: number | null
  dayName: string | null
  startTime: string
  endTime: string
}

export interface SchedulingCalendarMonth {
  year: number
  month: number
  startDate: string
  endDate: string
  events: SchedulingCalendarEvent[]
  tbdPatterns: SchedulingCalendarTbd[]
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
  adminStub?: boolean
  pricing?: SchedulingMonthlyPricing
  createdAt: string
  categoryName?: string
  slotLabel?: string
  formTitle?: string
  confirmationEmailSentAt?: string | null
  waiverEmailSentAt?: string | null
  promotionEmailSentAt?: string | null
  demotionEmailSentAt?: string | null
  archivedAt?: string | null
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
  mustChangePassword?: boolean
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

export interface SchedulingSignupCompleteDetail {
  completed: boolean
  formId?: number
  formIds?: number[]
  email?: string
}

export interface ProgramClassSlotOption {
  slotGroupId: number
  timeSlotId: number
  label: string
  isFull: boolean
  spotsRemaining: number
  waitlistCount: number
  alreadySignedUp?: boolean
  scheduleMode: 'day' | 'date'
  dayOfWeek: number | null
  dayName: string | null
  specificDate: string | null
  startTime: string
  endTime: string
  weekLetter: string | null
}

export interface ProgramClassOption {
  key: string
  formId: number
  formTitle: string
  categoryId: number | null
  categoryName: string
  slots: ProgramClassSlotOption[]
}

export interface ProgramSignupOptions {
  programsId: number | null
  options: ProgramClassOption[]
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok || !data.success) {
    if (response.status === 404) {
      throw new Error(
        'This scheduling endpoint is not on the server yet (404). Redeploy the Render backend (vortex-backend) from the latest main branch, then confirm /api/health shows schedulingFreePasses: true and schedulingBenefitSelections: true.',
      )
    }
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

export async function fetchPublicSchedulingForms(
  site: EnrollSiteKey = getCurrentEnrollSiteKey(),
): Promise<SchedulingFormSummary[]> {
  const res = await fetch(
    `${getApiUrl()}/api/scheduling/forms?site=${encodeURIComponent(site)}`,
  )
  return parseJson(res)
}

const SCHEDULING_MEMBER_EMAIL_KEY = 'vortex_scheduling_member_email'

export function saveSchedulingMemberEmail(email: string): void {
  try {
    localStorage.setItem(SCHEDULING_MEMBER_EMAIL_KEY, email.trim().toLowerCase())
  } catch {
    /* private browsing / storage blocked */
  }
}

export function getSchedulingMemberEmail(): string | null {
  try {
    return localStorage.getItem(SCHEDULING_MEMBER_EMAIL_KEY)
  } catch {
    return null
  }
}

export interface MemberSchedulingSignup {
  formId: number
  categoryId: number | null
  slotGroupId: number
  timeSlotId: number | null
}

export function memberSignupSlotKey(signup: {
  formId: number
  categoryId: number | null
  slotGroupId: number
  timeSlotId: number | null
}): string {
  return `${signup.formId}:${signup.categoryId ?? 'none'}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
}

/** Active slot-level signups for this email. */
export async function fetchMySchedulingSignups(email: string): Promise<MemberSchedulingSignup[]> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/my-signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = await parseJson<{ signups: MemberSchedulingSignup[]; formIds: number[] }>(res)
  return data.signups ?? []
}

export async function fetchSignupOrderPreview(payload: {
  formId: number
  email?: string
  signupAuthToken?: string
  signups: Array<{
    formId: number
    categoryId: number | null
    slotGroupId: number
    timeSlotId?: number
  }>
  promoCodes?: string[]
  currentSchool?: string | null
  graduationYear?: number | null
}): Promise<SignupOrderPreview> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/signups/order-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: payload.formId,
      email: payload.email?.trim().toLowerCase(),
      signupAuthToken: payload.signupAuthToken,
      signups: payload.signups,
      promoCodes: payload.promoCodes ?? [],
      currentSchool: payload.currentSchool ?? null,
      graduationYear: payload.graduationYear ?? null,
    }),
  })
  return parseJson(res)
}

export async function validateSchedulingPromoCode(code: string): Promise<{
  valid: boolean
  message?: string
  code?: string
  ruleId?: number
  name?: string
  amountType?: DiscountAmountType
  amountValue?: number
}> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/promo/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  return parseJson(res)
}

/** @deprecated Prefer fetchMySchedulingSignups for slot-level state. */
export async function fetchMySchedulingFormIds(email: string): Promise<number[]> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/my-signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const data = await parseJson<{ formIds: number[] }>(res)
  return data.formIds ?? []
}

export async function fetchPublicSchedulingOfferings(
  formId: number,
  categoryId?: number | null,
  site: EnrollSiteKey = getCurrentEnrollSiteKey(),
): Promise<SchedulingOffering[]> {
  const params = new URLSearchParams()
  params.set('site', site)
  if (categoryId === null) params.set('categoryId', 'none')
  else if (categoryId != null) params.set('categoryId', String(categoryId))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${getApiUrl()}/api/scheduling/forms/${formId}/offerings${qs}`)
  return parseJson(res)
}

export async function fetchPublicSchedulingForm(
  id: number,
  categoryId?: number | null,
  options?: { fromEvent?: boolean; site?: EnrollSiteKey },
): Promise<SchedulingFormDetail> {
  const params = new URLSearchParams()
  params.set('site', options?.site ?? getCurrentEnrollSiteKey())
  if (categoryId === null) params.set('uncategorized', '1')
  else if (categoryId != null) params.set('categoryId', String(categoryId))
  if (options?.fromEvent) params.set('fromEvent', '1')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${getApiUrl()}/api/scheduling/forms/${id}${qs}`)
  return parseJson(res)
}

export async function fetchProgramSignupOptions(
  formId: number,
  options?: { email?: string },
): Promise<ProgramSignupOptions> {
  const params = new URLSearchParams()
  if (options?.email) params.set('email', options.email.trim().toLowerCase())
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${getApiUrl()}/api/scheduling/forms/${formId}/program-options${qs}`)
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

export async function changeSchedulingAuthPassword(
  formId: number,
  signupAuthToken: string,
  password: string,
): Promise<SchedulingAuthSession> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, signupAuthToken, password }),
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
  timeSlotId?: number
  responses: Record<string, string | boolean | number | string[]>
  signupAuthToken?: string
  password?: string
  promoCodes?: string[]
}): Promise<SchedulingSignup> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function submitSchedulingSignupBatch(payload: {
  signups: Array<{
    formId: number
    categoryId: number | null
    slotGroupId: number
    timeSlotId?: number
  }>
  responses: Record<string, string | boolean | number | string[]>
  signupAuthToken?: string
  password?: string
  promoCodes?: string[]
}): Promise<{ signups: SchedulingSignup[] }> {
  const res = await fetch(`${getApiUrl()}/api/scheduling/signups/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminFetchDiscountRules(): Promise<{
  rules: DiscountRule[]
  globalSettings: DiscountGlobalSettings
}> {
  const res = await adminApiRequest('/api/admin/scheduling/discount-rules')
  return parseJson(res)
}

export async function adminCreateDiscountRule(input: DiscountRuleInput): Promise<DiscountRule> {
  const res = await adminApiRequest('/api/admin/scheduling/discount-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminUpdateDiscountRule(
  id: number,
  input: DiscountRuleInput,
): Promise<DiscountRule> {
  const res = await adminApiRequest(`/api/admin/scheduling/discount-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminDeleteDiscountRule(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/discount-rules/${id}`, {
    method: 'DELETE',
  })
  await parseJson(res)
}

export async function adminUpdateDiscountSettings(
  settings: DiscountGlobalSettings,
): Promise<void> {
  const res = await adminApiRequest('/api/admin/scheduling/discount-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
  await parseJson(res)
}

export interface SportPricingDefault {
  disciplineTagId: number
  name: string
  costAmountCents: number
  costUnit: CostUnit
  freeSlotsPerUser: number
  maxFreeSlotsTotal: number | null
  maxDiscountRedemptions: number | null
  configured: boolean
}

export async function adminFetchSportDefaults(): Promise<SportPricingDefault[]> {
  const res = await adminApiRequest('/api/admin/scheduling/sport-defaults')
  return parseJson(res)
}

export async function adminUpsertSportDefault(
  disciplineTagId: number,
  input: {
    costAmountCents: number
    costUnit: CostUnit
    freeSlotsPerUser: number
    maxFreeSlotsTotal: number | null
    maxDiscountRedemptions: number | null
  },
): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/sport-defaults/${disciplineTagId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  await parseJson(res)
}

export async function adminFetchAdditionalFees(): Promise<AdditionalFee[]> {
  const res = await adminApiRequest('/api/admin/scheduling/additional-fees')
  const data = await parseJson<{ fees: AdditionalFee[] }>(res)
  return data.fees
}

export async function adminCreateAdditionalFee(input: AdditionalFeeInput): Promise<AdditionalFee> {
  const res = await adminApiRequest('/api/admin/scheduling/additional-fees', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminUpdateAdditionalFee(
  id: number,
  input: AdditionalFeeInput,
): Promise<AdditionalFee> {
  const res = await adminApiRequest(`/api/admin/scheduling/additional-fees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminDeleteAdditionalFee(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/additional-fees/${id}`, {
    method: 'DELETE',
  })
  await parseJson(res)
}

export async function adminFetchFreePasses(): Promise<FreePassTemplate[]> {
  const res = await adminApiRequest('/api/admin/scheduling/free-passes')
  return parseJson(res)
}

export async function adminCreateFreePass(input: FreePassTemplateInput): Promise<FreePassTemplate> {
  const res = await adminApiRequest('/api/admin/scheduling/free-passes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminUpdateFreePass(
  id: number,
  input: FreePassTemplateInput,
): Promise<FreePassTemplate> {
  const res = await adminApiRequest(`/api/admin/scheduling/free-passes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

export async function adminDeleteFreePass(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/free-passes/${id}`, {
    method: 'DELETE',
  })
  await parseJson(res)
}

export async function adminFetchPassAttachments(
  scopeLevel: 'program' | 'class',
  scopeRefId: number,
): Promise<FreePassAttachment[]> {
  const res = await adminApiRequest(
    `/api/admin/scheduling/pricing-pass-attachments?scopeLevel=${scopeLevel}&scopeRefId=${scopeRefId}`,
  )
  return parseJson(res)
}

export async function adminSavePassAttachments(payload: {
  scopeLevel: 'program' | 'class'
  scopeRefId: number
  attachments: Array<{
    passTemplateId: number
    autoApply?: boolean
    sortOrder?: number
  }>
}): Promise<FreePassAttachment[]> {
  const res = await adminApiRequest('/api/admin/scheduling/pricing-pass-attachments', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminFetchBenefitSelections(
  scopeLevel: BenefitScopeLevel,
  scopeRefId: number,
): Promise<PricingBenefitSelection[]> {
  const res = await adminApiRequest(
    `/api/admin/scheduling/pricing-benefit-selections?scopeLevel=${scopeLevel}&scopeRefId=${scopeRefId}`,
  )
  return parseJson(res)
}

export async function adminSaveBenefitSelections(payload: {
  scopeLevel: BenefitScopeLevel
  scopeRefId: number
  selections: PricingBenefitSelectionInput[]
}): Promise<PricingBenefitSelection[]> {
  const res = await adminApiRequest('/api/admin/scheduling/pricing-benefit-selections', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminFetchMemberFreePasses(memberId: number): Promise<MemberFreePassGrant[]> {
  const res = await adminApiRequest(`/api/admin/scheduling/members/${memberId}/free-passes`)
  return parseJson(res)
}

export async function adminIssueMemberFreePass(
  memberId: number,
  payload: { passTemplateId: number; quantity?: number; expiresAt?: string | null; sourceRef?: string },
): Promise<MemberFreePassGrant> {
  const res = await adminApiRequest(`/api/admin/scheduling/members/${memberId}/free-passes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminSimulateFreePasses(payload: {
  promoCodes?: string[]
  isNewMember?: boolean
  lines: Array<{
    key?: string
    formId?: number | null
    programId?: number | null
    sportId?: number | null
    offeringId?: number | null
    slotGroupId?: number | null
    timeSlotId?: number | null
    memberId?: number | null
    memberSchool?: string | null
    memberGraduationYear?: number | null
    baseCents: number
  }>
}): Promise<FreePassBreakdown> {
  const res = await adminApiRequest('/api/admin/scheduling/free-passes/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export interface MemberPricingSignupRow {
  id: number
  formTitle: string
  categoryName: string
  slotLabel: string
  pricingBreakdown: {
    line?: OrderDiscountLine
    orderDiscounts?: OrderDiscountSummary[]
    totals?: { subtotalCents: number; totalDiscountCents: number; totalCents: number }
  } | null
}

export interface MemberPricingSummary {
  member: { id: number; firstName: string; lastName: string }
  preview: SignupOrderPreview
  signupRows: MemberPricingSignupRow[]
}

export async function adminFetchMemberPricingSummary(memberId: number): Promise<MemberPricingSummary> {
  const res = await adminApiRequest(`/api/admin/scheduling/members/${memberId}/pricing-summary`)
  return parseJson(res)
}

export async function adminSimulateDiscountOrder(payload: {
  promoCodes?: string[]
  lines: Array<{
    key?: string
    formId?: number | null
    programId?: number | null
    sportId?: number | null
    offeringId?: number | null
    memberCity?: string | null
    memberSchool?: string | null
    classOrdinal?: number
    childOrdinal?: number
    baseCents: number
  }>
}): Promise<OrderDiscountBreakdown> {
  const res = await adminApiRequest('/api/admin/scheduling/discount-simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseJson(res)
}

export async function adminFetchSchedulingForms(): Promise<SchedulingFormSummary[]> {
  const res = await adminApiRequest('/api/admin/scheduling/forms')
  return parseJson(res)
}

export async function fetchPublicSchedulingCalendar(params: {
  year?: number
  month?: number
  startDate?: string
  endDate?: string
  programsId?: number | null
  programId?: number | null
}): Promise<SchedulingCalendarMonth> {
  const qs = new URLSearchParams()
  if (params.startDate && params.endDate) {
    qs.set('startDate', params.startDate)
    qs.set('endDate', params.endDate)
  } else if (params.year != null && params.month != null) {
    qs.set('year', String(params.year))
    qs.set('month', String(params.month))
  }
  if (params.programsId != null) {
    qs.set('programsId', String(params.programsId))
  }
  if (params.programId != null) {
    qs.set('programId', String(params.programId))
  }
  qs.set('site', getCurrentEnrollSiteKey())
  const res = await fetch(`${getApiUrl()}/api/scheduling/calendar?${qs.toString()}`)
  return parseJson(res)
}

export async function fetchPublicSchedulingClasses(): Promise<PublicSchedulingClassOption[]> {
  const res = await fetch(`${getApiUrl()}/api/public/scheduling/classes`)
  return parseJson(res)
}

export async function adminFetchSchedulingCalendar(params: {
  year?: number
  month?: number
  startDate?: string
  endDate?: string
  programsId?: number | null
  programId?: number | null
  formActive?: CalendarFormActiveFilter
}): Promise<SchedulingCalendarMonth> {
  const qs = new URLSearchParams({
    formActive: params.formActive ?? 'all',
  })
  if (params.startDate && params.endDate) {
    qs.set('startDate', params.startDate)
    qs.set('endDate', params.endDate)
  } else if (params.year != null && params.month != null) {
    qs.set('year', String(params.year))
    qs.set('month', String(params.month))
  }
  if (params.programsId != null) {
    qs.set('programsId', String(params.programsId))
  }
  if (params.programId != null) {
    qs.set('programId', String(params.programId))
  }
  const res = await adminApiRequest(`/api/admin/scheduling/calendar?${qs.toString()}`)
  return parseJson(res)
}

export async function adminFetchLegacySchedulingForms(): Promise<LegacySchedulingForm[]> {
  const res = await adminApiRequest('/api/admin/scheduling/legacy-forms')
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
        costUnit: payload.costUnit ?? undefined,
        freeSlotsPerUser: payload.freeSlotsPerUser ?? 0,
        maxFreeSlotsTotal: payload.maxFreeSlotsTotal ?? null,
        pricingOverridesProgram: payload.pricingOverridesProgram,
      }),
    },
  )
  return parseJson(res)
}

export async function resetClassPricing(formId: number): Promise<SchedulingFormSummary> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/pricing/reset`, {
    method: 'POST',
  })
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

export async function adminSetSchedulingFormEnrollSites(
  formId: number,
  enrollSites: EnrollSiteKey[],
): Promise<SchedulingFormSummary> {
  const capabilities = await getSchedulingEnrollApiCapabilities()
  const body = adaptFormEnrollSitesBody(enrollSites, capabilities.schedulingEnrollSites)
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/active`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return parseJson(res)
}

/** @deprecated Use adminSetSchedulingFormEnrollSites */
export async function adminSetSchedulingFormActive(
  formId: number,
  isActive: boolean,
): Promise<SchedulingFormSummary> {
  const res = await adminApiRequest(`/api/admin/scheduling/forms/${formId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
  return parseJson(res)
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

export async function adminLinkCategoryToForm(formId: number, categoryId: number): Promise<void> {
  const res = await adminApiRequest(
    `/api/admin/scheduling/forms/${formId}/categories/${categoryId}/link`,
    { method: 'POST' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to link category to form')
  }
}

export async function adminUpdateCategory(
  id: number,
  payload: { name: string; sortOrder?: number; isActive?: boolean; enrollSites?: EnrollSiteKey[] },
): Promise<SchedulingCategory> {
  const capabilities = await getSchedulingEnrollApiCapabilities()
  const apiPayload = adaptCategoryUpdateForApi(payload, capabilities.schedulingEnrollSites)
  const res = await adminApiRequest(`/api/admin/scheduling/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(apiPayload),
  })
  return parseJson(res)
}

export async function adminDeleteCategory(id: number): Promise<void> {
  const res = await adminApiRequest(`/api/admin/scheduling/categories/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Failed to delete category')
  }
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

export async function adminFetchSignups(
  formId?: number,
  options?: { archived?: boolean },
): Promise<SchedulingSignup[]> {
  const params = new URLSearchParams()
  if (formId) params.set('formId', String(formId))
  if (options?.archived) params.set('archived', 'true')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await adminApiRequest(`/api/admin/scheduling/signups${qs}`)
  return parseJson(res)
}

export async function adminCreateSignup(payload: {
  formId: number
  categoryId: number | null
  slotGroupId: number
  timeSlotId?: number
  memberId?: number
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  responses?: Record<string, string | boolean | number | string[]>
  sendEmails?: boolean
}): Promise<SchedulingSignup> {
  const res = await adminApiRequest('/api/admin/scheduling/signups', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export async function adminArchiveSignup(id: number, archived: boolean): Promise<SchedulingSignup> {
  const res = await adminApiRequest(`/api/admin/scheduling/signups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
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

export async function adminResetSignupMemberPassword(
  signupId: number,
  payload: { mode: 'manual' | 'email_temp'; password?: string },
): Promise<{ message: string }> {
  const res = await adminApiRequest(`/api/admin/scheduling/signups/${signupId}/member-password`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to reset password')
  }
  return { message: data.message || 'Password updated' }
}

/** @deprecated Use adminResetSignupMemberPassword */
export async function adminUpdateSignupMemberPassword(
  signupId: number,
  password: string,
): Promise<void> {
  await adminResetSignupMemberPassword(signupId, { mode: 'manual', password })
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

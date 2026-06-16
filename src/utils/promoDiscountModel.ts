import type { DiscountRule, DiscountRuleInput } from './schedulingApi'

export type PromoDiscountKind = 'amount' | 'free_access'

export type AmountAppliesTo =
  | 'single_class'
  | 'week'
  | 'month'
  | 'class_offering'
  | 'date_window'

export type FreeBenefitType = 'days' | 'weeks' | 'months' | 'solo_classes' | 'class_offering'

export type FreeApplicationMethod = 'monthly_rate_credit' | 'free_solo_class_access'

export type EligibilityField = 'school' | 'graduation_year' | 'grade_level'

export type EligibilityOperator = 'is' | 'is_not' | 'in' | 'not_in'

export interface EligibilityRule {
  field: EligibilityField
  operator: EligibilityOperator
  value: string | number | string[] | number[]
}

export interface PromoFormState {
  name: string
  description: string
  code: string
  discountKind: PromoDiscountKind
  amountValue: number
  amountUnit: 'percent' | 'fixed'
  amountAppliesTo: AmountAppliesTo
  classOfferingIds: number[]
  benefitType: FreeBenefitType
  freeQuantity: number
  applicationMethod: FreeApplicationMethod
  startsAt: string | null
  endsAt: string | null
  active: boolean
  eligibilityRules: EligibilityRule[]
  priority: number
  maxDiscountCents: number | null
  maxRedemptions: number | null
  stackable: boolean
  exclusivityGroup: string | null
  calcBase: 'pre' | 'post'
}

export const AMOUNT_APPLIES_LABELS: Record<AmountAppliesTo, string> = {
  single_class: 'One class',
  week: 'One week',
  month: 'One month',
  class_offering: 'One class offering',
  date_window: 'Order during date window',
}

export const FREE_BENEFIT_LABELS: Record<FreeBenefitType, string> = {
  days: 'Free days',
  weeks: 'Free weeks',
  months: 'Free months',
  solo_classes: 'Free solo class(es)',
  class_offering: 'Free specific class offering',
}

export const ELIGIBILITY_FIELD_LABELS: Record<EligibilityField, string> = {
  school: 'School',
  graduation_year: 'Graduation year',
  grade_level: 'Grade level',
}

export const ELIGIBILITY_OPERATOR_LABELS: Record<EligibilityOperator, string> = {
  is: 'is',
  is_not: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
}

const GRADE_LABELS: Record<number, string> = {
  9: '9th grade (freshman)',
  10: '10th grade (sophomore)',
  11: '11th grade (junior)',
  12: '12th grade (senior)',
}

export function graduationYearsForPicker(): number[] {
  const year = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, i) => year + i)
}

export function gradeLevelsForPicker(): Array<{ value: number; label: string }> {
  return [9, 10, 11, 12].map((g) => ({ value: g, label: GRADE_LABELS[g] ?? `Grade ${g}` }))
}

export function defaultPromoForm(): PromoFormState {
  return {
    name: '',
    description: '',
    code: '',
    discountKind: 'amount',
    amountValue: 10,
    amountUnit: 'percent',
    amountAppliesTo: 'single_class',
    classOfferingIds: [],
    benefitType: 'solo_classes',
    freeQuantity: 1,
    applicationMethod: 'free_solo_class_access',
    startsAt: null,
    endsAt: null,
    active: true,
    eligibilityRules: [],
    priority: 100,
    maxDiscountCents: null,
    maxRedemptions: null,
    stackable: true,
    exclusivityGroup: null,
    calcBase: 'pre',
  }
}

function inferDiscountKind(rule: DiscountRule): PromoDiscountKind {
  if (rule.config.discountKind === 'free_access' || rule.type === 'free_classes') return 'free_access'
  return 'amount'
}

function mapGrantUnitToBenefit(unit?: string): FreeBenefitType {
  switch (unit) {
    case 'days':
      return 'days'
    case 'weeks':
      return 'weeks'
    case 'months':
      return 'months'
    case 'offering':
      return 'class_offering'
    default:
      return 'solo_classes'
  }
}

function mapBenefitToGrantUnit(benefit: FreeBenefitType): string {
  switch (benefit) {
    case 'days':
      return 'days'
    case 'weeks':
      return 'weeks'
    case 'months':
      return 'months'
    case 'class_offering':
      return 'offering'
    default:
      return 'slot'
  }
}

export function promoFormFromRule(rule: DiscountRule | null): PromoFormState {
  if (!rule) return defaultPromoForm()
  const kind = inferDiscountKind(rule)
  const cfg = rule.config ?? {}
  const offeringIds = Array.isArray(cfg.class_offering_ids)
    ? (cfg.class_offering_ids as number[])
    : cfg.offering_id != null
      ? [Number(cfg.offering_id)]
      : []

  return {
    name: rule.name,
    description: rule.description ?? '',
    code: String(cfg.code ?? ''),
    discountKind: kind,
    amountValue:
      rule.amountType === 'percent' ? rule.amountValue / 100 : rule.amountValue / 100,
    amountUnit: rule.amountType,
    amountAppliesTo: (cfg.amount_applies_to as AmountAppliesTo) ?? 'single_class',
    classOfferingIds: offeringIds,
    benefitType: (cfg.benefit_type as FreeBenefitType) ?? mapGrantUnitToBenefit(cfg.grant_unit),
    freeQuantity: Number(cfg.quantity ?? 1),
    applicationMethod:
      (cfg.application_method as FreeApplicationMethod) ?? 'free_solo_class_access',
    startsAt: rule.startsAt ? rule.startsAt.slice(0, 10) : null,
    endsAt: rule.endsAt ? rule.endsAt.slice(0, 10) : null,
    active: rule.active,
    eligibilityRules: Array.isArray(cfg.eligibility_rules)
      ? (cfg.eligibility_rules as EligibilityRule[])
      : cfg.school_names
        ? [
            {
              field: 'school',
              operator: 'in',
              value: cfg.school_names as string[],
            },
          ]
        : [],
    priority: rule.priority,
    maxDiscountCents: rule.maxDiscountCents,
    maxRedemptions: rule.maxRedemptions,
    stackable: rule.stackable,
    exclusivityGroup: rule.exclusivityGroup,
    calcBase: rule.calcBase,
  }
}

function applyToFromAmountApplies(appliesTo: AmountAppliesTo): DiscountRuleInput['applyTo'] {
  return appliesTo === 'date_window' ? 'order_total' : 'per_class'
}

export function promoFormToRuleInput(form: PromoFormState): DiscountRuleInput {
  const isFree = form.discountKind === 'free_access'
  const amountValue =
    form.amountUnit === 'percent'
      ? Math.round(form.amountValue * 100)
      : Math.round(form.amountValue * 100)

  const config: Record<string, unknown> = {
    code: form.code.trim().toUpperCase(),
    discountKind: form.discountKind,
    eligibility_rules: form.eligibilityRules,
  }

  if (isFree) {
    config.benefit_type = form.benefitType
    config.grant_unit = mapBenefitToGrantUnit(form.benefitType)
    config.quantity = form.freeQuantity
    config.application_method = form.applicationMethod
    if (form.benefitType === 'class_offering' && form.classOfferingIds.length > 0) {
      config.class_offering_ids = form.classOfferingIds
      config.offering_id = form.classOfferingIds[0]
    }
  } else {
    config.amount_applies_to = form.amountAppliesTo
    if (form.amountAppliesTo === 'class_offering' && form.classOfferingIds.length > 0) {
      config.class_offering_ids = form.classOfferingIds
      config.offering_id = form.classOfferingIds[0]
    }
  }

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    type: 'promo_code',
    amountType: isFree ? 'percent' : form.amountUnit,
    amountValue: isFree ? 10000 : amountValue,
    applyTo: isFree ? 'per_class' : applyToFromAmountApplies(form.amountAppliesTo),
    calcBase: form.calcBase,
    priority: form.priority,
    stackable: form.stackable,
    exclusivityGroup: form.exclusivityGroup?.trim() || null,
    maxDiscountCents: form.maxDiscountCents,
    scopeLevel: 'global',
    scopeRefId: null,
    active: form.active,
    startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : null,
    endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
    maxRedemptions: form.maxRedemptions,
    config,
    tiers: [],
  }
}

export function validatePromoForm(form: PromoFormState): string | null {
  if (!form.name.trim()) return 'Name is required'
  if (!form.code.trim()) return 'Promo code is required'
  if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
    return 'End date must be on or after start date'
  }
  if (form.discountKind === 'amount') {
    if (form.amountValue <= 0) return 'Discount amount must be greater than zero'
    if (form.amountUnit === 'percent' && form.amountValue > 100) {
      return 'Percent discount cannot exceed 100%'
    }
    if (
      form.amountAppliesTo === 'class_offering' &&
      form.classOfferingIds.length === 0
    ) {
      return 'Select at least one class offering'
    }
  } else {
    if (form.freeQuantity < 1) return 'Free quantity must be at least 1'
    if (
      form.benefitType === 'class_offering' &&
      form.classOfferingIds.length === 0
    ) {
      return 'Select at least one class offering for free access'
    }
    if (form.benefitType === 'days' && !form.applicationMethod) {
      return 'Choose how free days are applied'
    }
  }
  for (const rule of form.eligibilityRules) {
    const v = rule.value
    const empty =
      v === '' ||
      v == null ||
      (Array.isArray(v) && v.length === 0)
    if (empty) return 'Each eligibility rule needs a value'
  }
  return null
}

export function formatRuleValue(field: EligibilityField, value: string | number): string {
  if (field === 'graduation_year') return `Class of ${value}`
  if (field === 'grade_level') {
    const n = Number(value)
    return GRADE_LABELS[n] ?? `Grade ${value}`
  }
  return String(value)
}

export function describeEligibilityRule(rule: EligibilityRule): string {
  const field = ELIGIBILITY_FIELD_LABELS[rule.field]
  const op = ELIGIBILITY_OPERATOR_LABELS[rule.operator]
  const values = Array.isArray(rule.value) ? rule.value : [rule.value]
  const formatted = values.map((v) => formatRuleValue(rule.field, v)).join(', ')
  if (rule.operator === 'is' || rule.operator === 'in') {
    return `${field} ${op} ${formatted}`
  }
  return `${field} ${op} ${formatted}`
}

export function describePromoBenefit(form: PromoFormState): string {
  if (form.discountKind === 'amount') {
    const amt =
      form.amountUnit === 'percent'
        ? `${form.amountValue}% off`
        : `$${form.amountValue.toFixed(2)} off`
    return `${amt} · ${AMOUNT_APPLIES_LABELS[form.amountAppliesTo].toLowerCase()}`
  }
  const qty = form.freeQuantity
  const unit = FREE_BENEFIT_LABELS[form.benefitType].toLowerCase()
  if (form.benefitType === 'days' && form.applicationMethod === 'monthly_rate_credit') {
    return `${qty} free day${qty === 1 ? '' : 's'} credited toward monthly rate`
  }
  return `${qty} ${unit}`
}

export function describePromoSummary(form: PromoFormState): string {
  const benefit = describePromoBenefit(form)
  if (form.eligibilityRules.length === 0) {
    return `Gives ${benefit} to any customer with this code.`
  }
  const who = form.eligibilityRules.map(describeEligibilityRule).join(' AND ')
  return `Gives ${benefit} to customers where ${who}.`
}

export interface PromoStatusInfo {
  active: boolean
  withinWindow: boolean
  usableNow: boolean
  label: string
  detail: string
}

export function getPromoStatus(rule: DiscountRule, now = new Date()): PromoStatusInfo {
  const active = rule.active !== false
  const t = now.getTime()
  const starts = rule.startsAt ? new Date(rule.startsAt).getTime() : null
  const ends = rule.endsAt ? new Date(rule.endsAt).getTime() : null
  const beforeStart = starts != null && t < starts
  const afterEnd = ends != null && t > ends
  const withinWindow = !beforeStart && !afterEnd
  const usableNow = active && withinWindow

  let label = 'Inactive'
  let detail = 'Turn on Active to allow this promo to be used when dates match.'
  if (active && withinWindow) {
    label = 'Active · usable now'
    detail = 'Customers can use this code today.'
  } else if (active && beforeStart) {
    label = 'Active · not started'
    detail = 'This promo is enabled but the start date is in the future.'
  } else if (active && afterEnd) {
    label = 'Active · expired'
    detail = 'This promo is enabled but the end date has passed.'
  } else if (!active && withinWindow) {
    label = 'Inactive'
    detail = 'Dates are valid today, but the promo is turned off.'
  }

  return { active, withinWindow, usableNow, label, detail }
}

export function describePromoRuleBenefit(rule: DiscountRule): string {
  return describePromoBenefit(promoFormFromRule(rule))
}

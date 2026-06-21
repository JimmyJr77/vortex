// Free pass entitlement engine: templates, member grants, calendar proration, redemption ledger.

import { expandCalendarRange } from './calendarExpansion.js'
import { hoursPerMonthForEnrollment, WEEKS_PER_MONTH } from './slotHours.js'

export const BENEFIT_UNITS = ['slot', 'offering', 'day', 'week', 'month', 'hour', 'specific_date']
export const APPLICATION_METHODS = ['waive_enrollment', 'monthly_prorate']
export const SCOPE_LEVELS = ['global', 'sport', 'program', 'class', 'offering']

function normalizeText(s) {
  return String(s ?? '').trim().toLowerCase()
}

function inferGradeFromGraduationYear(gradYear, now = new Date()) {
  const y = Number(gradYear)
  if (!Number.isFinite(y)) return null
  const month = now.getMonth()
  const schoolYearEnd = month >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  const yearsUntilGrad = y - schoolYearEnd
  if (yearsUntilGrad < 0) return null
  const grade = 12 - yearsUntilGrad
  if (grade < 9 || grade > 12) return null
  return grade
}

function ruleValueList(value) {
  if (Array.isArray(value)) return value
  if (value === '' || value == null) return []
  return [value]
}

function matchesEligibilityRule(rule, line) {
  const values = ruleValueList(rule.value)
  if (values.length === 0) return true

  let actual = null
  switch (rule.field) {
    case 'school':
      actual = normalizeText(line.memberSchool)
      break
    case 'graduation_year':
      actual = line.memberGraduationYear != null ? Number(line.memberGraduationYear) : null
      break
    case 'grade_level': {
      const direct = line.memberGradeLevel != null ? Number(line.memberGradeLevel) : null
      actual =
        direct != null && Number.isFinite(direct)
          ? direct
          : inferGradeFromGraduationYear(line.memberGraduationYear)
      break
    }
    default:
      return true
  }
  if (actual == null || actual === '') return false

  const op = rule.operator || 'is'
  if (rule.field === 'school') {
    const targets = values.map(normalizeText).filter(Boolean)
    const hit = targets.some((t) => actual === t || actual.includes(t))
    if (op === 'is' || op === 'in') return hit
    if (op === 'is_not' || op === 'not_in') return !hit
    return hit
  }

  const nums = values.map(Number).filter((n) => Number.isFinite(n))
  const n = Number(actual)
  if (op === 'is') return nums.length > 0 && n === nums[0]
  if (op === 'is_not') return nums.length > 0 && n !== nums[0]
  if (op === 'in') return nums.includes(n)
  if (op === 'not_in') return !nums.includes(n)
  return true
}

/** True when the member has no confirmed (active) class enrollments; waitlisted-only still qualifies. */
export function memberIsFirstTimeEnrollee(existingEnrollments = []) {
  return !existingEnrollments.some((entry) => entry.status === 'confirmed')
}

function normalizeSchoolLevels(raw) {
  const allowed = new Set(['high', 'middle', 'elementary'])
  if (!Array.isArray(raw)) return []
  return raw.map((v) => String(v).toLowerCase()).filter((v) => allowed.has(v))
}

function resolveMemberSchool(memberSchool, knownSchools = []) {
  const key = normalizeText(memberSchool)
  if (!key) return null
  for (const school of knownSchools) {
    const dbKey = normalizeText(school.name)
    if (!dbKey) continue
    if (key === dbKey || key.includes(dbKey) || dbKey.includes(key)) {
      return school
    }
  }
  return null
}

function schoolFilterEngaged(eligibility) {
  if (eligibility.all_schools === true) return true
  if (normalizeSchoolLevels(eligibility.school_levels).length > 0) return true
  const rules = eligibility.eligibility_rules || eligibility.rules
  if (!Array.isArray(rules)) return false
  return rules.some((r) => r.field === 'school')
}

function passesEligibility(template, line, { isFirstTimeEnrollee = false, knownSchools = [] } = {}) {
  const eligibility = template.eligibility || {}
  if (eligibility.new_member === true && !isFirstTimeEnrollee) return false

  const schoolFilterActive = schoolFilterEngaged(eligibility)
  const levels = normalizeSchoolLevels(eligibility.school_levels)
  const matchedSchool = resolveMemberSchool(line.memberSchool, knownSchools)

  if (schoolFilterActive) {
    if (eligibility.all_schools === true) {
      if (!matchedSchool) return false
    } else if (levels.length > 0) {
      if (!matchedSchool) return false
      const level = matchedSchool.level ? String(matchedSchool.level).toLowerCase() : null
      if (!level || !levels.includes(level)) return false
    }
  }

  const rules = eligibility.eligibility_rules || eligibility.rules
  if (!Array.isArray(rules) || rules.length === 0) return true
  return rules.every((r) => matchesEligibilityRule(r, line))
}

function templateInWindow(template, now = Date.now()) {
  if (!template.active) return false
  return isPassWithinValidationWindow({
    startsAt: template.startsAt,
    endsAt: template.endsAt,
    now,
  })
}

export function isPassWithinValidationWindow({ startsAt, endsAt, now = Date.now() }) {
  const t = now
  if (startsAt && new Date(startsAt).getTime() > t) return false
  if (endsAt && new Date(endsAt).getTime() < t) return false
  return true
}

export function passValidationWindowError({ startsAt, endsAt, now = Date.now() }) {
  if (startsAt && new Date(startsAt).getTime() > now) {
    return 'This pass is not valid yet. Adjust Valid from or turn off Active.'
  }
  if (endsAt && new Date(endsAt).getTime() < now) {
    return 'This pass has expired. Adjust Valid through or turn off Active.'
  }
  return null
}

export function effectivePassActive({ active, startsAt, endsAt, now = Date.now() }) {
  if (!active) return false
  return isPassWithinValidationWindow({ startsAt, endsAt, now })
}

function scopeMatches(template, line) {
  const level = template.scopeLevel || 'global'
  const refId = template.scopeRefId != null ? Number(template.scopeRefId) : null
  if (level === 'global') return true
  if (level === 'sport') return refId != null && Number(line.sportId) === refId
  if (level === 'program') return refId != null && Number(line.programId) === refId
  if (level === 'class') return refId != null && Number(line.formId) === refId
  if (level === 'offering') return refId != null && Number(line.offeringId) === refId
  return false
}

function offeringOrSportScopeMatch(template, line) {
  const offeringIds = (template.offeringIds || []).map(Number).filter((n) => Number.isFinite(n))
  const sportIds = (template.sportIds || []).map(Number).filter((n) => Number.isFinite(n))
  const hasOfferingFilter = offeringIds.length > 0
  const hasSportFilter = sportIds.length > 0
  if (!hasOfferingFilter && !hasSportFilter) return true

  let matches = false
  if (
    hasOfferingFilter &&
    line.offeringId != null &&
    offeringIds.includes(Number(line.offeringId))
  ) {
    matches = true
  }
  if (hasSportFilter && line.sportId != null && sportIds.includes(Number(line.sportId))) {
    matches = true
  }
  return matches
}

function promoCodeMatches(template, promoCodes = []) {
  const code = template.issuance?.promo_code
  if (!code) return true
  const normalized = String(code).trim().toUpperCase()
  if (!normalized) return true
  return promoCodes.map((c) => String(c).trim().toUpperCase()).includes(normalized)
}

function isAdminOnlyTemplate(template) {
  return template.issuance?.admin_only === true
}

function isAutoOnEnrollTemplate(template) {
  return template.issuance?.auto_on_enroll === true
}

export function mapPassTemplateRow(r) {
  const startsAt = r.starts_at ?? null
  const endsAt = r.ends_at ?? null
  const active = effectivePassActive({
    active: r.active !== false,
    startsAt,
    endsAt,
  })
  return {
    id: Number(r.id),
    facilityId: r.facility_id != null ? Number(r.facility_id) : null,
    name: r.name,
    description: r.description ?? null,
    active,
    startsAt,
    endsAt,
    benefitUnit: r.benefit_unit,
    benefitQuantity: Number(r.benefit_quantity ?? 1),
    applicationMethod: r.application_method ?? 'waive_enrollment',
    scopeLevel: r.scope_level ?? 'global',
    scopeRefId: r.scope_ref_id != null ? Number(r.scope_ref_id) : null,
    dayOfWeek: r.day_of_week != null ? Number(r.day_of_week) : null,
    offeringIds: Array.isArray(r.offering_ids) ? r.offering_ids.map(Number) : [],
    sportIds: Array.isArray(r.config?.sport_ids) ? r.config.sport_ids.map(Number) : [],
    eligibility: r.eligibility ?? {},
    issuance: r.issuance ?? {},
    debitsFreeClassAllowance: Boolean(r.debits_free_class_allowance),
    stackable: r.stackable !== false,
    exclusivityGroup: r.exclusivity_group ?? null,
    maxRedemptions: r.max_redemptions != null ? Number(r.max_redemptions) : null,
    maxRedemptionsPerMember:
      r.config?.max_redemptions_per_member != null
        ? Number(r.config.max_redemptions_per_member)
        : null,
    redeemedCount: Number(r.redeemed_count ?? 0),
    config: r.config ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapMemberPassRow(r) {
  return {
    id: Number(r.id),
    memberId: Number(r.member_id),
    passTemplateId: Number(r.pass_template_id),
    quantityGranted: Number(r.quantity_granted ?? 1),
    quantityRemaining: Number(r.quantity_remaining ?? 0),
    issuedAt: r.issued_at,
    expiresAt: r.expires_at ?? null,
    issuedBy: r.issued_by ?? 'admin',
    sourceRef: r.source_ref ?? null,
    templateName: r.template_name ?? null,
  }
}

export async function loadActivePassTemplates(pool, facilityId) {
  const res = await pool.query(
    `SELECT * FROM free_pass_template
     WHERE ($1::bigint IS NULL OR facility_id = $1) AND active = TRUE
     ORDER BY name ASC`,
    [facilityId],
  )
  return res.rows.map(mapPassTemplateRow).filter((t) => templateInWindow(t))
}

export async function loadMemberPassGrants(pool, memberId) {
  if (!memberId) return []
  const res = await pool.query(
    `
    SELECT m.*, t.name AS template_name
    FROM member_free_pass m
    JOIN free_pass_template t ON t.id = m.pass_template_id
    WHERE m.member_id = $1
      AND m.quantity_remaining > 0
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND t.active = TRUE
    ORDER BY m.issued_at ASC
    `,
    [memberId],
  )
  return res.rows.map(mapMemberPassRow)
}

export async function loadAttachmentsForScope(pool, scopeLevel, scopeRefId) {
  const res = await pool.query(
    `SELECT * FROM pricing_pass_attachment
     WHERE scope_level = $1 AND scope_ref_id = $2
     ORDER BY sort_order ASC, id ASC`,
    [scopeLevel, scopeRefId],
  )
  return res.rows.map((r) => ({
    id: Number(r.id),
    scopeLevel: r.scope_level,
    scopeRefId: Number(r.scope_ref_id),
    passTemplateId: Number(r.pass_template_id),
    autoApply: r.auto_apply !== false,
    sortOrder: Number(r.sort_order ?? 0),
  }))
}

export async function loadAttachmentsForForm(pool, formRow) {
  const formId = Number(formRow.id)
  const programsId = formRow.programs_id != null ? Number(formRow.programs_id) : null
  const classAttachments = await loadAttachmentsForScope(pool, 'class', formId)
  const programAttachments =
    programsId != null ? await loadAttachmentsForScope(pool, 'program', programsId) : []
  return [...programAttachments, ...classAttachments]
}

export async function loadOfferingById(pool, offeringId) {
  if (offeringId == null) return null
  const res = await pool.query(
    `SELECT id, form_id, start_date, end_date, label FROM scheduling_offering WHERE id = $1`,
    [offeringId],
  )
  const row = res.rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    label: row.label ?? '',
  }
}

export async function loadTimeSlotRowsForGroup(pool, slotGroupId) {
  if (slotGroupId == null) return []
  const map = await loadCalendarRowsForSlotGroups(pool, [slotGroupId])
  return map.get(Number(slotGroupId)) || []
}

export async function loadCalendarRowsForSlotGroups(pool, slotGroupIds) {
  const ids = [...new Set(slotGroupIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
  if (ids.length === 0) return new Map()

  const res = await pool.query(
    `
    SELECT ts.*, sg.form_id, sg.is_active AS sg_is_active,
           sg.active_start AS sg_active_start, sg.active_end AS sg_active_end,
           sg.dates_tbd AS sg_dates_tbd,
           sf.title AS form_title, sf.start_date AS form_start_date,
           sf.end_date AS form_end_date, sf.is_active AS form_is_active,
           sf.programs_id, sf.enroll_sites AS form_enroll_sites,
           o.start_date AS offering_start_date, o.end_date AS offering_end_date,
           o.label AS offering_label
    FROM scheduling_time_slot ts
    JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
    JOIN scheduling_form sf ON sf.id = sg.form_id
    LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
    WHERE ts.slot_group_id = ANY($1::int[]) AND ts.is_active = TRUE
    ORDER BY ts.slot_group_id, ts.id
    `,
    [ids],
  )

  const byGroup = new Map()
  for (const row of res.rows) {
    const gid = Number(row.slot_group_id)
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid).push(row)
  }
  return byGroup
}

function monthBoundsForOffering(offering) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  if (!offering) return { startDate: monthStart, endDate: monthEnd }
  const startDate = offering.startDate > monthStart ? offering.startDate : monthStart
  const endDate = offering.endDate < monthEnd ? offering.endDate : monthEnd
  if (startDate > endDate) return { startDate: offering.startDate, endDate: offering.endDate }
  return { startDate, endDate }
}

function benefitDateBounds(template) {
  const cfg = template.config ?? {}
  const start = cfg.benefit_start_date ? String(cfg.benefit_start_date).slice(0, 10) : null
  const endRaw = cfg.benefit_end_date ? String(cfg.benefit_end_date).slice(0, 10) : start
  if (!start) return null
  const end = endRaw && endRaw >= start ? endRaw : start
  return { startDate: start, endDate: end }
}

function intersectDateRanges(a, b) {
  const startDate = a.startDate > b.startDate ? a.startDate : b.startDate
  const endDate = a.endDate < b.endDate ? a.endDate : b.endDate
  if (startDate > endDate) return null
  return { startDate, endDate }
}

function countOccurrencesInRange(rows, { startDate, endDate, dayOfWeek = null }) {
  const expanded = expandCalendarRange({ startDate, endDate, rows, site: 'athletics' })
  const events = expanded.events || []
  if (dayOfWeek == null) return events.length
  return events.filter((e) => {
    const d = new Date(`${e.date}T12:00:00`)
    return d.getDay() === dayOfWeek
  }).length
}

/**
 * Compute monthly credit in cents for a pass applied to a line.
 */
export function computePassCreditCents({
  template,
  lineBaseCents,
  offering = null,
  timeSlotRows = [],
  slotGroupId = null,
  timeSlotId = null,
}) {
  const base = Math.max(0, Math.round(Number(lineBaseCents) || 0))
  if (base <= 0) return 0

  const unit = template.benefitUnit || 'slot'
  const qty = Math.max(1, Number(template.benefitQuantity) || 1)
  const method = template.applicationMethod || 'waive_enrollment'

  if (unit === 'slot' || unit === 'offering') {
    return method === 'waive_enrollment' ? base : base
  }

  if (unit === 'week') {
    const weeksPerMonth = WEEKS_PER_MONTH
    const fraction = Math.min(1, qty / weeksPerMonth)
    return Math.round(base * fraction)
  }

  if (unit === 'month') {
    return Math.round(base * Math.min(1, qty))
  }

  if (unit === 'hour') {
    const hoursPerMonth = hoursPerMonthForEnrollment(timeSlotRows, {
      timeSlotId: line.timeSlotId ?? null,
    })
    if (hoursPerMonth <= 0) return 0
    const freeHours = Math.min(hoursPerMonth, qty)
    return Math.round(base * (freeHours / hoursPerMonth))
  }

  if (unit === 'day') {
    const { startDate, endDate } = monthBoundsForOffering(offering)
    const groupRows = slotGroupId
      ? timeSlotRows.filter((r) => Number(r.slot_group_id) === Number(slotGroupId))
      : timeSlotRows
    const totalOccurrences = countOccurrencesInRange(groupRows, { startDate, endDate })
    if (totalOccurrences <= 0) return 0

    const dow = template.dayOfWeek
    const freeOccurrences =
      dow != null
        ? Math.min(qty, countOccurrencesInRange(groupRows, { startDate, endDate, dayOfWeek: dow }))
        : Math.min(qty, totalOccurrences)

    return Math.round(base * (freeOccurrences / totalOccurrences))
  }

  if (unit === 'specific_date') {
    const benefitBounds = benefitDateBounds(template)
    if (!benefitBounds) return 0

    const monthBounds = monthBoundsForOffering(offering)
    const creditBounds = intersectDateRanges(benefitBounds, monthBounds)
    if (!creditBounds) return 0

    const groupRows = slotGroupId
      ? timeSlotRows.filter((r) => Number(r.slot_group_id) === Number(slotGroupId))
      : timeSlotRows
    const totalOccurrences = countOccurrencesInRange(groupRows, monthBounds)
    if (totalOccurrences <= 0) return 0

    const matchedOccurrences = countOccurrencesInRange(groupRows, creditBounds)
    if (matchedOccurrences <= 0) return 0

    const freeOccurrences = Math.min(qty, matchedOccurrences)
    return Math.round(base * (freeOccurrences / totalOccurrences))
  }

  return 0
}

function perSchoolLimitsEnabled(config) {
  if (!config) return false
  if (config.per_school_max_redemptions_enabled === false) return false
  if (config.per_school_max_redemptions_enabled === true) return true
  const defaultLimit = Number(config.max_redemptions_per_school_default)
  if (Number.isFinite(defaultLimit) && defaultLimit > 0) return true
  const limits = config.max_redemptions_per_school
  return limits && typeof limits === 'object' && Object.keys(limits).length > 0
}

function maxRedemptionsForSchool(template, memberSchool) {
  if (!perSchoolLimitsEnabled(template.config)) return null
  const key = normalizeText(memberSchool)
  if (!key) return null
  const limits = template.config?.max_redemptions_per_school
  if (limits && typeof limits === 'object') {
    for (const [name, value] of Object.entries(limits)) {
      if (normalizeText(name) === key) {
        const n = Number(value)
        return Number.isFinite(n) && n > 0 ? n : null
      }
    }
  }
  const defaultLimit = Number(template.config?.max_redemptions_per_school_default)
  return Number.isFinite(defaultLimit) && defaultLimit > 0 ? defaultLimit : null
}

export async function loadActiveSchools(pool) {
  try {
    const res = await pool.query(
      `SELECT name, level FROM school WHERE is_active = TRUE ORDER BY name ASC`,
    )
    return res.rows
      .map((row) => ({
        name: String(row.name).trim(),
        level: row.level ? String(row.level).toLowerCase() : null,
      }))
      .filter((school) => school.name)
  } catch {
    return []
  }
}

export async function loadActiveSchoolNames(pool) {
  const schools = await loadActiveSchools(pool)
  return schools.map((school) => school.name)
}

function candidateTemplatesForLine({
  templates,
  attachments = [],
  grants,
  promoCodes,
  line,
  isFirstTimeEnrollee,
  knownSchools = [],
  costSelectionMode = false,
}) {
  const attachmentById = new Map(attachments.map((a) => [a.passTemplateId, a]))
  const grantTemplateIds = new Set(grants.map((g) => g.passTemplateId))

  return templates.filter((t) => {
    if (!templateInWindow(t)) return false

    const att = attachmentById.get(t.id)
    const isSelected = att != null
    const hasGrant = grantTemplateIds.has(t.id)

    if (costSelectionMode) {
      if (!hasGrant && !isSelected) return false
    } else if (!scopeMatches(t, line)) {
      return false
    }

    if (!offeringOrSportScopeMatch(t, line)) return false
    if (!passesEligibility(t, line, { isFirstTimeEnrollee, knownSchools })) return false

    const autoApply = att?.autoApply ?? false
    const allowMemberCode = att?.allowMemberCode !== false
    const autoEnroll = isAutoOnEnrollTemplate(t)
    const promoMatch = promoCodeMatches(t, promoCodes)

    if (isAdminOnlyTemplate(t) && !hasGrant) return false
    if (hasGrant) return true
    if (isSelected && autoApply) return true

    if (promoMatch && t.issuance?.promo_code) {
      if (costSelectionMode) return isSelected && allowMemberCode
      return true
    }

    if (!costSelectionMode) {
      const autoAttachmentIds = new Set(
        attachments.filter((a) => a.autoApply).map((a) => a.passTemplateId),
      )
      if (autoAttachmentIds.has(t.id) && autoEnroll) return true
      if (autoEnroll && t.scopeLevel === 'global') return true
    }
    return false
  })
}

export function applyFreePassLayer({
  lines = [],
  templates = [],
  grants = [],
  attachments = [],
  promoCodes = [],
  caps = {},
  offeringsById = new Map(),
  timeSlotsByGroup = new Map(),
  isFirstTimeEnrollee = false,
  knownSchools = [],
}) {
  const empty = {
    enabled: false,
    items: [],
    totalCreditCents: 0,
    redemptions: [],
    linesAfter: lines.map((l) => ({ ...l, baseCents: l.baseCents, passCreditCents: 0, finalCents: l.baseCents })),
  }
  if (!lines.length || (!templates.length && !grants.length)) return empty

  const grantByTemplate = new Map()
  for (const g of grants) {
    if (!grantByTemplate.has(g.passTemplateId)) grantByTemplate.set(g.passTemplateId, g)
  }

  let facilityFreeUsed = caps.freeUnitsFacilityUsed || 0
  const maxFacilityFree = caps.maxFreeUnitsTotal ?? null
  const ruleRedeemed = { ...(caps.ruleRedeemed || {}) }
  const usedExclusivity = new Set()
  const memberOrderRedeemed = new Map()
  const schoolOrderRedeemed = new Map()

  const memberRedemptionCount = (templateId, memberId) => {
    if (memberId == null) return 0
    const historic =
      caps.memberRedeemedByTemplate?.get(Number(templateId))?.get(Number(memberId)) ?? 0
    const orderKey = `${templateId}:${memberId}`
    const inOrder = memberOrderRedeemed.get(orderKey) ?? 0
    return historic + inOrder
  }

  const recordMemberRedemption = (templateId, memberId) => {
    if (memberId == null) return
    const orderKey = `${templateId}:${memberId}`
    memberOrderRedeemed.set(orderKey, (memberOrderRedeemed.get(orderKey) ?? 0) + 1)
  }

  const schoolRedemptionCount = (templateId, schoolKey) => {
    if (!schoolKey) return 0
    const historic =
      caps.schoolRedeemedByTemplate?.get(Number(templateId))?.get(schoolKey) ?? 0
    const orderKey = `${templateId}:${schoolKey}`
    return historic + (schoolOrderRedeemed.get(orderKey) ?? 0)
  }

  const recordSchoolRedemption = (templateId, schoolKey) => {
    if (!schoolKey) return
    const orderKey = `${templateId}:${schoolKey}`
    schoolOrderRedeemed.set(orderKey, (schoolOrderRedeemed.get(orderKey) ?? 0) + 1)
  }

  const items = []
  const redemptions = []
  const linesAfter = lines.map((line) => ({
    ...line,
    passCreditCents: 0,
    finalCents: line.baseCents,
    appliedPasses: [],
  }))

  for (const lineState of linesAfter) {
    const line = lineState
    const offering = line.offeringId != null ? offeringsById.get(Number(line.offeringId)) : null
    const slotGroupId = line.slotGroupId ?? null
    const timeSlotRows = slotGroupId != null ? timeSlotsByGroup.get(Number(slotGroupId)) || [] : []

    const lineAttachments = line.freePassAttachments ?? attachments
    const costSelectionMode = Boolean(line.costUsesSelections)

    const candidates = candidateTemplatesForLine({
      templates,
      attachments: lineAttachments,
      grants,
      promoCodes,
      line,
      isFirstTimeEnrollee,
      knownSchools,
      costSelectionMode,
    }).sort((a, b) => Number(a.id) - Number(b.id))

    for (const template of candidates) {
      if (template.exclusivityGroup && usedExclusivity.has(template.exclusivityGroup)) continue
      if (template.maxRedemptions != null) {
        const used = (template.redeemedCount || 0) + (ruleRedeemed[template.id] || 0)
        if (used >= template.maxRedemptions) continue
      }
      if (template.maxRedemptionsPerMember != null && line.memberId != null) {
        if (memberRedemptionCount(template.id, line.memberId) >= template.maxRedemptionsPerMember) {
          continue
        }
      }
      const schoolLimit = maxRedemptionsForSchool(template, line.memberSchool)
      if (schoolLimit != null && line.memberSchool) {
        const schoolKey = normalizeText(line.memberSchool)
        if (schoolRedemptionCount(template.id, schoolKey) >= schoolLimit) continue
      }
      if (maxFacilityFree != null && facilityFreeUsed >= maxFacilityFree) continue

      const grant = grantByTemplate.get(template.id)
      if (grant && grant.quantityRemaining <= 0) continue

      const credit = computePassCreditCents({
        template,
        lineBaseCents: lineState.baseCents - lineState.passCreditCents,
        offering,
        timeSlotRows,
        slotGroupId,
        timeSlotId: line.timeSlotId ?? null,
      })
      if (credit <= 0) continue

      const applied = Math.min(credit, lineState.baseCents - lineState.passCreditCents)
      if (applied <= 0) continue

      lineState.passCreditCents += applied
      lineState.finalCents = Math.max(0, lineState.baseCents - lineState.passCreditCents)
      lineState.appliedPasses.push({
        templateId: template.id,
        templateName: template.name,
        creditCents: applied,
        debitsFreeClassAllowance: template.debitsFreeClassAllowance,
        benefitUnit: template.benefitUnit,
      })

      items.push({
        lineKey: line.key,
        templateId: template.id,
        templateName: template.name,
        creditCents: applied,
        benefitUnit: template.benefitUnit,
        prorated: template.applicationMethod === 'monthly_prorate',
      })

      redemptions.push({
        lineKey: line.key,
        memberPassId: grant?.id ?? null,
        passTemplateId: template.id,
        memberId: line.memberId ?? null,
        units: 1,
        amountCentsCredited: applied,
        context: {
          offeringId: line.offeringId ?? null,
          dayOfWeek: template.dayOfWeek,
          slotGroupId,
          memberSchool: line.memberSchool ?? null,
        },
        debitsFreeClassAllowance: template.debitsFreeClassAllowance,
      })

      facilityFreeUsed += 1
      ruleRedeemed[template.id] = (ruleRedeemed[template.id] || 0) + 1
      recordMemberRedemption(template.id, line.memberId)
      if (line.memberSchool) {
        recordSchoolRedemption(template.id, normalizeText(line.memberSchool))
      }
      if (template.exclusivityGroup) usedExclusivity.add(template.exclusivityGroup)
      if (!template.stackable) break
    }
  }

  const totalCreditCents = linesAfter.reduce((s, l) => s + l.passCreditCents, 0)
  return {
    enabled: items.length > 0,
    items,
    totalCreditCents,
    redemptions,
    linesAfter,
  }
}

export async function loadFreePassCaps(pool, facilityId) {
  const caps = {
    maxFreeUnitsTotal: null,
    freeUnitsFacilityUsed: 0,
    ruleRedeemed: {},
  }
  try {
    const settingsRes = await pool.query(
      `SELECT max_free_units_total FROM discount_global_settings WHERE facility_id = $1`,
      [facilityId],
    )
    if (settingsRes.rows[0]) {
      caps.maxFreeUnitsTotal = settingsRes.rows[0].max_free_units_total
    }
    const freeRes = await pool.query(
      `SELECT COALESCE(SUM(units), 0)::int AS total FROM free_pass_redemption`,
    )
    caps.freeUnitsFacilityUsed = Number(freeRes.rows[0]?.total ?? 0)
    const byTemplate = await pool.query(
      `SELECT pass_template_id, COUNT(*)::int AS c FROM free_pass_redemption
       WHERE pass_template_id IS NOT NULL GROUP BY pass_template_id`,
    )
    for (const row of byTemplate.rows) {
      caps.ruleRedeemed[Number(row.pass_template_id)] = Number(row.c)
    }
    const memberByTemplate = new Map()
    const byMember = await pool.query(
      `SELECT pass_template_id, member_id, COUNT(*)::int AS c
       FROM free_pass_redemption
       WHERE pass_template_id IS NOT NULL AND member_id IS NOT NULL
       GROUP BY pass_template_id, member_id`,
    )
    for (const row of byMember.rows) {
      const templateId = Number(row.pass_template_id)
      const memberId = Number(row.member_id)
      if (!memberByTemplate.has(templateId)) memberByTemplate.set(templateId, new Map())
      memberByTemplate.get(templateId).set(memberId, Number(row.c))
    }
    caps.memberRedeemedByTemplate = memberByTemplate
    const schoolByTemplate = new Map()
    const bySchool = await pool.query(
      `SELECT pass_template_id,
              lower(trim(context->>'memberSchool')) AS school_key,
              COUNT(*)::int AS c
       FROM free_pass_redemption
       WHERE pass_template_id IS NOT NULL
         AND context->>'memberSchool' IS NOT NULL
         AND trim(context->>'memberSchool') <> ''
       GROUP BY pass_template_id, lower(trim(context->>'memberSchool'))`,
    )
    for (const row of bySchool.rows) {
      const templateId = Number(row.pass_template_id)
      const schoolKey = String(row.school_key).trim()
      if (!schoolKey) continue
      if (!schoolByTemplate.has(templateId)) schoolByTemplate.set(templateId, new Map())
      schoolByTemplate.get(templateId).set(schoolKey, Number(row.c))
    }
    caps.schoolRedeemedByTemplate = schoolByTemplate
  } catch {
    /* tables may not exist yet */
  }
  return caps
}

export async function persistFreePassRedemptions(pool, { signupId, memberId, redemptions = [] }) {
  if (!redemptions.length) return []
  const inserted = []
  for (const r of redemptions) {
    const res = await pool.query(
      `INSERT INTO free_pass_redemption
         (member_pass_id, pass_template_id, member_id, signup_id, units, amount_cents_credited, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        r.memberPassId ?? null,
        r.passTemplateId ?? null,
        memberId ?? r.memberId ?? null,
        signupId ?? null,
        r.units ?? 1,
        r.amountCentsCredited ?? 0,
        JSON.stringify(r.context ?? {}),
      ],
    )
    inserted.push(Number(res.rows[0].id))

    if (r.memberPassId) {
      await pool.query(
        `UPDATE member_free_pass
         SET quantity_remaining = GREATEST(0, quantity_remaining - $1)
         WHERE id = $2`,
        [r.units ?? 1, r.memberPassId],
      )
    }
    if (r.passTemplateId) {
      await pool.query(
        `UPDATE free_pass_template SET redeemed_count = redeemed_count + 1, updated_at = now()
         WHERE id = $1`,
        [r.passTemplateId],
      )
    }
  }
  return inserted
}

export async function issueMemberPassGrant(pool, { memberId, passTemplateId, quantity = 1, issuedBy = 'admin', sourceRef = null, expiresAt = null }) {
  const templateRes = await pool.query(`SELECT * FROM free_pass_template WHERE id = $1`, [passTemplateId])
  if (!templateRes.rows[0]) return null
  const template = mapPassTemplateRow(templateRes.rows[0])
  const grantDays = template.config?.grant_expires_days
  let exp = expiresAt
  if (!exp && grantDays != null && Number(grantDays) > 0) {
    const d = new Date()
    d.setDate(d.getDate() + Number(grantDays))
    exp = d.toISOString()
  }
  const qty = Math.max(1, Number(quantity) || 1)
  const res = await pool.query(
    `INSERT INTO member_free_pass
       (member_id, pass_template_id, quantity_granted, quantity_remaining, expires_at, issued_by, source_ref)
     VALUES ($1, $2, $3, $3, $4, $5, $6)
     RETURNING *`,
    [memberId, passTemplateId, qty, exp, issuedBy, sourceRef],
  )
  return mapMemberPassRow({ ...res.rows[0], template_name: template.name })
}

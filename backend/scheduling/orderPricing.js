import { loadEffectivePricingForForm, parseProgramPromoCodes } from '../programs/pricingDefaults.js'
import { countAllocatedFreeSlotsForMember } from './freeSlotAllocation.js'
import { computeMonthlyPricingFromCosts } from './pricing.js'
import {
  hoursPerMonthForEnrollment,
  loadTimeSlotsBySlotGroupIds,
  monthlySlotCostDollars,
} from './slotHours.js'

export const SIGNUP_ORDER_PRICING_DISCLAIMER =
  'Pricing shown is a rough estimate and may not reflect your actual billing, current rates, or all discounts that apply to your account.'

function programSlotSignupKey(formId, categoryId, slotGroupId, timeSlotId) {
  return `${formId}:${categoryId ?? 'none'}:${slotGroupId}:${timeSlotId ?? 'none'}`
}

export function pricingScopeKey(formRow) {
  const programsId = formRow?.programs_id != null ? Number(formRow.programs_id) : null
  const overrides = Boolean(formRow?.pricing_overrides_program)
  if (!overrides && programsId != null) return `program:${programsId}`
  return `form:${Number(formRow.id)}`
}

export async function loadMemberScopeSignups(pool, formRow, memberId) {
  if (!memberId || !formRow) return []

  const programsId = formRow.programs_id != null ? Number(formRow.programs_id) : null
  const overrides = Boolean(formRow.pricing_overrides_program)
  const formId = Number(formRow.id)

  const baseSelect = `
    SELECT s.id, s.slot_group_id, s.time_slot_id, s.created_at
    FROM scheduling_signup s
  `

  let result
  if (!overrides && programsId != null) {
    result = await pool.query(
      `${baseSelect}
       JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
       WHERE sf.programs_id = $1
         AND s.member_id = $2
         AND s.orphaned_at IS NULL
         AND s.status IN ('confirmed', 'waitlisted')
       ORDER BY s.created_at ASC, s.id ASC`,
      [programsId, memberId],
    )
  } else {
    result = await pool.query(
      `${baseSelect}
       WHERE s.form_id = $1
         AND s.member_id = $2
         AND s.orphaned_at IS NULL
         AND s.status IN ('confirmed', 'waitlisted')
       ORDER BY s.created_at ASC, s.id ASC`,
      [formId, memberId],
    )
  }

  return result.rows.map((row) => ({
    id: Number(row.id),
    slotGroupId: Number(row.slot_group_id),
    timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
    createdAt: row.created_at,
  }))
}

function signupHoursPerMonth(entry, timeSlotsByGroup) {
  const slots = timeSlotsByGroup.get(Number(entry.slotGroupId)) || []
  return hoursPerMonthForEnrollment(slots, { timeSlotId: entry.timeSlotId ?? null })
}

function signupMonthlyCostDollars(entry, effectiveDbRow, timeSlotsByGroup) {
  const unit = effectiveDbRow?.cost_unit ?? 'per_month'
  if (unit === 'per_hour') {
    return monthlySlotCostDollars(effectiveDbRow, signupHoursPerMonth(entry, timeSlotsByGroup))
  }
  return monthlySlotCostDollars(effectiveDbRow, 1)
}

function pricingMetaFromRow(effectiveDbRow, hoursPerSlotMonthly = null) {
  return {
    freeSlotsPerUser: effectiveDbRow?.free_slots_per_user,
    maxFreeSlotsTotal: effectiveDbRow?.max_free_slots_total,
    costUnit: effectiveDbRow?.cost_unit ?? 'per_month',
    hoursPerSlotMonthly,
  }
}

async function buildMarginalPricing(
  pool,
  formRow,
  memberId,
  newEntries,
  effectiveDbRow,
  timeSlotsByGroup,
) {
  const memberSignups = await loadMemberScopeSignups(pool, formRow, memberId)
  const existingCosts = memberSignups.map((s) =>
    signupMonthlyCostDollars(s, effectiveDbRow, timeSlotsByGroup),
  )
  const existingHours = memberSignups.map((s) => signupHoursPerMonth(s, timeSlotsByGroup))
  const newCosts = newEntries.map((e) => signupMonthlyCostDollars(e, effectiveDbRow, timeSlotsByGroup))
  const newHours = newEntries.map((e) => signupHoursPerMonth(e, timeSlotsByGroup))

  const freeByExtra = new Map()
  for (let i = 0; i <= newEntries.length; i += 1) {
    freeByExtra.set(
      i,
      await countAllocatedFreeSlotsForMember(pool, formRow, memberId, effectiveDbRow, {
        extraMemberSignups: i,
      }),
    )
  }

  const increments = []
  for (let i = 1; i <= newEntries.length; i += 1) {
    const costsBefore = [...existingCosts, ...newCosts.slice(0, i - 1)]
    const costsAfter = [...existingCosts, ...newCosts.slice(0, i)]
    const hoursBefore = [...existingHours, ...newHours.slice(0, i - 1)]
    const hoursAfter = [...existingHours, ...newHours.slice(0, i)]
    const before = computeMonthlyPricingFromCosts(
      costsBefore,
      freeByExtra.get(i - 1) ?? 0,
      pricingMetaFromRow(effectiveDbRow, hoursBefore[0] ?? null),
    )
    const after = computeMonthlyPricingFromCosts(
      costsAfter,
      freeByExtra.get(i) ?? 0,
      pricingMetaFromRow(effectiveDbRow, hoursAfter[0] ?? null),
    )
    increments.push(Math.max(0, after.discountedMonthly - before.discountedMonthly))
  }

  const freeBefore = freeByExtra.get(0) ?? 0
  const freeAfter = freeByExtra.get(newEntries.length) ?? freeBefore
  const allCosts = [...existingCosts, ...newCosts]
  const allHours = [...existingHours, ...newHours]

  return {
    increments,
    pricingBefore: computeMonthlyPricingFromCosts(
      existingCosts,
      freeBefore,
      pricingMetaFromRow(effectiveDbRow, existingHours[0] ?? null),
    ),
    pricingAfter: computeMonthlyPricingFromCosts(
      allCosts,
      freeAfter,
      pricingMetaFromRow(effectiveDbRow, allHours[0] ?? null),
    ),
    existingCount: memberSignups.length,
    newCount: newEntries.length,
  }
}

async function loadExistingEnrollments(pool, memberId) {
  if (!memberId) return []

  const result = await pool.query(
    `
    SELECT s.id, s.form_id, s.category_id, s.slot_group_id, s.time_slot_id, s.status,
           sf.title AS form_title,
           COALESCE(sc.name, 'No Category') AS category_name,
           sg.display_label AS group_display_label,
           ts.display_label AS occurrence_display_label
    FROM scheduling_signup s
    JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
    LEFT JOIN scheduling_category sc ON sc.id = s.category_id
    JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
    LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
    WHERE s.member_id = $1
      AND s.orphaned_at IS NULL
      AND s.status IN ('confirmed', 'waitlisted')
    ORDER BY sf.title, category_name, s.id
    `,
    [memberId],
  )

  return result.rows.map((row) => {
    const formId = Number(row.form_id)
    const categoryId = row.category_id != null ? Number(row.category_id) : null
    const slotGroupId = Number(row.slot_group_id)
    const timeSlotId = row.time_slot_id != null ? Number(row.time_slot_id) : null
    return {
      id: Number(row.id),
      formId,
      formTitle: row.form_title,
      categoryName: row.category_name,
      slotLabel: row.occurrence_display_label || row.group_display_label || '',
      status: row.status,
      slotGroupId,
      timeSlotId,
      slotKey: programSlotSignupKey(formId, categoryId, slotGroupId, timeSlotId),
    }
  })
}

function signupSortKey(entry, formRows) {
  const formTitle = entry.formTitle || formRows.get(entry.formId)?.title || ''
  return [
    formTitle,
    entry.categoryName || '',
    entry.slotLabel || '',
    entry.slotGroupId,
    entry.timeSlotId ?? 0,
  ].join('\0')
}

export async function buildSignupOrderPreview(
  pool,
  { memberId, newSignups = [], promoCodes = [], memberContext = null },
) {
  const existing = await loadExistingEnrollments(pool, memberId)
  const existingKeys = new Set(existing.map((entry) => entry.slotKey))

  const filteredNew = newSignups.filter((entry) => {
    const key = programSlotSignupKey(
      entry.formId,
      entry.categoryId ?? null,
      entry.slotGroupId,
      entry.timeSlotId ?? null,
    )
    return !existingKeys.has(key)
  })

  const formIds = new Set([
    ...existing.map((entry) => entry.formId),
    ...filteredNew.map((entry) => entry.formId),
  ])

  const formRows = new Map()
  if (formIds.size > 0) {
    const formsRes = await pool.query(
      `SELECT * FROM scheduling_form WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
      [[...formIds]],
    )
    for (const row of formsRes.rows) {
      formRows.set(Number(row.id), row)
    }
  }

  const slotGroupIds = new Set([
    ...existing.map((e) => e.slotGroupId),
    ...filteredNew.map((e) => e.slotGroupId),
  ].filter((id) => id != null))
  const timeSlotsByGroup = await loadTimeSlotsBySlotGroupIds(pool, [...slotGroupIds])

  const offeringBySlotGroup = new Map()
  if (slotGroupIds.size > 0) {
    const groupsRes = await pool.query(
      `SELECT id, offering_id FROM scheduling_slot_group WHERE id = ANY($1::int[])`,
      [[...slotGroupIds]],
    )
    for (const row of groupsRes.rows) {
      offeringBySlotGroup.set(
        Number(row.id),
        row.offering_id != null ? Number(row.offering_id) : null,
      )
    }
  }

  const programTitles = new Map()
  const programIds = new Set(
    [...formRows.values()]
      .map((row) => (row.programs_id != null ? Number(row.programs_id) : null))
      .filter((id) => id != null),
  )
  if (programIds.size > 0) {
    const { resolveProgramsSchema } = await import('../programs/schema.js')
    const schema = await resolveProgramsSchema(pool)
    const programsRes = await pool.query(
      `SELECT id, name FROM ${schema.programsTable} WHERE id = ANY($1::int[])`,
      [[...programIds]],
    )
    for (const row of programsRes.rows) {
      programTitles.set(Number(row.id), row.name)
    }
  }

  const scopeMeta = new Map()
  for (const formRow of formRows.values()) {
    const scope = pricingScopeKey(formRow)
    if (scopeMeta.has(scope)) continue
    const { effectiveDbRow, programRow, effective } = await loadEffectivePricingForForm(pool, formRow)
    const programsId = formRow.programs_id != null ? Number(formRow.programs_id) : null
    const overrides = Boolean(formRow.pricing_overrides_program)
    const scopeTitle =
      !overrides && programsId != null
        ? programTitles.get(programsId) || formRow.title
        : formRow.title
    scopeMeta.set(scope, {
      scope,
      scopeTitle,
      representativeFormId: Number(formRow.id),
      effectiveDbRow,
      programsId,
      sportId: programRow?.primary_discipline_tag_id != null ? Number(programRow.primary_discipline_tag_id) : null,
      offeringId: null,
      programMaxFreeTotal: effective.maxFreeSlotsTotal ?? null,
      classMaxFreeTotal: effective.maxFreeSlotsTotal ?? null,
      maxDiscountRedemptions: effective.maxDiscountRedemptions ?? null,
      programAllowedPromoCodes: parseProgramPromoCodes(programRow),
      usesProgramPricing: !overrides && programsId != null,
    })
  }

  const newByScope = new Map()
  for (const entry of filteredNew) {
    const formRow = formRows.get(entry.formId)
    if (!formRow) continue
    const scope = pricingScopeKey(formRow)
    if (!newByScope.has(scope)) newByScope.set(scope, [])
    newByScope.get(scope).push(entry)
  }

  for (const entries of newByScope.values()) {
    entries.sort((a, b) => signupSortKey(a, formRows).localeCompare(signupSortKey(b, formRows)))
  }

  const incrementsBySignupKey = new Map()
  const formSummaries = []
  let existingMonthlyTotal = 0
  let estimatedMonthlyTotal = 0
  let totalDiscountMonthly = 0
  let newSignupMonthlyTotal = 0

  const sortedScopes = [...scopeMeta.keys()].sort((a, b) => {
    const titleA = scopeMeta.get(a)?.scopeTitle || ''
    const titleB = scopeMeta.get(b)?.scopeTitle || ''
    return titleA.localeCompare(titleB)
  })

  for (const scope of sortedScopes) {
    const meta = scopeMeta.get(scope)
    if (!meta) continue

    const newEntries = newByScope.get(scope) || []
    const formRow = formRows.get(meta.representativeFormId)
    const { increments, pricingBefore, pricingAfter, existingCount, newCount } =
      await buildMarginalPricing(
        pool,
        formRow,
        memberId,
        newEntries,
        meta.effectiveDbRow,
        timeSlotsByGroup,
      )
    const totalCount = existingCount + newCount
    const incrementalMonthly = Math.max(0, pricingAfter.discountedMonthly - pricingBefore.discountedMonthly)

    newEntries.forEach((entry, index) => {
      const key = programSlotSignupKey(
        entry.formId,
        entry.categoryId ?? null,
        entry.slotGroupId,
        entry.timeSlotId ?? null,
      )
      incrementsBySignupKey.set(key, increments[index] ?? 0)
    })

    existingMonthlyTotal += pricingBefore.discountedMonthly
    estimatedMonthlyTotal += pricingAfter.discountedMonthly
    totalDiscountMonthly += pricingAfter.discountMonthly
    newSignupMonthlyTotal += incrementalMonthly

    if (existingCount > 0 || newCount > 0) {
      formSummaries.push({
        formId: meta.representativeFormId,
        formTitle: meta.scopeTitle,
        existingSlotCount: existingCount,
        newSlotCount: newCount,
        totalSlotCount: totalCount,
        pricingBefore: pricingBefore.hasPricing ? pricingBefore : null,
        pricingAfter: pricingAfter.hasPricing ? pricingAfter : null,
        incrementalMonthly,
        discountMonthly: pricingAfter.discountMonthly,
      })
    }
  }

  const newSignupItems = filteredNew.map((entry) => {
    const formRow = formRows.get(entry.formId)
    const key = programSlotSignupKey(
      entry.formId,
      entry.categoryId ?? null,
      entry.slotGroupId,
      entry.timeSlotId ?? null,
    )
    const incrementalMonthly = incrementsBySignupKey.get(key) ?? 0
    const hoursPerMonth = signupHoursPerMonth(entry, timeSlotsByGroup)

    return {
      formId: entry.formId,
      formTitle: entry.formTitle || formRow?.title || 'Class',
      categoryName: entry.categoryName || 'No Category',
      slotLabel: entry.slotLabel || '',
      slotKey: key,
      incrementalMonthly,
      hoursPerMonth: hoursPerMonth > 0 ? Math.round(hoursPerMonth * 100) / 100 : null,
      isNew: true,
    }
  })

  const existingClasses = existing.map((entry) => ({
    id: entry.id,
    formId: entry.formId,
    formTitle: entry.formTitle,
    categoryName: entry.categoryName,
    slotLabel: entry.slotLabel,
    status: entry.status,
    isNew: false,
  }))

  const discounts = await computeDiscountLayer(pool, {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    existingCount: existing.length,
    promoCodes,
    memberContext,
  })

  const additionalFees = await computeAdditionalFeesLayer(pool, {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    offeringBySlotGroup,
    filteredNew,
    existingCount: existing.length,
  })

  const additionalFeesMonthly = (additionalFees.totalMonthlyCents ?? 0) / 100
  const additionalFeesOneTime = (additionalFees.totalOneTimeCents ?? 0) / 100

  return {
    memberId: memberId ?? null,
    existingClasses,
    newSignups: newSignupItems,
    formSummaries,
    existingMonthlyTotal,
    newSignupMonthlyTotal,
    estimatedMonthlyTotal: estimatedMonthlyTotal + additionalFeesMonthly,
    totalDiscountMonthly,
    discounts,
    additionalFees,
    additionalFeesMonthly,
    additionalFeesOneTime,
    hasPricing: formSummaries.some((summary) => summary.pricingAfter != null),
    disclaimer: SIGNUP_ORDER_PRICING_DISCLAIMER,
  }
}

/**
 * Layer the configurable discount/promo engine on top of the resolved per-line list prices.
 * Returns the engine breakdown plus the surviving estimated total after all discounts.
 */
export async function computeDiscountLayer(
  pool,
  { memberId, newSignupItems, formRows, scopeMeta, existingCount = 0, promoCodes = [], memberContext = null },
) {
  const empty = {
    enabled: false,
    lines: [],
    orderDiscounts: [],
    freeGrants: [],
    subtotalCents: 0,
    totalDiscountCents: 0,
    totalCents: 0,
    redemptions: [],
  }
  if (!newSignupItems.length) return empty

  let rules = []
  let caps = {}
  try {
    const { loadActiveDiscountRules, loadRedemptionCaps } = await import('./discountEngine.js')
    const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
    const facilityId = facilityRes.rows[0]?.id ?? null
    rules = await loadActiveDiscountRules(pool, facilityId)
    caps = await loadRedemptionCaps(pool, facilityId)
  } catch {
    return empty
  }
  if (!rules.length) return empty

  const memberCity = memberContext?.city ?? null
  const memberSchool = memberContext?.school ?? null
  const memberGraduationYear =
    memberContext?.graduationYear != null ? Number(memberContext.graduationYear) : null

  const lines = newSignupItems.map((item, index) => {
    const formRow = formRows.get(item.formId)
    const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
    return {
      key: item.slotKey,
      formId: item.formId,
      programId: scope?.programsId ?? null,
      sportId: scope?.sportId ?? null,
      offeringId: scope?.offeringId ?? null,
      memberId: memberId ?? null,
      memberCity,
      memberSchool,
      memberGraduationYear,
      classOrdinal: existingCount + index + 1,
      childOrdinal: 1,
      baseCents: Math.round((item.incrementalMonthly || 0) * 100),
      programMaxFreeTotal: scope?.programMaxFreeTotal ?? null,
      classMaxFreeTotal: scope?.classMaxFreeTotal ?? null,
      programMaxDiscountRedemptions: scope?.maxDiscountRedemptions ?? null,
      classMaxDiscountRedemptions: scope?.maxDiscountRedemptions ?? null,
      programAllowedPromoCodes: scope?.programAllowedPromoCodes ?? null,
    }
  })

  const { computeOrderDiscounts } = await import('./discountEngine.js')
  const result = computeOrderDiscounts({ lines, rules, promoCodes, caps })
  return { enabled: true, ...result }
}

/**
 * Layer additional fees (registration, annual, technology, etc.) on the order preview.
 */
export async function computeAdditionalFeesLayer(
  pool,
  {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    offeringBySlotGroup,
    filteredNew = [],
    existingCount = 0,
  },
) {
  const empty = {
    enabled: false,
    items: [],
    totalOneTimeCents: 0,
    totalMonthlyCents: 0,
    totalCents: 0,
  }
  if (!newSignupItems.length) return empty

  let fees = []
  try {
    const {
      loadActiveAdditionalFees,
      computeOrderAdditionalFees,
      loadMemberFeeRedemptionKeys,
    } = await import('./additionalFeesEngine.js')
    const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
    const facilityId = facilityRes.rows[0]?.id ?? null
    fees = await loadActiveAdditionalFees(pool, facilityId)
    if (!fees.length) return empty

    const isNewMember = existingCount === 0
    const oncePerYearIds = fees.filter((f) => f.triggerType === 'once_per_year').map((f) => f.id)
    const redeemedPeriodKeys = await loadMemberFeeRedemptionKeys(pool, memberId, oncePerYearIds)

    const offeringBySignupKey = new Map()
    for (const entry of filteredNew) {
      const key = programSlotSignupKey(
        entry.formId,
        entry.categoryId ?? null,
        entry.slotGroupId,
        entry.timeSlotId ?? null,
      )
      offeringBySignupKey.set(key, offeringBySlotGroup.get(entry.slotGroupId) ?? null)
    }

    const lines = newSignupItems.map((item) => {
      const formRow = formRows.get(item.formId)
      const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
      return {
        key: item.slotKey,
        formId: item.formId,
        programId: scope?.programsId ?? null,
        sportId: scope?.sportId ?? null,
        offeringId: offeringBySignupKey.get(item.slotKey) ?? null,
      }
    })

    return computeOrderAdditionalFees({
      fees,
      lines,
      isNewMember,
      redeemedPeriodKeys,
    })
  } catch {
    return empty
  }
}

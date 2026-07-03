import { loadEffectivePricingForForm, parseProgramPromoCodes } from '../programs/pricingDefaults.js'
import {
  costFromPricingOptionKey,
  effectiveDbRowFromPricingOption,
  normalizeProgramPricingOptions,
} from '../programs/programPricingOptions.js'
import {
  formatWeeklyTierLabel,
  maxEnabledWeeklySlots,
  programUsesWeeklyTierPricing,
  weeklyTierExceedsMaxMessage,
  weeklyTierForSlotCount,
  weeklyTierMarginalCostsDollars,
  weeklyTierTotalDollars,
} from '../programs/weeklyTierPricing.js'
import {
  loadProgramPassPackages,
  totalRemainingClassesForProgram,
} from '../programs/multiClassPass.js'
import { countAllocatedFreeSlotsForMember } from './freeSlotAllocation.js'
import { billingTypeForCostUnit, computeMonthlyPricingFromCosts } from './pricing.js'
import {
  hoursPerMonthForEnrollment,
  loadTimeSlotsBySlotGroupIds,
  monthlySlotCostDollars,
} from './slotHours.js'
import {
  buildEnrollmentDisplayContext,
  loadGroupDisplayLabels,
  slotLabelForSignupRow,
} from './slotDisplayLabel.js'

export const SIGNUP_ORDER_PRICING_DISCLAIMER =
  'Pricing shown is a rough estimate and may not reflect your actual billing, current rates, or all discounts that apply to your account.'

async function resolveLineCostBenefits(
  pool,
  { sportId, programId, formId, programPromoCodes },
  discountRules = [],
) {
  const {
    resolveBenefitSelectionsForLine,
    mergeLegacyProgramPromos,
    enrichPromoCodesFromSelections,
  } = await import('./benefitSelection.js')

  let resolved = await resolveBenefitSelectionsForLine(pool, {
    sportId,
    programId,
    formId,
  })
  resolved = mergeLegacyProgramPromos(resolved, programPromoCodes)
  if (discountRules.length) {
    resolved = enrichPromoCodesFromSelections(resolved, discountRules)
  }

  if (!resolved.usesCostSelections && formId != null) {
    const formRes = await pool.query(`SELECT * FROM scheduling_form WHERE id = $1`, [formId])
    const formRow = formRes.rows[0]
    if (formRow) {
      const { loadAttachmentsForForm } = await import('./freePassEngine.js')
      const legacy = await loadAttachmentsForForm(pool, formRow)
      resolved.freePassAttachments = legacy.map((a) => ({
        passTemplateId: a.passTemplateId,
        autoApply: a.autoApply,
        allowMemberCode: false,
      }))
    }
  } else {
    resolved.freePassAttachments = resolved.freePassAttachments.map((a) => {
      const sel = resolved.selections.find(
        (s) => s.benefitType === 'free_pass' && s.benefitId === a.passTemplateId,
      )
      return {
        passTemplateId: a.passTemplateId,
        autoApply: a.autoApply,
        allowMemberCode: sel?.allowMemberCode !== false,
      }
    })
  }

  return {
    costUsesSelections: resolved.usesCostSelections,
    costDiscountRuleIds: resolved.discountRuleIds,
    costAllowedPromoCodes: [...resolved.allowedPromoCodes],
    autoPromoCodes: [...resolved.autoPromoCodes],
    freePassAttachments: resolved.freePassAttachments,
  }
}

function programSlotSignupKey(formId, slotGroupId, timeSlotId) {
  return `${formId}:${slotGroupId}:${timeSlotId ?? 'none'}`
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

export class WeeklyTierSlotLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WeeklyTierSlotLimitError'
    this.statusCode = 400
  }
}

/**
 * Weekly tiers are bundle prices by slot count: 2 slots @ 2×/wk = $250 total, not $250×2.
 * Marginal cost of slot n = tier(n) − tier(n−1) (e.g. 3rd class +$100 when 1×=$150, 2×=$250).
 * Free-slot grants apply to the marginal cost array like per-slot pricing.
 */
async function buildMarginalWeeklyTierPricing(
  pool,
  formRow,
  memberId,
  newEntries,
  programRow,
  effectiveDbRow,
) {
  const pricingOptions = programRow?.pricing_cost_options
  const memberSignups = await loadMemberScopeSignups(pool, formRow, memberId)
  const existingCount = memberSignups.length
  const maxSlots = maxEnabledWeeklySlots(normalizeProgramPricingOptions(pricingOptions))
  const totalAfter = existingCount + newEntries.length

  if (totalAfter > maxSlots) {
    throw new WeeklyTierSlotLimitError(weeklyTierExceedsMaxMessage(maxSlots))
  }

  const existingMarginals = weeklyTierMarginalCostsDollars(existingCount, pricingOptions) ?? []
  const rawNewMarginals = []
  for (let i = 1; i <= newEntries.length; i += 1) {
    const slotIndex = existingCount + i
    const marginal = weeklyTierMarginalCostsDollars(slotIndex, pricingOptions)
    if (!marginal || marginal.length < slotIndex) {
      throw new WeeklyTierSlotLimitError(weeklyTierExceedsMaxMessage(maxSlots))
    }
    rawNewMarginals.push(marginal[slotIndex - 1])
  }

  const freeByExtra = new Map()
  for (let i = 0; i <= newEntries.length; i += 1) {
    freeByExtra.set(
      i,
      await countAllocatedFreeSlotsForMember(pool, formRow, memberId, effectiveDbRow, {
        extraMemberSignups: i,
      }),
    )
  }

  const meta = pricingMetaFromRow(effectiveDbRow, null)
  const increments = []
  for (let i = 1; i <= newEntries.length; i += 1) {
    const costsBefore = [...existingMarginals, ...rawNewMarginals.slice(0, i - 1)]
    const costsAfter = [...existingMarginals, ...rawNewMarginals.slice(0, i)]
    const before = computeMonthlyPricingFromCosts(
      costsBefore,
      freeByExtra.get(i - 1) ?? 0,
      meta,
    )
    const after = computeMonthlyPricingFromCosts(costsAfter, freeByExtra.get(i) ?? 0, meta)
    increments.push(Math.max(0, after.discountedMonthly - before.discountedMonthly))
  }

  const freeBefore = freeByExtra.get(0) ?? 0
  const freeAfter = freeByExtra.get(newEntries.length) ?? freeBefore
  const allMarginals = [...existingMarginals, ...rawNewMarginals]

  const existingIncrementsById = new Map()
  for (let i = 1; i <= memberSignups.length; i += 1) {
    const before = computeMonthlyPricingFromCosts(
      existingMarginals.slice(0, i - 1),
      freeBefore,
      meta,
    )
    const after = computeMonthlyPricingFromCosts(existingMarginals.slice(0, i), freeBefore, meta)
    existingIncrementsById.set(
      memberSignups[i - 1].id,
      Math.max(0, after.discountedMonthly - before.discountedMonthly),
    )
  }

  const tierAfter = weeklyTierForSlotCount(totalAfter, pricingOptions)
  const tierBefore =
    existingCount > 0 ? weeklyTierForSlotCount(existingCount, pricingOptions) : null

  return {
    increments,
    existingIncrementsById,
    pricingBefore: computeMonthlyPricingFromCosts(existingMarginals, freeBefore, meta),
    pricingAfter: computeMonthlyPricingFromCosts(allMarginals, freeAfter, meta),
    existingCount,
    newCount: newEntries.length,
    usesWeeklyTierPricing: true,
    weeklyTierTotalMonthly: weeklyTierTotalDollars(totalAfter, pricingOptions),
    weeklyTierLabel: tierAfter
      ? formatWeeklyTierLabel(tierAfter.slotCount, tierAfter.amountCents)
      : null,
    weeklyTierBeforeLabel: tierBefore
      ? formatWeeklyTierLabel(tierBefore.slotCount, tierBefore.amountCents)
      : null,
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

  // Allocate the existing monthly total across each existing slot so the per-class
  // prices reconcile to pricingBefore.discountedMonthly.
  const existingIncrementsById = new Map()
  for (let i = 1; i <= memberSignups.length; i += 1) {
    const before = computeMonthlyPricingFromCosts(
      existingCosts.slice(0, i - 1),
      freeBefore,
      pricingMetaFromRow(effectiveDbRow, existingHours[0] ?? null),
    )
    const after = computeMonthlyPricingFromCosts(
      existingCosts.slice(0, i),
      freeBefore,
      pricingMetaFromRow(effectiveDbRow, existingHours[0] ?? null),
    )
    existingIncrementsById.set(
      memberSignups[i - 1].id,
      Math.max(0, after.discountedMonthly - before.discountedMonthly),
    )
  }

  return {
    increments,
    existingIncrementsById,
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
    SELECT s.id, s.form_id, s.slot_group_id, s.time_slot_id, s.status,
           sf.title AS form_title,
           ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week,
           ts.start_time, ts.end_time
    FROM scheduling_signup s
    JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
    JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
    LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
    WHERE s.member_id = $1
      AND s.orphaned_at IS NULL
      AND s.status IN ('confirmed', 'waitlisted')
    ORDER BY sf.title, s.id
    `,
    [memberId],
  )

  const groupIds = result.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)

  return result.rows.map((row) => {
    const formId = Number(row.form_id)
    const slotGroupId = Number(row.slot_group_id)
    const timeSlotId = row.time_slot_id != null ? Number(row.time_slot_id) : null
    return {
      id: Number(row.id),
      formId,
      formTitle: row.form_title,
      slotLabel: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
      status: row.status,
      slotGroupId,
      timeSlotId,
      slotKey: programSlotSignupKey(formId, slotGroupId, timeSlotId),
      schedule_mode: row.schedule_mode,
      specific_date: row.specific_date,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      week_letter: row.week_letter,
    }
  })
}

function attachClassDisplayFields(
  item,
  { formRows, programMeta, offeringMetaByGroup, timeSlotsByGroup, groupLabels, rowsByGroupId },
) {
  const formRow = formRows.get(item.formId)
  const programsId =
    item.programsId != null
      ? Number(item.programsId)
      : formRow?.programs_id != null
        ? Number(formRow.programs_id)
        : null
  const meta = programsId != null ? programMeta.get(programsId) : null
  const offeringMeta =
    item.slotGroupId != null ? offeringMetaByGroup.get(Number(item.slotGroupId)) : null
  const ctx = buildEnrollmentDisplayContext({
    sportName: meta?.sportName ?? null,
    programName: meta?.programName ?? null,
    className: item.formTitle || formRow?.title || 'Class',
    formRow,
    entry: item,
    offeringMeta,
    timeSlotsByGroup,
    groupLabels,
    rowsByGroupId,
  })
  return {
    ...item,
    sportName: ctx.sportName,
    programName: ctx.programName,
    className: ctx.className,
    offeringDates: ctx.offeringDates,
    scheduleDays: ctx.scheduleDays,
    scheduleTimes: ctx.scheduleTimes,
    displayLine: ctx.displayLine,
    formTitle: ctx.className,
    slotLabel: ctx.slotLabel,
  }
}

function signupSortKey(entry, formRows) {
  const formTitle = entry.formTitle || formRows.get(entry.formId)?.title || ''
  return [
    formTitle,
    entry.slotLabel || '',
    entry.slotGroupId,
    entry.timeSlotId ?? 0,
  ].join('\0')
}

export async function buildSignupOrderPreview(
  pool,
  { memberId, newSignups = [], promoCodes = [], memberContext = null },
) {
  const slotSignups = []
  const passPurchases = []
  for (const entry of newSignups) {
    if (entry?.lineType === 'multi_class_pass') {
      passPurchases.push(entry)
    } else {
      slotSignups.push(entry)
    }
  }

  const existing = await loadExistingEnrollments(pool, memberId)
  const existingKeys = new Set(existing.map((entry) => entry.slotKey))

  const filteredNew = slotSignups.filter((entry) => {
    const key = programSlotSignupKey(
      entry.formId,
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
  const offeringMetaByGroup = new Map()
  if (slotGroupIds.size > 0) {
    const groupsRes = await pool.query(
      `SELECT sg.id, sg.offering_id, sg.active_start AS group_active_start,
              sg.active_end AS group_active_end, sg.dates_tbd,
              o.label AS offering_label, o.start_date AS offering_start_date,
              o.end_date AS offering_end_date
       FROM scheduling_slot_group sg
       LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
       WHERE sg.id = ANY($1::int[])`,
      [[...slotGroupIds]],
    )
    for (const row of groupsRes.rows) {
      const groupId = Number(row.id)
      offeringBySlotGroup.set(groupId, row.offering_id != null ? Number(row.offering_id) : null)
      offeringMetaByGroup.set(groupId, row)
    }
  }

  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, [...slotGroupIds])

  const programTitles = new Map()
  const programMeta = new Map()
  const programIds = new Set(
    [...formRows.values()]
      .map((row) => (row.programs_id != null ? Number(row.programs_id) : null))
      .filter((id) => id != null),
  )
  if (programIds.size > 0) {
    const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
    await ensurePrimaryDisciplineTagColumn(pool)
    const schema = await resolveProgramsSchema(pool)
    const programsRes = await pool.query(
      `SELECT p.id, p.name, p.display_name, dt.name AS sport_name
       FROM ${schema.programsTable} p
       LEFT JOIN discipline_tag dt ON dt.id = p.primary_discipline_tag_id
       WHERE p.id = ANY($1::int[])`,
      [[...programIds]],
    )
    for (const row of programsRes.rows) {
      const id = Number(row.id)
      programTitles.set(id, row.display_name || row.name)
      programMeta.set(id, {
        programName: row.display_name || row.name,
        sportName: row.sport_name || null,
      })
    }
  }

  const displayContext = {
    formRows,
    programMeta,
    offeringMetaByGroup,
    timeSlotsByGroup,
    groupLabels,
    rowsByGroupId,
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
      programRow,
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
  const existingPriceById = new Map()
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
    let effectiveDbRow = meta.effectiveDbRow
    const usesWeeklyTiers =
      meta.usesProgramPricing &&
      meta.programRow &&
      programUsesWeeklyTierPricing(meta.programRow)

    let marginalResult
    if (usesWeeklyTiers) {
      marginalResult = await buildMarginalWeeklyTierPricing(
        pool,
        formRow,
        memberId,
        newEntries,
        meta.programRow,
        effectiveDbRow,
      )
    } else {
      const optionKeys = [
        ...new Set(
          newEntries
            .map((e) => e.selectedPricingOptionKey)
            .filter((k) => typeof k === 'string' && k.length > 0),
        ),
      ]
      if (optionKeys.length === 1 && meta.programRow) {
        effectiveDbRow = effectiveDbRowFromPricingOption(
          effectiveDbRow,
          meta.programRow,
          optionKeys[0],
        )
      }
      marginalResult = await buildMarginalPricing(
        pool,
        formRow,
        memberId,
        newEntries,
        effectiveDbRow,
        timeSlotsByGroup,
      )
    }

    const {
      increments,
      existingIncrementsById,
      pricingBefore,
      pricingAfter,
      existingCount,
      newCount,
      usesWeeklyTierPricing: scopeUsesWeeklyTiers,
      weeklyTierTotalMonthly,
      weeklyTierLabel,
      weeklyTierBeforeLabel,
    } = marginalResult

    if (existingIncrementsById) {
      for (const [signupId, monthly] of existingIncrementsById) {
        existingPriceById.set(signupId, monthly)
      }
    }
    const totalCount = existingCount + newCount
    const incrementalMonthly = Math.max(0, pricingAfter.discountedMonthly - pricingBefore.discountedMonthly)

    newEntries.forEach((entry, index) => {
      const key = programSlotSignupKey(
        entry.formId,
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
        usesWeeklyTierPricing: Boolean(scopeUsesWeeklyTiers),
        weeklyTierTotalMonthly: weeklyTierTotalMonthly ?? null,
        weeklyTierLabel: weeklyTierLabel ?? null,
        weeklyTierBeforeLabel: weeklyTierBeforeLabel ?? null,
      })
    }
  }

  const newSignupItems = filteredNew.map((entry) => {
    const formRow = formRows.get(entry.formId)
    const key = programSlotSignupKey(
      entry.formId,
      entry.slotGroupId,
      entry.timeSlotId ?? null,
    )
    const incrementalMonthly = incrementsBySignupKey.get(key) ?? 0
    const hoursPerMonth = signupHoursPerMonth(entry, timeSlotsByGroup)
    const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
    const programsId = scope?.programsId ?? null

    // Classify recurring vs one-time from the effective cost unit / selected option.
    let costUnit = scope?.effectiveDbRow?.cost_unit ?? 'per_month'
    const usesWeeklyTiers =
      scope?.usesProgramPricing && scope?.programRow && programUsesWeeklyTierPricing(scope.programRow)
    if (usesWeeklyTiers) {
      costUnit = 'per_month'
    } else if (entry.selectedPricingOptionKey && scope?.programRow) {
      const opt = costFromPricingOptionKey(
        entry.selectedPricingOptionKey,
        normalizeProgramPricingOptions(scope.programRow.pricing_cost_options),
      )
      if (opt?.unit) costUnit = opt.unit
    }
    const billingType = billingTypeForCostUnit(costUnit)

    return {
      formId: entry.formId,
      formTitle: entry.formTitle || formRow?.title || 'Class',
      slotLabel: entry.slotLabel || '',
      slotKey: key,
      slotGroupId: entry.slotGroupId,
      timeSlotId: entry.timeSlotId ?? null,
      offeringId: offeringBySlotGroup.get(entry.slotGroupId) ?? null,
      incrementalMonthly,
      hoursPerMonth: hoursPerMonth > 0 ? Math.round(hoursPerMonth * 100) / 100 : null,
      isNew: true,
      lineType: 'slot',
      selectedPricingOptionKey: entry.selectedPricingOptionKey ?? null,
      useMultiClassPass: entry.useMultiClassPass !== false,
      programsId,
      costUnit,
      billingType,
    }
  })

  const passBalancesByProgram = new Map()
  if (memberId != null) {
    for (const scope of scopeMeta.values()) {
      if (scope.programsId == null) continue
      const remaining = await totalRemainingClassesForProgram(pool, memberId, scope.programsId)
      passBalancesByProgram.set(scope.programsId, remaining)
    }
  }

  const passRedemptionPreview = []
  for (const item of newSignupItems) {
    if (!item.useMultiClassPass || item.programsId == null || memberId == null) continue
    const remaining = passBalancesByProgram.get(item.programsId) ?? 0
    const alreadyReserved = passRedemptionPreview.filter((p) => p.programsId === item.programsId).length
    if (remaining > alreadyReserved) {
      const after = remaining - alreadyReserved - 1
      item.incrementalMonthly = 0
      item.multiClassPassApplied = true
      item.classesRemainingAfterEnrollment = after
      passRedemptionPreview.push({
        programsId: item.programsId,
        slotKey: item.slotKey,
        classesRemainingAfter: after,
      })
    }
  }

  const passPurchaseItems = []
  let passPurchaseTotalCents = 0
  for (const purchase of passPurchases) {
    const programsId = Number(purchase.programsId)
    if (!Number.isFinite(programsId)) continue
    const packages = await loadProgramPassPackages(pool, programsId)
    const pkg = packages.find((p) => p.id === purchase.packageId)
    if (!pkg) continue
    passPurchaseItems.push({
      lineType: 'multi_class_pass',
      programsId,
      packageId: pkg.id,
      label: pkg.label,
      classCount: pkg.classCount,
      priceCents: pkg.priceCents,
      priceDollars: pkg.priceCents / 100,
    })
    passPurchaseTotalCents += pkg.priceCents
  }

  const freePasses = await computeFreePassLayer(pool, {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    offeringBySlotGroup,
    filteredNew,
    promoCodes,
    memberContext,
    existingEnrollments: existing,
  })

  let familyId = memberContext?.familyId != null ? Number(memberContext.familyId) : null
  if (familyId == null && memberId != null) {
    try {
      const famRes = await pool.query('SELECT family_id FROM member WHERE id = $1', [memberId])
      familyId = famRes.rows[0]?.family_id != null ? Number(famRes.rows[0].family_id) : null
    } catch {
      familyId = null
    }
  }

  const previewExistingLines = existing
    .map((entry) => {
      const monthly = existingPriceById.get(entry.id) ?? 0
      if (monthly <= 0) return null
      const formRow = formRows.get(entry.formId)
      const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
      return {
        key: `preview-existing-${entry.id}`,
        signupId: entry.id,
        formId: entry.formId,
        programId: scope?.programsId ?? null,
        sportId: scope?.sportId ?? null,
        memberId: memberId ?? null,
        familyId,
        baseCents: Math.round(monthly * 100),
        listCents: Math.round(monthly * 100),
        finalCents: Math.round(monthly * 100),
        includeInSubtotal: false,
        shadowOnly: true,
      }
    })
    .filter(Boolean)

  const discounts = await computeDiscountLayer(pool, {
    memberId,
    newSignupItems: freePasses.adjustedSignupItems,
    formRows,
    scopeMeta,
    existingCount: existing.length,
    promoCodes,
    memberContext,
    previewExistingLines,
  })

  const existingClasses = existing.map((entry) =>
    attachClassDisplayFields(
      {
        id: entry.id,
        formId: entry.formId,
        formTitle: entry.formTitle,
        slotLabel: entry.slotLabel,
        status: entry.status,
        slotGroupId: entry.slotGroupId,
        timeSlotId: entry.timeSlotId,
        monthlyPrice: existingPriceById.get(entry.id) ?? 0,
        isNew: false,
        schedule_mode: entry.schedule_mode,
        specific_date: entry.specific_date,
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        week_letter: entry.week_letter,
      },
      displayContext,
    ),
  )

  const newSignupsWithDisplay = freePasses.adjustedSignupItems.map((item) =>
    attachClassDisplayFields(item, displayContext),
  )

  const firstMonth = await computeFirstMonthLayer(pool, {
    newSignupItems: newSignupsWithDisplay,
    discounts,
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
  const engineDiscountMonthly = discounts.enabled ? (discounts.totalDiscountCents ?? 0) / 100 : 0

  return {
    memberId: memberId ?? null,
    existingClasses,
    newSignups: newSignupsWithDisplay,
    passPurchases: passPurchaseItems,
    passPurchaseTotalCents,
    passBalancesByProgram: Object.fromEntries(passBalancesByProgram),
    passRedemptionPreview,
    formSummaries,
    existingMonthlyTotal,
    newSignupMonthlyTotal,
    estimatedMonthlyTotal:
      estimatedMonthlyTotal +
      additionalFeesMonthly -
      (freePasses.totalCreditCents ?? 0) / 100 -
      engineDiscountMonthly,
    totalDiscountMonthly: totalDiscountMonthly + engineDiscountMonthly,
    freePasses,
    discounts,
    firstMonth,
    additionalFees,
    additionalFeesMonthly,
    additionalFeesOneTime,
    hasPricing: formSummaries.some((summary) => summary.pricingAfter != null) || passPurchaseItems.length > 0,
    disclaimer: SIGNUP_ORDER_PRICING_DISCLAIMER,
  }
}

/**
 * Layer free pass entitlements on signup lines before discounts.
 */
export async function computeFreePassLayer(
  pool,
  {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    offeringBySlotGroup,
    filteredNew = [],
    promoCodes = [],
    memberContext = null,
    existingEnrollments = [],
  },
) {
  const empty = {
    enabled: false,
    items: [],
    totalCreditCents: 0,
    redemptions: [],
    adjustedSignupItems: newSignupItems,
  }
  if (!newSignupItems.length) return empty

  try {
    const {
      applyFreePassLayer,
      loadActivePassTemplates,
      loadCalendarRowsForSlotGroups,
      loadFreePassCaps,
      loadMemberPassGrants,
      loadOfferingById,
      loadActiveSchools,
      memberIsFirstTimeEnrollee,
    } = await import('./freePassEngine.js')

    const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
    const facilityId = facilityRes.rows[0]?.id ?? null
    const templates = await loadActivePassTemplates(pool, facilityId)
    const grants = memberId ? await loadMemberPassGrants(pool, memberId) : []
    const caps = await loadFreePassCaps(pool, facilityId)
    const knownSchools = await loadActiveSchools(pool)

    const slotGroupIds = [
      ...new Set(
        filteredNew.map((e) => e.slotGroupId).filter((id) => id != null),
      ),
    ]
    const calendarRowsByGroup = await loadCalendarRowsForSlotGroups(pool, slotGroupIds)

    const offeringsById = new Map()
    for (const entry of filteredNew) {
      const oid = offeringBySlotGroup.get(entry.slotGroupId)
      if (oid != null && !offeringsById.has(oid)) {
        const offering = await loadOfferingById(pool, oid)
        if (offering) offeringsById.set(oid, offering)
      }
    }

    const memberCity = memberContext?.city ?? null
    const memberSchool = memberContext?.school ?? null
    const memberGraduationYear =
      memberContext?.graduationYear != null ? Number(memberContext.graduationYear) : null

    const lines = []
    for (const item of newSignupItems) {
      const formRow = formRows.get(item.formId)
      const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
      const costBenefits = await resolveLineCostBenefits(
        pool,
        {
          sportId: scope?.sportId ?? null,
          programId: scope?.programsId ?? null,
          formId: item.formId,
          programPromoCodes: scope?.programAllowedPromoCodes ?? [],
        },
        [],
      )
      lines.push({
        key: item.slotKey,
        formId: item.formId,
        programId: scope?.programsId ?? null,
        sportId: scope?.sportId ?? null,
        offeringId: item.offeringId ?? null,
        slotGroupId: item.slotGroupId ?? null,
        timeSlotId: item.timeSlotId ?? null,
        memberId: memberId ?? null,
        memberCity,
        memberSchool,
        memberGraduationYear,
        baseCents: Math.round((item.incrementalMonthly || 0) * 100),
        costUsesSelections: costBenefits.costUsesSelections,
        freePassAttachments: costBenefits.freePassAttachments,
      })
    }

    const result = applyFreePassLayer({
      lines,
      templates,
      grants,
      attachments: [],
      promoCodes,
      caps,
      offeringsById,
      timeSlotsByGroup: calendarRowsByGroup,
      isFirstTimeEnrollee: memberIsFirstTimeEnrollee(existingEnrollments),
      knownSchools,
    })

    const creditByKey = new Map()
    for (const item of result.items) {
      creditByKey.set(item.lineKey, (creditByKey.get(item.lineKey) || 0) + item.creditCents)
    }

    const adjustedSignupItems = newSignupItems.map((item) => {
      const creditCents = creditByKey.get(item.slotKey) || 0
      const passItems = result.items.filter((p) => p.lineKey === item.slotKey)
      return {
        ...item,
        incrementalMonthly: Math.max(0, (item.incrementalMonthly || 0) - creditCents / 100),
        passCreditCents: creditCents,
        passItems,
      }
    })

    return {
      enabled: result.enabled,
      items: result.items,
      totalCreditCents: result.totalCreditCents,
      redemptions: result.redemptions,
      adjustedSignupItems,
    }
  } catch {
    return empty
  }
}

/**
 * First-month proration layer. Billing renews on the 1st, so the first month is
 * charged at netMonthly * min(remainingSessions, CLASSES_PER_MONTH) / CLASSES_PER_MONTH
 * based on the class's real remaining occurrences in the signup month. Classes with
 * no sessions left this month owe $0 now and start billing on the 1st of their
 * start month.
 */
export async function computeFirstMonthLayer(pool, { newSignupItems, discounts, asOfDate = null }) {
  const empty = {
    enabled: false,
    periodStart: null,
    periodEnd: null,
    classesPerMonth: 4,
    items: [],
    totalCents: 0,
  }
  const recurringItems = newSignupItems.filter(
    (item) => item.lineType === 'slot' && item.billingType === 'recurring',
  )
  if (!recurringItems.length) return empty

  try {
    const { loadCalendarRowsForSlotGroups } = await import('./freePassEngine.js')
    const {
      CLASSES_PER_MONTH,
      monthBounds,
      prorationForLine,
      todayDateOnly,
    } = await import('./firstMonthProration.js')

    const fromDate = asOfDate ?? todayDateOnly()
    const { monthEnd } = monthBounds(fromDate)

    const slotGroupIds = [...new Set(recurringItems.map((i) => i.slotGroupId).filter((id) => id != null))]
    const rowsByGroup = await loadCalendarRowsForSlotGroups(pool, slotGroupIds)
    const calendarRows = [...rowsByGroup.values()].flat()

    // Per-line net after per-line discounts, from the discount layer when available.
    const discountLineByKey = new Map(
      discounts?.enabled ? discounts.lines.map((l) => [l.key, l]) : [],
    )
    const lineFacts = recurringItems.map((item) => {
      const dl = discountLineByKey.get(item.slotKey)
      const baseCents = dl?.baseCents ?? Math.round((item.incrementalMonthly || 0) * 100)
      const netCents = dl?.finalCents ?? baseCents
      return { item, baseCents, netCents }
    })

    // Order-level discounts (e.g. household spend discount) reduce this checkout's
    // monthly total in full; allocate them across the new lines by base price.
    const orderDiscountCents = discounts?.enabled
      ? discounts.orderDiscounts.reduce((sum, d) => sum + (d.amountCents || 0), 0)
      : 0
    const allocBase = lineFacts.reduce((sum, f) => sum + f.baseCents, 0)
    let remainingOrderDiscount = orderDiscountCents
    lineFacts.forEach((fact, i) => {
      let share = 0
      if (orderDiscountCents > 0 && allocBase > 0) {
        share =
          i === lineFacts.length - 1
            ? remainingOrderDiscount
            : Math.min(
                remainingOrderDiscount,
                Math.round(orderDiscountCents * (fact.baseCents / allocBase)),
              )
      }
      remainingOrderDiscount -= share
      fact.effectiveNetCents = Math.max(0, fact.netCents - share)
    })

    const items = []
    let totalCents = 0
    for (const fact of lineFacts) {
      // Pass-covered / free lines carry no first-month charge.
      if (fact.baseCents <= 0) continue
      const proration = prorationForLine(calendarRows, {
        slotGroupId: fact.item.slotGroupId,
        timeSlotId: fact.item.timeSlotId ?? null,
        fromDate,
      })
      const proratedCents = Math.round(fact.effectiveNetCents * proration.ratio)
      totalCents += proratedCents
      items.push({
        slotKey: fact.item.slotKey,
        formId: fact.item.formId,
        formTitle: fact.item.formTitle,
        displayLine: fact.item.displayLine ?? null,
        remainingClasses: proration.remainingClasses,
        classesPerMonth: CLASSES_PER_MONTH,
        ratio: proration.ratio,
        monthlyNetCents: fact.effectiveNetCents,
        proratedCents,
        classStartsFutureMonth: proration.classStartsFutureMonth,
        firstBillDate: proration.firstBillDate,
      })
    }

    if (!items.length) return empty
    return {
      enabled: true,
      periodStart: fromDate,
      periodEnd: monthEnd,
      classesPerMonth: CLASSES_PER_MONTH,
      items,
      totalCents,
    }
  } catch (err) {
    console.warn('[scheduling] first-month proration unavailable:', err?.message ?? err)
    return empty
  }
}

/**
 * Layer the configurable discount/promo engine on top of the resolved per-line list prices.
 * Returns the engine breakdown plus the surviving estimated total after all discounts.
 */
export async function computeDiscountLayer(
  pool,
  {
    memberId,
    newSignupItems,
    formRows,
    scopeMeta,
    existingCount = 0,
    promoCodes = [],
    memberContext = null,
    previewExistingLines = [],
  },
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

  let familyId = memberContext?.familyId != null ? Number(memberContext.familyId) : null
  if (familyId == null && memberId != null) {
    try {
      const famRes = await pool.query('SELECT family_id FROM member WHERE id = $1', [memberId])
      familyId = famRes.rows[0]?.family_id != null ? Number(famRes.rows[0].family_id) : null
    } catch {
      familyId = null
    }
  }

  const lines = []
  for (let index = 0; index < newSignupItems.length; index += 1) {
    const item = newSignupItems[index]
    const formRow = formRows.get(item.formId)
    const scope = formRow ? scopeMeta.get(pricingScopeKey(formRow)) : null
    const costBenefits = await resolveLineCostBenefits(
      pool,
      {
        sportId: scope?.sportId ?? null,
        programId: scope?.programsId ?? null,
        formId: item.formId,
        programPromoCodes: scope?.programAllowedPromoCodes ?? [],
      },
      rules,
    )
    lines.push({
      key: item.slotKey,
      formId: item.formId,
      programId: scope?.programsId ?? null,
      sportId: scope?.sportId ?? null,
      offeringId: scope?.offeringId ?? null,
      memberId: memberId ?? null,
      familyId,
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
      costUsesSelections: costBenefits.costUsesSelections,
      costDiscountRuleIds: costBenefits.costDiscountRuleIds,
      costAllowedPromoCodes: costBenefits.costAllowedPromoCodes,
      autoPromoCodes: costBenefits.autoPromoCodes,
      includeInSubtotal: true,
      listCents: Math.round((item.incrementalMonthly || 0) * 100),
      finalCents: Math.round((item.incrementalMonthly || 0) * 100),
    })
  }

  if (familyId != null || memberId != null) {
    try {
      const {
        computeAccountDiscountStats,
        isMultiClassSystemRule,
        isHouseholdSpendVolumeRule,
        multiClassMinPerClassCents,
        monthlySpendMinPerClassCents,
      } = await import('./systemDiscounts.js')
      const multiClassRule = rules.find(isMultiClassSystemRule)
      const spendRule = rules.find(isHouseholdSpendVolumeRule)
      if (multiClassRule || spendRule) {
        const minPerClassCents = Math.max(
          multiClassRule ? multiClassMinPerClassCents(multiClassRule) : 0,
          spendRule ? monthlySpendMinPerClassCents(spendRule) : 0,
        )
        const accountStats = await computeAccountDiscountStats(
          pool,
          { familyId, memberId },
          lines,
          { minPerClassCents, previewExistingLines },
        )
        const attachStats = (line) => {
          line.accountPaidClassCount = accountStats.paidClassCount
          line.accountMonthlyCents = accountStats.accountMonthlyCents
          line.accountAllLines = accountStats.allLines
          line.familyPaidClassCount = accountStats.paidClassCount
          line.familyMonthlyCents = accountStats.accountMonthlyCents
          line.familyPayingCount = accountStats.paidClassCount
          line.familyAllLines = accountStats.allLines
        }
        for (const line of lines) attachStats(line)
        const cartLineCount = lines.filter((l) => l.shadowOnly !== true).length
        const dbPaidClassCount = Math.max(0, accountStats.paidClassCount - cartLineCount)
        let cartIndex = 0
        for (const line of lines) {
          if (line.shadowOnly === true) continue
          line.classOrdinal = dbPaidClassCount + cartIndex + 1
          cartIndex += 1
        }
        for (const shadow of accountStats.dbLines) {
          attachStats(shadow)
          lines.push(shadow)
        }
      }
    } catch (err) {
      // Account discount context is best-effort, but silent failures previously hid
      // real bugs (missing billing columns) and produced cart-only tier stats.
      console.warn('[scheduling] account discount stats unavailable:', err?.message ?? err)
    }
  }

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

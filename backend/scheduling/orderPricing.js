import { countActiveSignupsForMember } from '../members/createMemberStub.js'
import { loadEffectivePricingForForm } from '../programs/pricingDefaults.js'
import { computeMonthlyPricing } from './pricing.js'

export const SIGNUP_ORDER_PRICING_DISCLAIMER =
  'Pricing shown is a rough estimate and may not reflect your actual billing, current rates, or all discounts that apply to your account.'

function programSlotSignupKey(formId, categoryId, slotGroupId, timeSlotId) {
  return `${formId}:${categoryId ?? 'none'}:${slotGroupId}:${timeSlotId ?? 'none'}`
}

function marginalIncrements(existingCount, newCount, effectiveDbRow) {
  const increments = []
  for (let i = 1; i <= newCount; i += 1) {
    const before = computeMonthlyPricing(effectiveDbRow, existingCount + i - 1)
    const after = computeMonthlyPricing(effectiveDbRow, existingCount + i)
    increments.push(Math.max(0, after.discountedMonthly - before.discountedMonthly))
  }
  return increments
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
      slotKey: programSlotSignupKey(formId, categoryId, slotGroupId, timeSlotId),
    }
  })
}

export async function buildSignupOrderPreview(pool, { memberId, newSignups = [] }) {
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

  const newCountByForm = new Map()
  for (const entry of filteredNew) {
    newCountByForm.set(entry.formId, (newCountByForm.get(entry.formId) || 0) + 1)
  }

  const formSummaries = []
  let existingMonthlyTotal = 0
  let estimatedMonthlyTotal = 0
  let totalDiscountMonthly = 0
  let newSignupMonthlyTotal = 0

  const sortedFormIds = [...formIds].sort((a, b) => {
    const titleA = formRows.get(a)?.title || ''
    const titleB = formRows.get(b)?.title || ''
    return titleA.localeCompare(titleB)
  })

  const incrementsByForm = new Map()

  for (const formId of sortedFormIds) {
    const formRow = formRows.get(formId)
    if (!formRow) continue

    const { effectiveDbRow } = await loadEffectivePricingForForm(pool, formRow)
    const existingCount = memberId
      ? await countActiveSignupsForMember(pool, formId, memberId)
      : 0
    const newCount = newCountByForm.get(formId) || 0
    const totalCount = existingCount + newCount

    const pricingBefore = computeMonthlyPricing(effectiveDbRow, existingCount)
    const pricingAfter = computeMonthlyPricing(effectiveDbRow, totalCount)
    const incrementalMonthly = Math.max(0, pricingAfter.discountedMonthly - pricingBefore.discountedMonthly)

    existingMonthlyTotal += pricingBefore.discountedMonthly
    estimatedMonthlyTotal += pricingAfter.discountedMonthly
    totalDiscountMonthly += pricingAfter.discountMonthly
    newSignupMonthlyTotal += incrementalMonthly

    incrementsByForm.set(formId, marginalIncrements(existingCount, newCount, effectiveDbRow))

    formSummaries.push({
      formId,
      formTitle: formRow.title,
      existingSlotCount: existingCount,
      newSlotCount: newCount,
      totalSlotCount: totalCount,
      pricingBefore: pricingBefore.hasPricing ? pricingBefore : null,
      pricingAfter: pricingAfter.hasPricing ? pricingAfter : null,
      incrementalMonthly,
      discountMonthly: pricingAfter.discountMonthly,
    })
  }

  const newSignupIndexByForm = new Map()
  const newSignupItems = filteredNew.map((entry) => {
    const formRow = formRows.get(entry.formId)
    const index = newSignupIndexByForm.get(entry.formId) || 0
    newSignupIndexByForm.set(entry.formId, index + 1)
    const increments = incrementsByForm.get(entry.formId) || []
    const incrementalMonthly = increments[index] ?? 0

    return {
      formId: entry.formId,
      formTitle: entry.formTitle || formRow?.title || 'Class',
      categoryName: entry.categoryName || 'No Category',
      slotLabel: entry.slotLabel || '',
      slotKey: programSlotSignupKey(
        entry.formId,
        entry.categoryId ?? null,
        entry.slotGroupId,
        entry.timeSlotId ?? null,
      ),
      incrementalMonthly,
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

  return {
    memberId: memberId ?? null,
    existingClasses,
    newSignups: newSignupItems,
    formSummaries,
    existingMonthlyTotal,
    newSignupMonthlyTotal,
    estimatedMonthlyTotal,
    totalDiscountMonthly,
    hasPricing: formSummaries.some((summary) => summary.pricingAfter != null),
    disclaimer: SIGNUP_ORDER_PRICING_DISCLAIMER,
  }
}

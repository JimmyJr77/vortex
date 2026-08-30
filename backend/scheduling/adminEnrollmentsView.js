/**
 * Unified admin enrollments view for a member.
 *
 * One row per scheduling_signup enrollment with columns the admin table needs:
 * sport, program, class, offering, schedule, class cost, adjusted cost (after
 * discounts), status, and the billing-subscription status when present.
 *
 * Per-class cost is taken from the live pricing preview (existingClasses[].monthlyPrice),
 * which is a marginal allocation that reconciles to the member's true monthly total.
 */

import {
  loadGroupDisplayLabels,
  slotLabelForSignupRow,
  resolveEnrollmentOfferingDisplay,
  loadEnrollmentTaxonomyByFormIds,
  loadEnrollmentTaxonomyByClassIds,
  applyEnrollmentTaxonomy,
  buildEnrollmentContextLine,
  formatDateOnly,
} from './slotDisplayLabel.js'
import { cancelSubscriptionsForSource } from './billingSubscriptions.js'
import { ensureEnrollmentLifecycleColumns } from './enrollmentLifecycle.js'
import { classCostCentsFromPricingBreakdown } from './systemDiscounts.js'
import { queryFamilyMemberEnrollments } from '../platform/memberEnrollments.js'
import { processDueEnrollmentCancellations } from './memberEnrollmentCancel.js'
import { resolveFamilyEnrollmentPricing } from '../billing/familyEnrollmentPricing.js'
import { billingMonthKey } from '../billing/customerBillingPricing.js'

function parseSelectedDays(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function formatLegacySlotLabel(selectedDays, daysPerWeek) {
  if (selectedDays.length > 0) return selectedDays.join(', ')
  if (daysPerWeek != null) return `${daysPerWeek} day${Number(daysPerWeek) === 1 ? '' : 's'}/week`
  return '—'
}

/**
 * Mark confirmed enrollments whose offering/schedule end date has passed as `completed`
 * and stop their recurring billing. Best-effort; returns the affected signup ids.
 * @param {import('pg').Pool} pool
 * @param {{ memberId?: number|null }} [opts]
 */
export async function autoCompleteEndedEnrollments(pool, { memberId = null } = {}) {
  try {
    await ensureEnrollmentLifecycleColumns(pool)
  } catch (schemaErr) {
    console.warn('[adminEnrollmentsView] auto-complete schema ensure:', schemaErr?.message ?? schemaErr)
  }
  const params = []
  let memberFilter = ''
  if (memberId != null) {
    params.push(memberId)
    memberFilter = `AND s.member_id = $${params.length}`
  }
  const res = await pool.query(
    `
    UPDATE scheduling_signup s
    SET status = 'completed', completed_at = now()
    FROM scheduling_slot_group sg
    LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
    WHERE s.slot_group_id = sg.id
      AND s.status = 'confirmed'
      AND s.orphaned_at IS NULL
      AND COALESCE(o.end_date, sg.active_end) IS NOT NULL
      AND COALESCE(o.end_date, sg.active_end) < CURRENT_DATE
      ${memberFilter}
    RETURNING s.id
    `,
    params,
  )
  const ids = res.rows.map((r) => Number(r.id))
  for (const id of ids) {
    try {
      await cancelSubscriptionsForSource(pool, { sourceType: 'scheduling_signup', sourceId: id })
    } catch (err) {
      console.warn('[adminEnrollmentsView] auto-complete cancel subscription:', err.message)
    }
  }
  return ids
}

function manualDiscountCents(classCostCents, row) {
  if (row.manual_discount_cents != null) return Math.max(0, Math.round(Number(row.manual_discount_cents)))
  if (row.manual_discount_pct != null) {
    return Math.max(0, Math.round((classCostCents * Number(row.manual_discount_pct)) / 100))
  }
  return 0
}

function dropInBenefitLabel(row) {
  switch (row.benefit_type) {
    case 'free_trial':
      return 'Free trial'
    case 'annual_credit':
      return 'Annual membership drop-in credit'
    case 'admin_credit':
      return 'Admin drop-in credit'
    default:
      return Number(row.discount_percent || 0) > 0 ? 'Drop-in member discount' : 'Drop-in discount'
  }
}

/**
 * A drop-in's stored base price is the membership-aware formula price at booking
 * time (monthly tuition ÷ 3 for non-members or ÷ 4 for annual members). Preserve
 * that gross amount in account views so free benefits appear as discounts instead
 * of making the class itself look like it costs $0.
 */
export function mapDropInEnrollmentPricing(row) {
  const finalCents = Math.max(0, Math.round(Number(row.amount_cents) || 0))
  const storedBaseCents = Math.max(0, Math.round(Number(row.base_price_cents) || 0))
  const grossCents = Math.max(storedBaseCents, finalCents)
  const discountCents = Math.max(0, grossCents - finalCents)

  return {
    class_cost_cents: grossCents,
    adjusted_cost_cents: finalCents,
    discount_components: discountCents > 0
      ? [{
          name: dropInBenefitLabel(row),
          amountCents: discountCents,
          source: 'drop_in_benefit',
          promoCode: row.promo_code ?? null,
        }]
      : [],
  }
}

/**
 * Build unified enrollment rows for a single member.
 * @param {import('pg').Pool} pool
 * @param {number} memberId
 */
export async function buildAdminMemberEnrollments(
  pool,
  memberId,
  { familyPricing = null, pricingPeriod = null } = {},
) {
  // Keep the Accounts view on the same lifecycle state as Member Portal → Classes.
  // This finalizes any cancellation whose effective date has arrived before rows
  // and billing details are read.
  try {
    await processDueEnrollmentCancellations(pool)
  } catch (err) {
    console.warn('[adminEnrollmentsView] process due cancellations:', err?.message ?? err)
  }

  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  // Member context for the pricing preview (drives discounts + per-class allocation).
  const memberRes = await pool.query(
    `SELECT id, first_name, last_name, billing_city, family_id FROM member WHERE id = $1`,
    [memberId],
  )
  if (memberRes.rows.length === 0) return { member: null, rows: [] }
  const memberRow = memberRes.rows[0]

  let priceById = new Map()
  let adjustedBySignupId = new Map()
  let discountLabelBySignupId = new Map()
  let discountComponentsBySignupId = new Map()
  let manualAppliedBySignupId = new Map()
  try {
    const resolved = familyPricing ?? await resolveFamilyEnrollmentPricing(pool, {
      familyId: Number(memberRow.family_id),
      periodKey: pricingPeriod ?? billingMonthKey(new Date()),
    })
    for (const line of resolved?.lines ?? []) {
      const signupId = Number(line.signupId)
      priceById.set(signupId, Number(line.grossCents) || 0)
      adjustedBySignupId.set(signupId, Number(line.netCents) || 0)
      const components = Array.isArray(line.discountComponents)
        ? line.discountComponents.filter((entry) => Number(entry.amountCents) > 0)
        : []
      if (components.length > 0) {
        discountComponentsBySignupId.set(signupId, components)
        discountLabelBySignupId.set(
          signupId,
          components.map((entry) => entry.name).filter(Boolean).join(', '),
        )
      }
      const manualApplied = Math.max(0, Number(line.manualAdjustmentCents) || 0)
      if (manualApplied > 0) manualAppliedBySignupId.set(signupId, manualApplied)
    }
  } catch (err) {
    console.warn('[adminEnrollmentsView] family pricing failed:', err.message)
  }

  // Billing subscription (gross/discount/net + status) keyed by signup id.
  const subBySignupId = new Map()
  try {
    const subRes = await pool.query(
      `SELECT source_id, monthly_amount_cents, discount_amount_cents, net_monthly_cents, status
       FROM billing_subscription
       WHERE source_type = 'scheduling_signup'
         AND source_id = ANY (
           SELECT id::text FROM scheduling_signup WHERE member_id = $1
         )`,
      [memberId],
    )
    for (const r of subRes.rows) {
      // Keep the most relevant (non-cancelled preferred) subscription per source.
      const key = Number(r.source_id)
      const existing = subBySignupId.get(key)
      if (!existing || (existing.status === 'cancelled' && r.status !== 'cancelled')) {
        subBySignupId.set(key, r)
      }
    }
  } catch (err) {
    console.warn('[adminEnrollmentsView] subscription load failed:', err.message)
  }

  const schedulingResult = await pool.query(
    `
      SELECT
        s.id, s.member_id, s.form_id, s.status, s.created_at, s.enrollment_start_date,
        s.cancel_effective_date, s.cancel_requested_at,
        EXISTS (
          SELECT 1
          FROM enrollment_cancellation_request cancellation_request
          WHERE cancellation_request.signup_id = s.id
            AND cancellation_request.status = 'pending'
        ) AS cancellation_requested,
        s.completed_at, s.paused_at,
        s.pause_effective_date, s.pause_mode,
        s.manual_discount_cents, s.manual_discount_pct, s.manual_discount_reason, s.manual_discount_rule_id,
        s.pricing_breakdown,
        COALESCE(class_p.display_name, class_p.name, sf.title) AS class_name,
        COALESCE(sf.programs_id, class_p.${programFkColumn}) AS program_id,
        COALESCE(pr.display_name, pr.name) AS program_name,
        sport_dt.name AS sport_name,
        s.slot_group_id, s.time_slot_id, sg.offering_id,
        ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week, ts.start_time, ts.end_time,
        o.label AS offering_label, o.start_date AS offering_start_date, o.end_date AS offering_end_date,
        sg.active_start AS group_active_start, sg.active_end AS group_active_end, sg.dates_tbd AS group_dates_tbd,
        sf.start_date AS form_start_date, sf.end_date AS form_end_date
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
      LEFT JOIN program class_p ON class_p.id = sf.program_id
      LEFT JOIN ${programsTable} pr ON pr.id = COALESCE(sf.programs_id, class_p.${programFkColumn})
      LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
      WHERE s.member_id = $1
        AND s.orphaned_at IS NULL
      ORDER BY class_name, s.id
    `,
    [memberId],
  )

  const groupIds = schedulingResult.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)
  const taxonomyByFormId = await loadEnrollmentTaxonomyByFormIds(
    pool,
    schedulingResult.rows.map((row) => Number(row.form_id)),
  )

  const schedulingRows = schedulingResult.rows.map((row) => {
    const displayStatus = row.cancellation_requested ? 'requested' : row.status
    const offering = resolveEnrollmentOfferingDisplay(row)
    const taxonomy = taxonomyByFormId.get(Number(row.form_id))
    const programName = taxonomy?.programName ?? (row.program_name || null)
    const sportName = taxonomy?.sportName ?? (row.sport_name || null)
    const className = taxonomy?.className ?? (row.class_name || 'Class')

    const sub = subBySignupId.get(Number(row.id))
    const snapshotClassCost = classCostCentsFromPricingBreakdown(row.pricing_breakdown)
    const classCostCents =
      priceById.get(Number(row.id)) ??
      snapshotClassCost ??
      (sub ? Number(sub.monthly_amount_cents) : null) ??
      0
    const isPaused = row.status === 'paused'
    const groupAdjustedCents = isPaused ? 0 : adjustedBySignupId.get(Number(row.id))
    const engineManualCents = isPaused ? 0 : manualAppliedBySignupId.get(Number(row.id))
    const manualCents = isPaused
      ? 0
      : engineManualCents ?? manualDiscountCents(groupAdjustedCents ?? classCostCents, row)
    const baseNet = isPaused
      ? 0
      : groupAdjustedCents ??
        (sub != null ? Number(sub.net_monthly_cents) : null) ??
        classCostCents
    const adjustedCostCents = isPaused
      ? 0
      : engineManualCents != null
        ? Math.max(0, baseNet)
        : Math.max(0, baseNet - manualCents)
    const groupDiscountLabel = discountLabelBySignupId.get(Number(row.id)) ?? null
    const billingType = row.pricing_breakdown?.billingType === 'one_time' || row.pricing_breakdown?.billing_type === 'one_time'
      ? 'one_time'
      : 'recurring'
    const enrollmentType = billingType === 'one_time'
      ? 'one_time'
      : row.offering_id != null ? 'temporary_block' : 'monthly'
    const attendanceDate = row.schedule_mode === 'date' ? formatDateOnly(row.specific_date) : null

    const enriched = applyEnrollmentTaxonomy(
      {
        id: Number(row.id),
        source: 'scheduling',
        sport_name: sportName,
        program_name: programName,
        class_name: className,
        program_id: taxonomy?.programId ?? (row.program_id != null ? Number(row.program_id) : null),
        form_id: Number(row.form_id),
        slot_group_id: row.slot_group_id != null ? Number(row.slot_group_id) : null,
        time_slot_id: row.time_slot_id != null ? Number(row.time_slot_id) : null,
        offering_id: row.offering_id != null ? Number(row.offering_id) : null,
        offering_label: offering.offering_label,
        offering_dates: offering.offering_dates,
        enrollment_start_date: formatDateOnly(row.enrollment_start_date),
        schedule: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
        status: displayStatus,
        cancel_effective_date: formatDateOnly(row.cancel_effective_date),
        cancel_requested_at: row.cancel_requested_at ?? null,
        billing_status: sub?.status ?? null,
        class_cost_cents: classCostCents,
        adjusted_cost_cents: adjustedCostCents,
        discount_components: discountComponentsBySignupId.get(Number(row.id)) ?? [],
        manual_discount_cents: manualCents > 0 ? manualCents : null,
        manual_discount_pct: row.manual_discount_pct != null ? Number(row.manual_discount_pct) : null,
        manual_discount_reason:
          row.manual_discount_reason ?? groupDiscountLabel ?? null,
        manual_discount_rule_id: row.manual_discount_rule_id != null ? Number(row.manual_discount_rule_id) : null,
        pause_effective_date: formatDateOnly(row.pause_effective_date),
        pause_mode: row.pause_mode ?? null,
        completed_at: row.completed_at,
        created_at: row.created_at,
        enrollment_type: enrollmentType,
        enrollmentType,
        attendance_date: attendanceDate,
        attendanceDate,
        billing_type: billingType,
        billingType,
      },
      taxonomy,
    )
    return enriched
  })

  const dropInRows = (await queryFamilyMemberEnrollments(pool, [memberId]))
    .filter((row) => row.source === 'drop_in')
    .map((row) => ({
      ...row,
      schedule: row.slot_label,
      ...mapDropInEnrollmentPricing(row),
      billing_status: 'one_time',
      enrollment_type: 'drop_in',
      enrollmentType: 'drop_in',
      billing_type: 'one_time',
      billingType: 'one_time',
    }))

  return {
    member: {
      id: Number(memberRow.id),
      firstName: memberRow.first_name,
      lastName: memberRow.last_name,
    },
    rows: [...schedulingRows, ...dropInRows],
  }
}

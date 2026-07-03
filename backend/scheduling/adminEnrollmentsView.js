/**
 * Unified admin enrollments view for a member.
 *
 * One row per enrollment (scheduling_signup of any lifecycle status, plus legacy
 * member_program rows folded in) with the columns the admin table needs:
 * sport, program, class, offering, schedule, class cost, adjusted cost (after
 * discounts), status, and the billing-subscription status when present.
 *
 * Per-class cost is taken from the live pricing preview (existingClasses[].monthlyPrice),
 * which is a marginal allocation that reconciles to the member's true monthly total —
 * this is what makes the per-class numbers and the total agree (the old view showed each
 * signup's stored snapshot, which for weekly-tier programs did not reconcile).
 */

import {
  loadGroupDisplayLabels,
  slotLabelForSignupRow,
  resolveEnrollmentOfferingDisplay,
  loadEnrollmentTaxonomyByFormIds,
  loadEnrollmentTaxonomyByClassIds,
  applyEnrollmentTaxonomy,
  buildEnrollmentContextLine,
} from './slotDisplayLabel.js'
import { buildSignupOrderPreview, computeExistingEnrollmentDiscounts } from './orderPricing.js'
import { cancelSubscriptionsForSource } from './billingSubscriptions.js'
import { ensureEnrollmentLifecycleColumns } from './enrollmentLifecycle.js'

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

/**
 * Build unified enrollment rows for a single member.
 * @param {import('pg').Pool} pool
 * @param {number} memberId
 */
export async function buildAdminMemberEnrollments(pool, memberId) {
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

  let school = null
  let graduationYear = null
  try {
    const ctxRes = await pool.query(
      `SELECT responses FROM scheduling_signup
       WHERE member_id = $1 AND orphaned_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [memberId],
    )
    const raw = ctxRes.rows[0]?.responses
    const responses = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (responses?.current_school) school = String(responses.current_school).trim()
    if (responses?.graduation_year != null && responses.graduation_year !== '') {
      graduationYear = Number(responses.graduation_year)
    }
  } catch {
    /* optional */
  }

  let priceById = new Map()
  let adjustedBySignupId = new Map()
  let discountLabelBySignupId = new Map()
  try {
    const preview = await buildSignupOrderPreview(pool, {
      memberId,
      newSignups: [],
      promoCodes: [],
      memberContext: {
        city: memberRow.billing_city ?? null,
        school,
        graduationYear: Number.isFinite(graduationYear) ? graduationYear : null,
        familyId: memberRow.family_id ?? null,
      },
    })
    for (const cls of preview?.existingClasses ?? []) {
      if (cls.id != null) priceById.set(Number(cls.id), Math.round((cls.monthlyPrice || 0) * 100))
    }

    const previewExistingLines = (preview?.existingClasses ?? [])
      .filter((cls) => cls.id != null && (cls.monthlyPrice || 0) > 0)
      .map((cls) => ({
        key: `preview-existing-${cls.id}`,
        signupId: Number(cls.id),
        formId: cls.formId,
        programId: cls.programsId ?? null,
        sportId: null,
        memberId,
        familyId: memberRow.family_id ?? null,
        baseCents: Math.round((cls.monthlyPrice || 0) * 100),
        listCents: Math.round((cls.monthlyPrice || 0) * 100),
        finalCents: Math.round((cls.monthlyPrice || 0) * 100),
        includeInSubtotal: false,
        shadowOnly: true,
      }))

    if (previewExistingLines.length > 0) {
      const discounts = await computeExistingEnrollmentDiscounts(pool, {
        memberId,
        promoCodes: [],
        memberContext: {
          city: memberRow.billing_city ?? null,
          school,
          graduationYear: Number.isFinite(graduationYear) ? graduationYear : null,
          familyId: memberRow.family_id ?? null,
        },
        previewExistingLines,
        formRows: new Map(),
        scopeMeta: new Map(),
      })
      for (const line of discounts?.accountLines ?? []) {
        adjustedBySignupId.set(line.signupId, line.finalCents)
        if (line.baseCents > line.finalCents && line.applied?.length) {
          discountLabelBySignupId.set(
            line.signupId,
            line.applied.map((a) => a.name).filter(Boolean).join(', '),
          )
        }
      }
    }
  } catch (err) {
    console.warn('[adminEnrollmentsView] preview failed:', err.message)
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
        s.id, s.member_id, s.form_id, s.status, s.created_at,
        s.completed_at, s.paused_at,
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
    const offering = resolveEnrollmentOfferingDisplay(row)
    const taxonomy = taxonomyByFormId.get(Number(row.form_id))
    const programName = taxonomy?.programName ?? (row.program_name || null)
    const sportName = taxonomy?.sportName ?? (row.sport_name || null)
    const className = taxonomy?.className ?? (row.class_name || 'Class')

    const sub = subBySignupId.get(Number(row.id))
    const breakdownGross = row.pricing_breakdown?.totals?.subtotalCents
    const classCostCents =
      priceById.get(Number(row.id)) ??
      (sub ? Number(sub.monthly_amount_cents) : null) ??
      (breakdownGross != null ? Number(breakdownGross) : null) ??
      0
    const isPaused = row.status === 'paused'
    const groupAdjustedCents = isPaused ? 0 : adjustedBySignupId.get(Number(row.id))
    const manualCents = isPaused ? 0 : manualDiscountCents(groupAdjustedCents ?? classCostCents, row)
    const baseNet = isPaused
      ? 0
      : groupAdjustedCents ??
        (sub != null ? Number(sub.net_monthly_cents) : null) ??
        classCostCents
    const adjustedCostCents = isPaused ? 0 : Math.max(0, baseNet - manualCents)
    const groupDiscountLabel = discountLabelBySignupId.get(Number(row.id)) ?? null

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
        schedule: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
        status: row.status,
        billing_status: sub?.status ?? null,
        class_cost_cents: classCostCents,
        adjusted_cost_cents: adjustedCostCents,
        manual_discount_cents: manualCents > 0 ? manualCents : null,
        manual_discount_pct: row.manual_discount_pct != null ? Number(row.manual_discount_pct) : null,
        manual_discount_reason:
          row.manual_discount_reason ?? groupDiscountLabel ?? null,
        manual_discount_rule_id: row.manual_discount_rule_id != null ? Number(row.manual_discount_rule_id) : null,
        completed_at: row.completed_at,
        created_at: row.created_at,
      },
      taxonomy,
    )
    return enriched
  })

  // Legacy member_program rows (folded in, labeled). No modern cost source.
  let legacyRows = []
  try {
    const legacyResult = await pool.query(
      `
        SELECT mp.id, mp.program_id, mp.days_per_week, mp.selected_days, mp.created_at,
          COALESCE(class_p.display_name, class_p.name, 'Class') AS class_name,
          COALESCE(pr.display_name, pr.name) AS program_name,
          sport_dt.name AS sport_name
        FROM member_program mp
        LEFT JOIN program class_p ON class_p.id = mp.program_id
        LEFT JOIN ${programsTable} pr ON pr.id = class_p.${programFkColumn}
        LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
        WHERE mp.member_id = $1
        ORDER BY class_name, mp.id
      `,
      [memberId],
    )
    const taxonomyByClassId = await loadEnrollmentTaxonomyByClassIds(
      pool,
      legacyResult.rows.map((row) => Number(row.program_id)),
    )
    legacyRows = legacyResult.rows.map((row) => {
      const selectedDays = parseSelectedDays(row.selected_days)
      const taxonomy = taxonomyByClassId.get(Number(row.program_id))
      const programName = taxonomy?.programName ?? (row.program_name || null)
      const sportName = taxonomy?.sportName ?? (row.sport_name || null)
      const className = taxonomy?.className ?? (row.class_name || 'Class')
      return applyEnrollmentTaxonomy(
        {
          id: Number(row.id),
          source: 'member_program',
          sport_name: sportName,
          program_name: programName,
          class_name: className,
          program_id: taxonomy?.programId ?? (row.program_id != null ? Number(row.program_id) : null),
          form_id: null,
          slot_group_id: null,
          time_slot_id: null,
          offering_id: null,
          offering_label: null,
          offering_dates: '—',
          schedule: formatLegacySlotLabel(selectedDays, row.days_per_week),
          status: 'active',
          billing_status: null,
          class_cost_cents: null,
          adjusted_cost_cents: null,
          manual_discount_cents: null,
          manual_discount_pct: null,
          manual_discount_reason: null,
          manual_discount_rule_id: null,
          completed_at: null,
          created_at: row.created_at,
        },
        taxonomy,
      )
    })
  } catch (err) {
    console.warn('[adminEnrollmentsView] legacy load failed:', err.message)
    legacyRows = []
  }

  return {
    member: {
      id: Number(memberRow.id),
      firstName: memberRow.first_name,
      lastName: memberRow.last_name,
    },
    rows: [...schedulingRows, ...legacyRows],
  }
}

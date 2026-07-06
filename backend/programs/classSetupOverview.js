/**
 * Admin Class Setup Overview — one row per class with aggregated scheduling/pricing/enrollment data.
 */

import {
  ensureDisciplineTagsSchema,
  ensurePrimaryDisciplineTagColumn,
  ensureProgramPricingColumns,
  ensureProgramsSchedulingSchema,
  resolveProgramsSchema,
} from './schema.js'
import { hydrateProgramPricingRow } from './programPricingOptions.js'
import { buildGroupDisplayLabel } from '../scheduling/slotDisplayLabel.js'

function resolveStatus({ classArchived, programArchived, classIsActive, programIsActive }) {
  if (classArchived || programArchived) return 'Legacy'
  if (classIsActive && programIsActive) return 'Active'
  return 'Inactive'
}

function mapOfferingRow(row) {
  const endDate = row.end_date ? String(row.end_date).slice(0, 10) : null
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : '',
    endDate,
    evergreen: endDate == null,
    label: row.label ?? null,
    isSelected: Boolean(row.is_selected),
  }
}

function mapSlotGroupRow(row, scheduleLabel) {
  return {
    slotGroupId: Number(row.id),
    formId: Number(row.form_id),
    offeringId: row.offering_id != null ? Number(row.offering_id) : null,
    maxParticipants: Number(row.max_participants ?? 0),
    signupCount: Number(row.signup_count ?? 0),
    scheduleLabel,
  }
}

function pricingDisplayFromOptions(options) {
  const enabled = (options ?? []).filter((o) => o.enabled && o.amountCents > 0)
  const find = (key) => enabled.find((o) => o.key === key) ?? null
  const perClass = find('per_class')
  const monthly1x = find('monthly_1x')
  const monthlyOther = enabled.filter(
    (o) =>
      o.key !== 'per_class' &&
      o.key !== 'monthly_1x' &&
      (o.key.startsWith('monthly_') || o.key.startsWith('unlimited_')),
  )
  const formatCents = (cents) => (cents > 0 ? `$${(cents / 100).toFixed(2)}` : null)
  return {
    costPerClass: perClass ? formatCents(perClass.amountCents) : null,
    fee1x: monthly1x ? formatCents(monthly1x.amountCents) : null,
    costPerMonthSummary:
      monthlyOther.length > 0
        ? monthlyOther
            .map((o) => {
              const amount = formatCents(o.amountCents)
              return amount ? `${amount} (${o.key})` : null
            })
            .filter(Boolean)
            .join(' · ')
        : null,
    pricingCostOptions: options ?? [],
  }
}

export async function buildClassSetupOverview(pool) {
  await ensureProgramsSchedulingSchema(pool)
  await ensureDisciplineTagsSchema(pool)
  await ensurePrimaryDisciplineTagColumn(pool)
  await ensureProgramPricingColumns(pool)

  const schema = await resolveProgramsSchema(pool)
  const { programsTable, programFkColumn } = schema

  const activeColCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'is_active' LIMIT 1`,
    [programsTable],
  )
  const hasProgramIsActive = activeColCheck.rows.length > 0
  const programIsActiveSelect = hasProgramIsActive
    ? 'COALESCE(pr.is_active, TRUE) AS program_is_active,'
    : 'TRUE AS program_is_active,'

  const descColCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'description' LIMIT 1`,
    [programsTable],
  )
  const programDescriptionSelect = descColCheck.rows.length > 0 ? 'pr.description AS program_description,' : 'NULL AS program_description,'

  const classesRes = await pool.query(
    `
      SELECT
        p.id AS class_id,
        p.display_name AS class_name,
        p.description AS class_description,
        p.skill_level,
        p.is_active AS class_is_active,
        p.archived AS class_archived,
        p.${programFkColumn} AS programs_id,
        pr.display_name AS program_name,
        ${programDescriptionSelect}
        pr.archived AS program_archived,
        ${programIsActiveSelect}
        primary_dt.id AS primary_sport_id,
        primary_dt.name AS primary_sport_name,
        COALESCE((
          SELECT string_agg(dt.name, ', ' ORDER BY dt.sort_order, dt.name)
          FROM program_discipline_tag pdt
          JOIN discipline_tag dt ON dt.id = pdt.tag_id
          WHERE pdt.programs_id = p.${programFkColumn}
            AND dt.id IS DISTINCT FROM pr.primary_discipline_tag_id
        ), '') AS sport_tags,
        sf.id AS form_id,
        sf.is_active AS form_active,
        sf.pricing_overrides_program AS pricing_overrides_program,
        pr.pricing_cost_options AS pricing_cost_options,
        pr.pricing_slot_cost_monthly_cents AS pricing_slot_cost_monthly_cents,
        pr.pricing_cost_unit AS pricing_cost_unit,
        pr.pricing_cost_amount_cents AS pricing_cost_amount_cents
      FROM program p
      LEFT JOIN ${programsTable} pr ON pr.id = p.${programFkColumn}
      LEFT JOIN discipline_tag primary_dt ON primary_dt.id = pr.primary_discipline_tag_id
      LEFT JOIN scheduling_form sf ON sf.program_id = p.id AND sf.deleted_at IS NULL
      ORDER BY pr.display_name NULLS LAST, p.display_name, p.id
    `,
  )

  const formIds = [
    ...new Set(classesRes.rows.map((r) => (r.form_id != null ? Number(r.form_id) : null)).filter(Boolean)),
  ]

  const offeringsByFormId = new Map()
  const slotGroupsByFormId = new Map()
  const enrolleesByFormId = new Map()

  if (formIds.length) {
    const offeringsRes = await pool.query(
      `
        SELECT id, form_id, start_date, end_date, label, is_selected
        FROM scheduling_offering
        WHERE form_id = ANY($1::int[])
        ORDER BY form_id, start_date NULLS LAST, id
      `,
      [formIds],
    )
    for (const row of offeringsRes.rows) {
      const fid = Number(row.form_id)
      if (!offeringsByFormId.has(fid)) offeringsByFormId.set(fid, [])
      offeringsByFormId.get(fid).push(mapOfferingRow(row))
    }

    const groupsRes = await pool.query(
      `
        SELECT
          sg.id,
          sg.form_id,
          sg.offering_id,
          sg.max_participants,
          COALESCE((
            SELECT COUNT(*)::int FROM scheduling_signup s
            WHERE s.slot_group_id = sg.id
              AND s.status = 'confirmed'
              AND s.orphaned_at IS NULL
              AND s.archived_at IS NULL
          ), 0) AS signup_count
        FROM scheduling_slot_group sg
        WHERE sg.form_id = ANY($1::int[])
        ORDER BY sg.form_id, sg.id
      `,
      [formIds],
    )

    const groupIds = groupsRes.rows.map((r) => Number(r.id))
    const slotsByGroupId = new Map()
    if (groupIds.length) {
      const slotsRes = await pool.query(
        `
          SELECT slot_group_id, week_letter, schedule_mode, specific_date, day_of_week, start_time, end_time
          FROM scheduling_time_slot
          WHERE slot_group_id = ANY($1::int[])
          ORDER BY slot_group_id, week_letter NULLS LAST, day_of_week NULLS LAST,
            specific_date NULLS LAST, start_time, id
        `,
        [groupIds],
      )
      for (const row of slotsRes.rows) {
        const gid = Number(row.slot_group_id)
        if (!slotsByGroupId.has(gid)) slotsByGroupId.set(gid, [])
        slotsByGroupId.get(gid).push(row)
      }
    }

    for (const row of groupsRes.rows) {
      const fid = Number(row.form_id)
      const gid = Number(row.id)
      const scheduleLabel = buildGroupDisplayLabel(slotsByGroupId.get(gid) ?? [])
      if (!slotGroupsByFormId.has(fid)) slotGroupsByFormId.set(fid, [])
      slotGroupsByFormId.get(fid).push(mapSlotGroupRow(row, scheduleLabel))
    }

    const enrolRes = await pool.query(
      `
        SELECT form_id, COUNT(*)::int AS n
        FROM scheduling_signup
        WHERE form_id = ANY($1::int[])
          AND status = 'confirmed'
          AND orphaned_at IS NULL
          AND archived_at IS NULL
        GROUP BY form_id
      `,
      [formIds],
    )
    for (const row of enrolRes.rows) {
      enrolleesByFormId.set(Number(row.form_id), Number(row.n))
    }
  }

  const rows = classesRes.rows.map((row) => {
    const formId = row.form_id != null ? Number(row.form_id) : null
    const programsId = row.programs_id != null ? Number(row.programs_id) : null
    const classIsActive = Boolean(row.class_is_active)
    const programIsActive = Boolean(row.program_is_active)
    const classArchived = Boolean(row.class_archived)
    const programArchived = Boolean(row.program_archived)

    const hydrated = hydrateProgramPricingRow({
      pricing_cost_options: row.pricing_cost_options,
      pricing_slot_cost_monthly_cents: row.pricing_slot_cost_monthly_cents,
      pricing_cost_unit: row.pricing_cost_unit,
      pricing_cost_amount_cents: row.pricing_cost_amount_cents,
    })
    const pricing = pricingDisplayFromOptions(hydrated?.pricing_cost_options ?? [])

    return {
      classId: Number(row.class_id),
      className: row.class_name ?? '',
      classDescription: row.class_description ?? null,
      skillLevel: row.skill_level ?? null,
      classIsActive,
      classArchived,
      programsId,
      programName: row.program_name ?? '',
      programDescription: row.program_description ?? null,
      programArchived,
      programIsActive,
      primarySportId: row.primary_sport_id != null ? Number(row.primary_sport_id) : null,
      primarySportName: row.primary_sport_name ?? null,
      sportTags: row.sport_tags ?? '',
      formId,
      formActive: formId != null ? Boolean(row.form_active) : null,
      pricingOverridesProgram: Boolean(row.pricing_overrides_program),
      offerings: formId != null ? offeringsByFormId.get(formId) ?? [] : [],
      slotGroups: formId != null ? slotGroupsByFormId.get(formId) ?? [] : [],
      enrolleeCount: formId != null ? enrolleesByFormId.get(formId) ?? 0 : 0,
      status: resolveStatus({ classArchived, programArchived, classIsActive, programIsActive }),
      costPerClass: pricing.costPerClass,
      fee1x: pricing.fee1x,
      costPerMonthSummary: pricing.costPerMonthSummary,
      pricingCostOptions: pricing.pricingCostOptions,
    }
  })

  return { rows }
}

export async function adminClassSetupOverviewHandler(pool, _req, res) {
  try {
    const data = await buildClassSetupOverview(pool)
    res.json({ success: true, data })
  } catch (err) {
    console.error('[programs] class-setup overview:', err)
    res.status(500).json({ success: false, message: 'Failed to load class setup overview' })
  }
}

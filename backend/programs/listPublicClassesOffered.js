/**
 * Public classes-offered overview grouped by top-level program.
 */
export async function listPublicClassesOffered(pool) {
  const {
    resolveProgramsSchema,
    ensureProgramPricingColumns,
    ensurePrimaryDisciplineTagColumn,
    ensureProgramDropInColumns,
  } =
    await import('./schema.js')
  await ensureProgramPricingColumns(pool)
  await ensurePrimaryDisciplineTagColumn(pool)
  await ensureProgramDropInColumns(pool)
  const schema = await resolveProgramsSchema(pool)

  const programActiveColumn = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'is_active' LIMIT 1`,
    [schema.programsTable],
  )
  const activeProgramClause =
    programActiveColumn.rows.length > 0 ? 'AND COALESCE(p.is_active, TRUE) = TRUE' : ''

  const {
    normalizeProgramPricingOptions,
    enabledBasePricingOptions,
    hydrateProgramPricingOptionsFromLegacy,
  } = await import('./programPricingOptions.js')
  const { normalizeMultiClassPassPackages, enabledMultiClassPassPackages } =
    await import('./multiClassPass.js')

  const columnCheck = await pool.query(
    `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1 AND column_name = 'description'
    `,
    [schema.programsTable],
  )
  const hasDescription = columnCheck.rows.length > 0

  const programsResult = await pool.query(
    `
    SELECT
      p.id,
      p.display_name AS "displayName",
      ${hasDescription ? 'p.description' : 'NULL AS description'},
      COALESCE(p.pricing_cost_options, '[]'::jsonb) AS "pricingCostOptions",
      COALESCE(p.pricing_cost_amount_cents, p.pricing_slot_cost_monthly_cents, 0) AS "pricingCostAmountCents",
      COALESCE(p.pricing_slot_cost_monthly_cents, 0) AS "pricingSlotCostMonthlyCents",
      COALESCE(p.pricing_cost_unit, 'per_month') AS "pricingCostUnit",
      COALESCE(p.multi_class_pass_packages, '[]'::jsonb) AS "multiClassPassPackages",
      primary_dt.name AS "primarySportName",
      COALESCE(p.exclude_from_drop_ins, FALSE) AS "excludeFromDropIns"
    FROM ${schema.programsTable} p
    LEFT JOIN discipline_tag primary_dt ON primary_dt.id = p.primary_discipline_tag_id
    WHERE p.archived = FALSE
      ${activeProgramClause}
    ORDER BY p.display_name ASC
    `,
  )

  const programPricingById = new Map()
  for (const row of programsResult.rows) {
    const options = enabledBasePricingOptions(
      hydrateProgramPricingOptionsFromLegacy({
        pricingCostOptions: row.pricingCostOptions,
        pricingSlotCostMonthlyCents: row.pricingSlotCostMonthlyCents,
        pricingCostAmountCents: row.pricingCostAmountCents,
        pricingCostUnit: row.pricingCostUnit,
      }),
    )
    const packages = enabledMultiClassPassPackages(normalizeMultiClassPassPackages(row.multiClassPassPackages))
    programPricingById.set(Number(row.id), { pricingCostOptions: options, multiClassPassPackages: packages })
  }

  const classesResult = await pool.query(
    `
    SELECT
      p.id,
      p.${schema.programFkColumn} AS "programsId",
      p.display_name AS "displayName",
      p.description,
      p.skill_level AS "skillLevel",
      p.age_min AS "ageMin",
      p.age_max AS "ageMax",
      p.skill_requirements AS "skillRequirements",
      sf.id AS "formId"
    FROM program p
    LEFT JOIN LATERAL (
      SELECT candidate.id
      FROM scheduling_form candidate
      WHERE candidate.program_id = p.id
        AND candidate.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM scheduling_slot_group sg
          INNER JOIN scheduling_time_slot ts
            ON ts.form_id = candidate.id
            AND ts.slot_group_id = sg.id
            AND ts.is_active = TRUE
          WHERE sg.form_id = candidate.id
            AND sg.is_active = TRUE
        )
      ORDER BY candidate.is_active DESC, candidate.id DESC
      LIMIT 1
    ) sf ON TRUE
    LEFT JOIN ${schema.programsTable} pr ON pr.id = p.${schema.programFkColumn}
    WHERE p.archived = FALSE
      AND p.is_active = TRUE
      AND p.${schema.programFkColumn} IS NOT NULL
      AND pr.archived = FALSE
      ${programActiveColumn.rows.length > 0 ? 'AND COALESCE(pr.is_active, TRUE) = TRUE' : ''}
    ORDER BY p.display_name ASC
    `,
  )

  const classesByProgram = new Map()
  for (const row of classesResult.rows) {
    const programsId = Number(row.programsId)
    if (!classesByProgram.has(programsId)) {
      classesByProgram.set(programsId, [])
    }
    const formId = row.formId != null ? Number(row.formId) : null
    // The class status in Class Setup is authoritative; an attached active
    // schedule makes the class enrollable regardless of the legacy form flag.
    const enrollVisible = formId != null

    classesByProgram.get(programsId).push({
      id: Number(row.id),
      displayName: row.displayName,
      description: row.description ?? null,
      skillLevel: row.skillLevel ?? null,
      ageMin: row.ageMin != null ? Number(row.ageMin) : null,
      ageMax: row.ageMax != null ? Number(row.ageMax) : null,
      skillRequirements: row.skillRequirements ?? null,
      formId,
      enrollVisible,
      signupUrl: enrollVisible && formId != null ? `/enroll?form=${formId}` : null,
    })
  }

  const programs = programsResult.rows
    .map((prog) => {
      const classes = classesByProgram.get(Number(prog.id)) ?? []
      if (classes.length === 0) return null
      const pricing = programPricingById.get(Number(prog.id)) ?? {
        pricingCostOptions: [],
        multiClassPassPackages: [],
      }
      return {
        id: Number(prog.id),
        displayName: prog.displayName,
        description: prog.description ?? null,
        primarySportName: prog.primarySportName ?? null,
        excludeFromDropIns: Boolean(prog.excludeFromDropIns),
        pricingCostOptions: pricing.pricingCostOptions,
        multiClassPassPackages: pricing.multiClassPassPackages,
        classes,
      }
    })
    .filter(Boolean)

  return { programs }
}

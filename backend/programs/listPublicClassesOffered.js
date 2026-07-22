/**
 * Public classes-offered overview grouped by top-level program.
 */
export async function listPublicClassesOffered(pool) {
  const { resolveProgramsSchema, hasProgramSchedulingColumns, ensureProgramPricingColumns, ensurePrimaryDisciplineTagColumn } =
    await import('./schema.js')
  await ensureProgramPricingColumns(pool)
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)

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
      primary_dt.name AS "primarySportName"
    FROM ${schema.programsTable} p
    LEFT JOIN discipline_tag primary_dt ON primary_dt.id = p.primary_discipline_tag_id
    WHERE p.archived = FALSE
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

  const programSelect = hasSchedCols
    ? 'pr.scheduling_enroll_sites, pr.scheduling_active,'
    : 'NULL AS scheduling_enroll_sites, NULL AS scheduling_active,'

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
      sf.id AS "formId",
      sf.enroll_sites,
      sf.is_active AS form_is_active,
      ${programSelect}
      sf.programs_id
    FROM program p
    LEFT JOIN scheduling_form sf
      ON sf.program_id = p.id
      AND sf.deleted_at IS NULL
      AND sf.is_active = TRUE
    LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
    WHERE p.archived = FALSE
      AND p.is_active = TRUE
      AND p.${schema.programFkColumn} IS NOT NULL
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
    const enrollVisible = formId != null && row.form_is_active === true

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
        pricingCostOptions: pricing.pricingCostOptions,
        multiClassPassPackages: pricing.multiClassPassPackages,
        classes,
      }
    })
    .filter(Boolean)

  return { programs }
}

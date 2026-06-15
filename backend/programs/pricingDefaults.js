import { resolveProgramsSchema } from './schema.js'

export function resolveEffectiveFormPricing(programRow, formRow) {
  const overrides = Boolean(formRow?.pricing_overrides_program)
  const programMax = programRow?.pricing_max_slots_per_user ?? null
  const programCost = Number(programRow?.pricing_slot_cost_monthly_cents ?? 0)
  const programFree = Number(programRow?.pricing_free_slots_per_user ?? 0)
  const programMaxFreeTotal = programRow?.pricing_max_free_slots_total ?? null

  const formMax = formRow?.max_slots_per_user ?? null
  const formCost = Number(formRow?.slot_cost_monthly_cents ?? 0)
  const formFree = Number(formRow?.free_slots_per_user ?? 0)
  const formMaxFreeTotal = formRow?.max_free_slots_total ?? null

  const useProgram = !overrides && programRow != null

  return {
    pricingOverridesProgram: overrides,
    maxSlotsPerUser: useProgram
      ? (programMax != null ? Number(programMax) : null)
      : (formMax != null ? Number(formMax) : null),
    slotCostMonthlyCents: useProgram ? programCost : formCost,
    freeSlotsPerUser: useProgram ? programFree : formFree,
    maxFreeSlotsTotal: useProgram
      ? (programMaxFreeTotal != null ? Number(programMaxFreeTotal) : null)
      : (formMaxFreeTotal != null ? Number(formMaxFreeTotal) : null),
    formMaxSlotsPerUser: formMax != null ? Number(formMax) : null,
    formSlotCostMonthlyCents: formCost,
    formFreeSlotsPerUser: formFree,
    formMaxFreeSlotsTotal: formMaxFreeTotal != null ? Number(formMaxFreeTotal) : null,
    programMaxSlotsPerUser: programMax != null ? Number(programMax) : null,
    programSlotCostMonthlyCents: programCost,
    programFreeSlotsPerUser: programFree,
    programMaxFreeSlotsTotal:
      programMaxFreeTotal != null ? Number(programMaxFreeTotal) : null,
  }
}

export function effectivePricingDbRow(programRow, formRow) {
  const resolved = resolveEffectiveFormPricing(programRow, formRow)
  return {
    max_slots_per_user: resolved.maxSlotsPerUser,
    slot_cost_monthly_cents: resolved.slotCostMonthlyCents,
    free_slots_per_user: resolved.freeSlotsPerUser,
    max_free_slots_total: resolved.maxFreeSlotsTotal,
  }
}

export async function loadProgramPricingRow(pool, programsId) {
  if (programsId == null) return null
  const schema = await resolveProgramsSchema(pool)
  const result = await pool.query(
    `SELECT pricing_max_slots_per_user, pricing_slot_cost_monthly_cents, pricing_free_slots_per_user,
            pricing_max_free_slots_total
     FROM ${schema.programsTable} WHERE id = $1`,
    [programsId],
  )
  return result.rows[0] ?? null
}

export async function loadEffectivePricingForForm(pool, formRow) {
  const programsId = formRow?.programs_id != null ? Number(formRow.programs_id) : null
  const programRow = programsId != null ? await loadProgramPricingRow(pool, programsId) : null
  const effective = resolveEffectiveFormPricing(programRow, formRow)
  return {
    programRow,
    effective,
    effectiveDbRow: effectivePricingDbRow(programRow, formRow),
  }
}

export async function resetClassPricingToProgram(pool, formId) {
  const result = await pool.query(
    `UPDATE scheduling_form
     SET pricing_overrides_program = FALSE, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [formId],
  )
  return result.rows.length > 0
}

export async function resetAllClassesPricingToProgram(pool, programsId) {
  const result = await pool.query(
    `UPDATE scheduling_form
     SET pricing_overrides_program = FALSE, updated_at = now()
     WHERE programs_id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [programsId],
  )
  return result.rowCount ?? result.rows.length
}

export function mapProgramPricingFields(row) {
  return {
    pricingMaxSlotsPerUser:
      row.pricing_max_slots_per_user != null ? Number(row.pricing_max_slots_per_user) : null,
    pricingSlotCostMonthlyCents: Number(row.pricing_slot_cost_monthly_cents ?? 0),
    pricingFreeSlotsPerUser: Number(row.pricing_free_slots_per_user ?? 0),
    pricingMaxFreeSlotsTotal:
      row.pricing_max_free_slots_total != null
        ? Number(row.pricing_max_free_slots_total)
        : null,
  }
}

export function mapClassPricingFields(programRow, formRow) {
  const effective = resolveEffectiveFormPricing(programRow, formRow)
  return {
    schedulingFormId: formRow?.id != null ? Number(formRow.id) : null,
    pricingOverridesProgram: effective.pricingOverridesProgram,
    formMaxSlotsPerUser: effective.formMaxSlotsPerUser,
    formSlotCostMonthlyCents: effective.formSlotCostMonthlyCents,
    formFreeSlotsPerUser: effective.formFreeSlotsPerUser,
    formMaxFreeSlotsTotal: effective.formMaxFreeSlotsTotal,
    programMaxSlotsPerUser: effective.programMaxSlotsPerUser,
    programSlotCostMonthlyCents: effective.programSlotCostMonthlyCents,
    programFreeSlotsPerUser: effective.programFreeSlotsPerUser,
    programMaxFreeSlotsTotal: effective.programMaxFreeSlotsTotal,
    maxSlotsPerUser: effective.maxSlotsPerUser,
    slotCostMonthlyCents: effective.slotCostMonthlyCents,
    freeSlotsPerUser: effective.freeSlotsPerUser,
    maxFreeSlotsTotal: effective.maxFreeSlotsTotal,
  }
}

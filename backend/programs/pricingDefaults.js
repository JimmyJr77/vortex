import { resolveProgramsSchema } from './schema.js'
import { hydrateProgramPricingRow } from './programPricingOptions.js'

export const COST_UNITS = [
  'per_slot',
  'per_class',
  'per_week',
  'per_month',
  'per_offering',
  'per_hour',
]

function normalizeCostUnit(unit) {
  return COST_UNITS.includes(unit) ? unit : 'per_month'
}

/** Reads a cost {amountCents, unit} from a row that may use new cadence or legacy monthly columns. */
export function readCost(row, { amountKey, unitKey, legacyKey }) {
  if (!row) return null
  const amount = row[amountKey]
  const unit = row[unitKey]
  if (amount != null && unit != null && Number(amount) > 0) {
    return { amountCents: Number(amount), unit: normalizeCostUnit(unit) }
  }
  const legacy = row[legacyKey]
  if (legacy != null && Number(legacy) > 0) {
    return { amountCents: Number(legacy) || 0, unit: 'per_month' }
  }
  return null
}

const FORM_COST_KEYS = {
  amountKey: 'cost_amount_cents',
  unitKey: 'cost_unit',
  legacyKey: 'slot_cost_monthly_cents',
}

/** Class-level custom cost only (ignores program fallback). */
export function readFormOverrideCost(formRow) {
  return readCost(formRow, FORM_COST_KEYS)
}

/** True when the form stores its own price, not just the override flag with inherited program cost. */
export function formHasCustomPricingOverride(formRow) {
  return Boolean(formRow?.pricing_overrides_program) && readFormOverrideCost(formRow) != null
}

/**
 * Resolve effective pricing for a class form using the Program -> Class -> 0 cascade.
 * Cost falls through to the next level only when the current level has no cost configured.
 */
export function resolveEffectiveFormPricing(programRow, formRow) {
  const overrides = Boolean(formRow?.pricing_overrides_program)

  const formCost = readCost(formRow, {
    amountKey: 'cost_amount_cents',
    unitKey: 'cost_unit',
    legacyKey: 'slot_cost_monthly_cents',
  })
  const programCost = readCost(programRow, {
    amountKey: 'pricing_cost_amount_cents',
    unitKey: 'pricing_cost_unit',
    legacyKey: 'pricing_slot_cost_monthly_cents',
  })

  let cost
  if (overrides) {
    cost = formCost ?? programCost ?? { amountCents: 0, unit: 'per_month' }
  } else {
    cost = programCost ?? formCost ?? { amountCents: 0, unit: 'per_month' }
  }

  const useProgram = !overrides && programRow != null

  const programMax = programRow?.pricing_max_slots_per_user ?? null
  const programFree = Number(programRow?.pricing_free_slots_per_user ?? 0)
  const programMaxFreeTotal = programRow?.pricing_max_free_slots_total ?? null
  const programMaxRedemptions = programRow?.pricing_max_discount_redemptions ?? null

  const formMax = formRow?.max_slots_per_user ?? null
  const formFree = Number(formRow?.free_slots_per_user ?? 0)
  const formMaxFreeTotal = formRow?.max_free_slots_total ?? null
  const formMaxRedemptions = formRow?.max_discount_redemptions ?? null

  const freeSlotsPerUser = useProgram ? programFree : formFree
  const maxFreeSlotsTotal = useProgram
    ? (programMaxFreeTotal != null ? Number(programMaxFreeTotal) : null)
    : (formMaxFreeTotal != null ? Number(formMaxFreeTotal) : null)
  const maxDiscountRedemptions = useProgram
    ? (programMaxRedemptions != null ? Number(programMaxRedemptions) : null)
    : (formMaxRedemptions != null ? Number(formMaxRedemptions) : null)

  const slotCostMonthlyCents = cost.unit === 'per_month' || cost.unit === 'per_slot' ? cost.amountCents : cost.amountCents

  return {
    pricingOverridesProgram: overrides,
    costAmountCents: cost.amountCents,
    costUnit: cost.unit,
    maxSlotsPerUser: useProgram
      ? (programMax != null ? Number(programMax) : null)
      : (formMax != null ? Number(formMax) : null),
    slotCostMonthlyCents,
    freeSlotsPerUser,
    maxFreeSlotsTotal,
    maxDiscountRedemptions,
    formMaxSlotsPerUser: formMax != null ? Number(formMax) : null,
    formSlotCostMonthlyCents: formCost?.amountCents ?? 0,
    formCostUnit: formCost?.unit ?? null,
    formFreeSlotsPerUser: formFree,
    formMaxFreeSlotsTotal: formMaxFreeTotal != null ? Number(formMaxFreeTotal) : null,
    programMaxSlotsPerUser: programMax != null ? Number(programMax) : null,
    programSlotCostMonthlyCents: programCost?.amountCents ?? 0,
    programCostUnit: programCost?.unit ?? null,
    programFreeSlotsPerUser: programFree,
    programMaxFreeSlotsTotal: programMaxFreeTotal != null ? Number(programMaxFreeTotal) : null,
  }
}

/** Synthetic db row for the free-slot allocation + monthly pricing helpers. */
export function effectivePricingDbRow(programRow, formRow) {
  const resolved = resolveEffectiveFormPricing(programRow, formRow)
  return {
    max_slots_per_user: resolved.maxSlotsPerUser,
    slot_cost_monthly_cents: resolved.slotCostMonthlyCents,
    free_slots_per_user: resolved.freeSlotsPerUser,
    max_free_slots_total: resolved.maxFreeSlotsTotal,
    cost_amount_cents: resolved.costAmountCents,
    cost_unit: resolved.costUnit,
    max_discount_redemptions: resolved.maxDiscountRedemptions,
  }
}

/**
 * Convert a resolved cost (cadence x amount) into a normalized monthly-equivalent list price for
 * a single signup line. quantities: slots held, weeks/months in the active range, offerings, classes.
 */
export function resolveLineItemCost(resolved, quantities = {}) {
  const amount = Number(resolved?.costAmountCents ?? resolved?.cost_amount_cents ?? 0) / 100
  const unit = normalizeCostUnit(resolved?.costUnit ?? resolved?.cost_unit)
  const slots = Math.max(0, Number(quantities.slots ?? 1))
  const weeks = Math.max(0, Number(quantities.weeks ?? 0))
  const months = Math.max(0, Number(quantities.months ?? 1))
  const offerings = Math.max(0, Number(quantities.offerings ?? 1))
  const classes = Math.max(0, Number(quantities.classes ?? 1))
  const hours = Math.max(0, Number(quantities.hours ?? 0))

  switch (unit) {
    case 'per_slot':
      return amount * slots
    case 'per_class':
      return amount * classes
    case 'per_week':
      return amount * (weeks || 1)
    case 'per_offering':
      return amount * offerings
    case 'per_hour':
      return amount * (hours || 1)
    case 'per_month':
    default:
      return amount * (months || 1)
  }
}

export function parseProgramPromoCodes(row) {
  const raw = row?.pricing_promo_codes
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
  return []
}

export async function loadProgramPricingRow(pool, programsId) {
  if (programsId == null) return null
  const schema = await resolveProgramsSchema(pool)
  const result = await pool.query(
    `SELECT pricing_max_slots_per_user, pricing_slot_cost_monthly_cents, pricing_free_slots_per_user,
            pricing_max_free_slots_total, pricing_cost_amount_cents, pricing_cost_unit,
            pricing_max_discount_redemptions, pricing_promo_codes,
            COALESCE(pricing_cost_options, '[]'::jsonb) AS pricing_cost_options,
            COALESCE(multi_class_pass_packages, '[]'::jsonb) AS multi_class_pass_packages
     FROM ${schema.programsTable} WHERE id = $1`,
    [programsId],
  )
  return result.rows[0] ?? null
}

export async function loadEffectivePricingForForm(pool, formRow) {
  const programsId = formRow?.programs_id != null ? Number(formRow.programs_id) : null
  const programRow = hydrateProgramPricingRow(
    programsId != null ? await loadProgramPricingRow(pool, programsId) : null,
  )
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
    pricingCostAmountCents:
      row.pricing_cost_amount_cents != null
        ? Number(row.pricing_cost_amount_cents)
        : Number(row.pricing_slot_cost_monthly_cents ?? 0),
    pricingCostUnit: row.pricing_cost_unit ?? 'per_month',
    pricingMaxDiscountRedemptions:
      row.pricing_max_discount_redemptions != null
        ? Number(row.pricing_max_discount_redemptions)
        : null,
    pricingPromoCodes: parseProgramPromoCodes(row),
  }
}

export function mapClassPricingFields(programRow, formRow) {
  const effective = resolveEffectiveFormPricing(programRow, formRow)
  return {
    schedulingFormId: formRow?.id != null ? Number(formRow.id) : null,
    pricingOverridesProgram: effective.pricingOverridesProgram,
    costAmountCents: effective.costAmountCents,
    costUnit: effective.costUnit,
    formMaxSlotsPerUser: effective.formMaxSlotsPerUser,
    formSlotCostMonthlyCents: effective.formSlotCostMonthlyCents,
    formCostUnit: effective.formCostUnit,
    formFreeSlotsPerUser: effective.formFreeSlotsPerUser,
    formMaxFreeSlotsTotal: effective.formMaxFreeSlotsTotal,
    programMaxSlotsPerUser: effective.programMaxSlotsPerUser,
    programSlotCostMonthlyCents: effective.programSlotCostMonthlyCents,
    programCostUnit: effective.programCostUnit,
    programFreeSlotsPerUser: effective.programFreeSlotsPerUser,
    programMaxFreeSlotsTotal: effective.programMaxFreeSlotsTotal,
    maxSlotsPerUser: effective.maxSlotsPerUser,
    slotCostMonthlyCents: effective.slotCostMonthlyCents,
    freeSlotsPerUser: effective.freeSlotsPerUser,
    maxFreeSlotsTotal: effective.maxFreeSlotsTotal,
    maxDiscountRedemptions: effective.maxDiscountRedemptions,
  }
}

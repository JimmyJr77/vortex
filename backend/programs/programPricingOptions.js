import { resolveProgramsSchema } from './schema.js'

export const PROGRAM_PRICING_OPTION_KEYS = new Set([
  'per_class',
  'per_hour',
  'monthly_flat',
  'monthly_1x',
  'monthly_2x',
  'monthly_3x',
  'monthly_4x',
  'monthly_5x',
  'monthly_6x',
  'monthly_7x',
  'unlimited_unlimited_daily',
  'unlimited_1_daily',
  'unlimited_2_daily',
  'unlimited_3_daily',
  'per_offering',
])

export function normalizeProgramPricingOptions(raw) {
  const defaults = [...PROGRAM_PRICING_OPTION_KEYS].map((key) => ({
    key,
    enabled: false,
    amountCents: 0,
    ...(key === 'per_offering' ? { offeringLabel: 'offering' } : {}),
  }))

  if (!Array.isArray(raw)) return defaults

  const byKey = new Map()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const key = String(item.key ?? '')
    if (!PROGRAM_PRICING_OPTION_KEYS.has(key)) continue
    byKey.set(key, {
      key,
      enabled: Boolean(item.enabled),
      amountCents: Math.max(0, Math.round(Number(item.amountCents) || 0)),
      ...(key === 'per_offering'
        ? { offeringLabel: item.offeringLabel === 'event' ? 'event' : 'offering' }
        : {}),
    })
  }

  return defaults.map((def) => byKey.get(def.key) ?? def)
}

/** Enabled base-cost options (excludes disabled or zero-amount). */
export function enabledBasePricingOptions(options = []) {
  return options.filter((o) => o.enabled && o.amountCents > 0)
}

/** Map a pricing option key to cost unit + amount for enrollment pricing. */
export function costFromPricingOptionKey(optionKey, options = []) {
  const opt = options.find((o) => o.key === optionKey && o.enabled && o.amountCents > 0)
  if (!opt) return null
  const unit =
    opt.key === 'per_class'
      ? 'per_class'
      : opt.key === 'per_hour'
        ? 'per_hour'
        : opt.key === 'per_offering'
          ? 'per_offering'
          : 'per_month'
  return { amountCents: opt.amountCents, unit, optionKey: opt.key }
}

/** Override effectiveDbRow cost columns from a selected program pricing option. */
export function effectiveDbRowFromPricingOption(baseRow, programRow, optionKey) {
  if (!optionKey || !programRow) return baseRow
  const options = normalizeProgramPricingOptions(programRow.pricing_cost_options)
  const cost = costFromPricingOptionKey(optionKey, options)
  if (!cost) return baseRow
  return {
    ...baseRow,
    cost_amount_cents: cost.amountCents,
    cost_unit: cost.unit,
    slot_cost_monthly_cents: cost.unit === 'per_month' ? cost.amountCents : baseRow?.slot_cost_monthly_cents,
    pricing_option_key: cost.optionKey,
  }
}

/**
 * When pricing_cost_options has no enabled rows, mirror admin UI by surfacing legacy
 * program columns (pricing_slot_cost_monthly_cents + pricing_cost_unit) as a
 * flat monthly fee. Legacy rows do not contain a weekly frequency.
 */
export function hydrateProgramPricingOptionsFromLegacy(row = {}) {
  const normalized = normalizeProgramPricingOptions(
    row.pricing_cost_options ?? row.pricingCostOptions,
  )
  if (normalized.some((o) => o.enabled && o.amountCents > 0)) return normalized

  const cents = Number(
    row.pricing_slot_cost_monthly_cents ??
      row.pricingSlotCostMonthlyCents ??
      row.pricing_cost_amount_cents ??
      row.pricingCostAmountCents ??
      0,
  )
  const unit = row.pricing_cost_unit ?? row.pricingCostUnit ?? 'per_month'
  if (cents <= 0) return normalized

  const legacyKey =
    unit === 'per_class'
      ? 'per_class'
      : unit === 'per_hour'
        ? 'per_hour'
        : unit === 'per_offering'
          ? 'per_offering'
          : unit === 'per_month'
            ? 'monthly_flat'
            : null

  if (!legacyKey) return normalized
  return normalized.map((o) =>
    o.key === legacyKey ? { ...o, enabled: true, amountCents: cents } : o,
  )
}

/**
 * Normalize a program pricing row for enrollment/order preview: hydrate disabled options
 * from legacy columns and back-fill legacy columns from enabled options when needed.
 */
export function hydrateProgramPricingRow(row) {
  if (!row) return null
  const hydratedOptions = hydrateProgramPricingOptionsFromLegacy(row)
  const derived = deriveLegacyPricingFromOptions(hydratedOptions)
  const costAmount =
    Number(row.pricing_cost_amount_cents ?? 0) > 0
      ? Number(row.pricing_cost_amount_cents)
      : Number(row.pricing_slot_cost_monthly_cents ?? 0) > 0
        ? Number(row.pricing_slot_cost_monthly_cents)
        : derived.pricingCostAmountCents
  const slotMonthly =
    Number(row.pricing_slot_cost_monthly_cents ?? 0) > 0
      ? Number(row.pricing_slot_cost_monthly_cents)
      : derived.pricingSlotCostMonthlyCents
  return {
    ...row,
    pricing_cost_options: hydratedOptions,
    pricing_cost_amount_cents: costAmount,
    pricing_slot_cost_monthly_cents: slotMonthly,
    pricing_cost_unit: row.pricing_cost_unit || derived.pricingCostUnit || 'per_month',
  }
}

/** Map enabled options to legacy single cost columns for enrollment fallbacks. */
export function deriveLegacyPricingFromOptions(options = []) {
  const enabled = options.filter((o) => o.enabled && o.amountCents > 0)
  if (enabled.length === 0) {
    return { pricingSlotCostMonthlyCents: 0, pricingCostUnit: 'per_month', pricingCostAmountCents: 0 }
  }

  const pick =
    enabled.find((o) => o.key === 'monthly_flat') ??
    enabled.find((o) => o.key === 'monthly_1x') ??
    enabled.find((o) => o.key === 'per_class') ??
    enabled.find((o) => o.key === 'per_hour') ??
    enabled.find((o) => o.key.startsWith('monthly_')) ??
    enabled[0]

  const unit =
    pick.key === 'per_class'
      ? 'per_class'
      : pick.key === 'per_hour'
        ? 'per_hour'
        : pick.key === 'per_offering'
          ? 'per_offering'
          : pick.key.startsWith('monthly_') || pick.key.startsWith('unlimited_')
            ? 'per_month'
            : 'per_month'

  return {
    pricingSlotCostMonthlyCents: pick.amountCents,
    pricingCostUnit: unit,
    pricingCostAmountCents: pick.amountCents,
  }
}

/**
 * Deactivate legacy auto-created weekly "$ off" discount rules from program pricing.
 * Weekly savings section removed — rules are no longer synced on save.
 */
export async function deactivateProgramPricingWeeklyOffRules(pool, programId) {
  const { ensureDiscountEngineSchema } = await import('./schema.js')
  await ensureDiscountEngineSchema(pool)

  const managed = await pool.query(
    `SELECT dr.id, dr.scope_ref_id
     FROM discount_rule dr
     WHERE dr.config->>'source' = 'program_pricing_options'
       AND (dr.config->>'program_id')::bigint = $1`,
    [programId],
  )

  for (const row of managed.rows) {
    await pool.query(`UPDATE discount_rule SET active = FALSE, updated_at = now() WHERE id = $1`, [
      row.id,
    ])
    await pool.query(
      `DELETE FROM pricing_benefit_selection
       WHERE scope_level = 'class'
         AND scope_ref_id = $1
         AND benefit_type = 'discount_rule'
         AND benefit_id = $2`,
      [Number(row.scope_ref_id), Number(row.id)],
    )
  }
}

/** @deprecated Weekly savings removed — deactivates orphaned rules only. */
export async function syncProgramPricingDiscountRules(pool, programId) {
  await deactivateProgramPricingWeeklyOffRules(pool, programId)
}

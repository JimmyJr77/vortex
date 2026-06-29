import { resolveProgramsSchema } from './schema.js'

export const PROGRAM_PRICING_OPTION_KEYS = new Set([
  'per_class',
  'per_hour',
  'monthly_1x',
  'monthly_2x',
  'monthly_3x',
  'monthly_4x',
  'monthly_5x',
  'monthly_6x',
  'monthly_7x',
  'discount_off_2x',
  'discount_off_3x',
  'discount_off_4x',
  'discount_off_5x',
  'discount_off_6x',
  'discount_off_7x',
  'unlimited_unlimited_daily',
  'unlimited_1_daily',
  'unlimited_2_daily',
  'unlimited_3_daily',
  'per_offering',
])

const WEEKLY_DISCOUNT_PREFIX = 'discount_off_'

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

/** Map enabled options to legacy single cost columns for enrollment fallbacks. */
export function deriveLegacyPricingFromOptions(options = []) {
  const enabled = options.filter((o) => o.enabled && o.amountCents > 0)
  if (enabled.length === 0) {
    return { pricingSlotCostMonthlyCents: 0, pricingCostUnit: 'per_month', pricingCostAmountCents: 0 }
  }

  const pick =
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

function weeklyTimesFromKey(key) {
  const match = /^discount_off_(\d+)x$/.exec(key)
  return match ? Number(match[1]) : null
}

async function getFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

async function loadProgramClassForms(pool, programId) {
  const schema = await resolveProgramsSchema(pool)
  const programFk = schema.programFkColumn

  const direct = await pool.query(
    `SELECT sf.id, sf.title AS display_name, pc.display_name AS program_name
     FROM scheduling_form sf
     LEFT JOIN ${schema.programsTable} pc ON pc.id = $1
     WHERE sf.programs_id = $1 AND sf.deleted_at IS NULL
     ORDER BY sf.title ASC`,
    [programId],
  )
  if (direct.rows.length > 0) return direct.rows

  const viaClass = await pool.query(
    `SELECT sf.id, sf.title AS display_name, pc.display_name AS program_name
     FROM scheduling_form sf
     INNER JOIN program p ON p.id = sf.program_id
     INNER JOIN ${schema.programsTable} pc ON pc.id = p.${programFk}
     WHERE p.${programFk} = $1 AND sf.deleted_at IS NULL
     ORDER BY sf.title ASC`,
    [programId],
  )
  return viaClass.rows
}

async function upsertManagedClassDiscount(client, {
  facilityId,
  programId,
  formId,
  formDisplayName,
  programDisplayName,
  optionKey,
  timesPerWeek,
  amountCents,
}) {
  const existing = await client.query(
    `SELECT id FROM discount_rule
     WHERE scope_level = 'class'
       AND scope_ref_id = $1
       AND config->>'source' = 'program_pricing_options'
       AND config->>'option_key' = $2
     LIMIT 1`,
    [formId, optionKey],
  )

  const name = `${formDisplayName || programDisplayName} — $${(amountCents / 100).toFixed(2)} off @ ${timesPerWeek}×/week`
  const config = {
    source: 'program_pricing_options',
    option_kind: 'weekly_off',
    option_key: optionKey,
    times_per_week: timesPerWeek,
    program_id: programId,
    form_id: formId,
  }

  let ruleId
  if (existing.rows.length > 0) {
    ruleId = Number(existing.rows[0].id)
    await client.query(
      `UPDATE discount_rule
       SET name = $2,
           amount_type = 'fixed',
           amount_value = $3,
           active = TRUE,
           config = $4::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [ruleId, name, amountCents, JSON.stringify(config)],
    )
    await client.query('DELETE FROM discount_rule_tier WHERE rule_id = $1', [ruleId])
  } else {
    const insert = await client.query(
      `INSERT INTO discount_rule
         (facility_id, name, description, type, amount_type, amount_value, apply_to, calc_base,
          priority, stackable, exclusivity_group, scope_level, scope_ref_id, active, config)
       VALUES ($1,$2,$3,'multi_class','fixed',$4,'per_class','pre',120,TRUE,'program_pricing_weekly_off','class',$5,TRUE,$6::jsonb)
       RETURNING id`,
      [
        facilityId,
        name,
        `Auto-created from program pricing (${programDisplayName}).`,
        amountCents,
        formId,
        JSON.stringify(config),
      ],
    )
    ruleId = Number(insert.rows[0].id)
  }

  await client.query(
    `INSERT INTO discount_rule_tier
       (rule_id, threshold, amount_type, amount_value)
     VALUES ($1, $2, 'fixed', $3)`,
    [ruleId, timesPerWeek, amountCents],
  )

  return ruleId
}

async function ensureBenefitSelection(client, formId, ruleId) {
  const existing = await client.query(
    `SELECT id FROM pricing_benefit_selection
     WHERE scope_level = 'class'
       AND scope_ref_id = $1
       AND benefit_type = 'discount_rule'
       AND benefit_id = $2
     LIMIT 1`,
    [formId, ruleId],
  )
  if (existing.rows.length > 0) return

  const maxSort = await client.query(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_sort
     FROM pricing_benefit_selection
     WHERE scope_level = 'class' AND scope_ref_id = $1`,
    [formId],
  )
  const sortOrder = Number(maxSort.rows[0]?.max_sort ?? -1) + 1

  await client.query(
    `INSERT INTO pricing_benefit_selection
       (scope_level, scope_ref_id, benefit_type, benefit_id, auto_apply, allow_member_code, sort_order)
     VALUES ('class', $1, 'discount_rule', $2, TRUE, FALSE, $3)`,
    [formId, ruleId, sortOrder],
  )
}

/**
 * Create/update/deactivate class-scoped discounts for enabled "$ off for N× per week" options.
 */
export async function syncProgramPricingDiscountRules(pool, programId, programDisplayName, options) {
  const { ensureDiscountEngineSchema } = await import('./schema.js')
  await ensureDiscountEngineSchema(pool)

  const facilityId = await getFacilityId(pool)
  if (!facilityId) return

  const enabledWeeklyOff = options.filter(
    (o) => o.enabled && o.amountCents > 0 && o.key.startsWith(WEEKLY_DISCOUNT_PREFIX),
  )
  const forms = await loadProgramClassForms(pool, programId)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const activePairs = new Set()
    for (const opt of enabledWeeklyOff) {
      const timesPerWeek = weeklyTimesFromKey(opt.key)
      if (!timesPerWeek) continue
      for (const form of forms) {
        const formId = Number(form.id)
        activePairs.add(`${formId}:${opt.key}`)
        const ruleId = await upsertManagedClassDiscount(client, {
          facilityId,
          programId,
          formId,
          formDisplayName: form.display_name,
          programDisplayName,
          optionKey: opt.key,
          timesPerWeek,
          amountCents: opt.amountCents,
        })
        await ensureBenefitSelection(client, formId, ruleId)
      }
    }

    const managed = await client.query(
      `SELECT dr.id, dr.scope_ref_id, dr.config->>'option_key' AS option_key
       FROM discount_rule dr
       WHERE dr.scope_level = 'class'
         AND dr.config->>'source' = 'program_pricing_options'
         AND (dr.config->>'program_id')::bigint = $1`,
      [programId],
    )

    for (const row of managed.rows) {
      const pair = `${Number(row.scope_ref_id)}:${row.option_key}`
      if (!activePairs.has(pair)) {
        await client.query(`UPDATE discount_rule SET active = FALSE, updated_at = now() WHERE id = $1`, [
          row.id,
        ])
        await client.query(
          `DELETE FROM pricing_benefit_selection
           WHERE scope_level = 'class'
             AND scope_ref_id = $1
             AND benefit_type = 'discount_rule'
             AND benefit_id = $2`,
          [Number(row.scope_ref_id), Number(row.id)],
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

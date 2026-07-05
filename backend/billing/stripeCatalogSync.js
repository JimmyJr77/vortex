/**
 * Sync Vortex catalog pricing → Stripe Products + Prices.
 * Vortex remains source of truth for list prices; Stripe Prices are immutable —
 * amount changes create a new Price and deactivate the old one.
 *
 * See docs/STRIPE_CATALOG_INTEGRATION.md
 */

import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import { resolveProgramsSchema } from '../programs/schema.js'
import {
  PROGRAM_PRICING_OPTION_KEYS,
  hydrateProgramPricingRow,
  normalizeProgramPricingOptions,
} from '../programs/programPricingOptions.js'
import {
  formHasCustomPricingOverride,
  readFormOverrideCost,
} from '../programs/pricingDefaults.js'
import { normalizeMultiClassPassPackages } from '../programs/multiClassPass.js'

const OPTION_LABELS = {
  per_class: 'Per class',
  per_hour: 'Per hour',
  monthly_1x: 'Monthly @ 1× per week',
  monthly_2x: 'Monthly @ 2× per week',
  monthly_3x: 'Monthly @ 3× per week',
  monthly_4x: 'Monthly @ 4× per week',
  monthly_5x: 'Monthly @ 5× per week',
  monthly_6x: 'Monthly @ 6× per week',
  monthly_7x: 'Monthly @ 7× per week',
  unlimited_unlimited_daily: 'Unlimited — unlimited daily',
  unlimited_1_daily: 'Unlimited — up to 1 class/day',
  unlimited_2_daily: 'Unlimited — up to 2 classes/day',
  unlimited_3_daily: 'Unlimited — up to 3 classes/day',
  per_offering: 'Per offering',
}

let schemaEnsured = false
let recurringSchemaEnsured = false

async function runMigrationFile(pool, relativePath) {
  const fs = await import('fs')
  const migrationPath = new URL(relativePath, import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

/** billing_subscription and related columns — required before 056 Stripe catalog ALTERs. */
export async function ensureBillingRecurringSchema(pool) {
  if (recurringSchemaEnsured) return
  await runMigrationFile(pool, '../migrations/053_billing_recurring_model.sql')
  await runMigrationFile(pool, '../migrations/054_billing_anchor_first.sql')
  await runMigrationFile(pool, '../migrations/055_enrollment_cancel_effective.sql')
  recurringSchemaEnsured = true
}

export function programOptionLookupKey(programsId, optionKey) {
  return `vortex:program:${programsId}:${optionKey}`
}

export function passLookupKey(programsId, packageId) {
  return `vortex:program:${programsId}:pass:${packageId}`
}

export function feeLookupKey(feeId) {
  return `vortex:fee:${feeId}`
}

export function formOverrideLookupKey(formId) {
  return `vortex:form:${formId}:override`
}

export function recurringIntervalForOptionKey(optionKey) {
  if (optionKey.startsWith('monthly_') || optionKey.startsWith('unlimited_')) return 'month'
  return null
}

export function recurringIntervalForCostUnit(costUnit) {
  return costUnit === 'per_month' ? 'month' : null
}

function buildMetadata({ entityType, entityId, subKey, facilityId }) {
  return {
    vortex_entity_type: entityType,
    vortex_entity_id: String(entityId),
    ...(subKey ? { vortex_sub_key: subKey } : {}),
    ...(facilityId != null ? { vortex_facility_id: String(facilityId) } : {}),
  }
}

export async function ensureStripeCatalogSchema(pool) {
  if (schemaEnsured) return
  await ensureBillingRecurringSchema(pool)
  await runMigrationFile(pool, '../migrations/056_stripe_catalog.sql')
  schemaEnsured = true
}

async function loadCatalogRow(pool, lookupKey) {
  const res = await pool.query(`SELECT * FROM stripe_catalog_item WHERE stripe_lookup_key = $1`, [
    lookupKey,
  ])
  return res.rows[0] ?? null
}

async function deactivateStripePrice(stripe, priceId) {
  if (!priceId) return
  try {
    await stripe.prices.update(priceId, { active: false, lookup_key: '' })
  } catch (err) {
    if (!/No such price/i.test(String(err.message))) throw err
  }
}

async function deactivateStripeProduct(stripe, productId) {
  if (!productId) return
  try {
    await stripe.products.update(productId, { active: false })
  } catch (err) {
    if (!/No such product/i.test(String(err.message))) throw err
  }
}

/**
 * Deactivate a catalog mapping and its Stripe Product/Price.
 */
export async function deactivateCatalogByLookupKey(pool, lookupKey) {
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  await ensureStripeCatalogSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) return { status: 'skipped', reason: 'stripe_unavailable' }

  const row = await loadCatalogRow(pool, lookupKey)
  if (!row) return { status: 'skipped', reason: 'not_found' }

  await deactivateStripePrice(stripe, row.stripe_price_id)
  await deactivateStripeProduct(stripe, row.stripe_product_id)
  await pool.query(
    `UPDATE stripe_catalog_item
     SET active = FALSE, updated_at = now(), last_synced_at = now()
     WHERE id = $1`,
    [row.id],
  )
  return { status: 'deactivated', lookupKey }
}

/**
 * Upsert Stripe Product + Price and persist stripe_catalog_item.
 */
export async function upsertCatalogItem(
  pool,
  {
    facilityId,
    entityType,
    entityId,
    subKey = null,
    lookupKey,
    productName,
    productDescription = '',
    amountCents,
    recurringInterval = null,
    active = true,
  },
) {
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  await ensureStripeCatalogSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) return { status: 'skipped', reason: 'stripe_unavailable' }

  const metadata = buildMetadata({ entityType, entityId, subKey, facilityId })
  const normalizedAmount = Math.max(0, Math.round(Number(amountCents) || 0))

  if (!active || normalizedAmount <= 0) {
    return deactivateCatalogByLookupKey(pool, lookupKey)
  }

  const existing = await loadCatalogRow(pool, lookupKey)
  let productId = existing?.stripe_product_id ?? null
  let forceNewPrice = false

  if (productId) {
    try {
      await stripe.products.update(productId, {
        name: productName,
        description: productDescription || undefined,
        metadata,
        active: true,
      })
    } catch (err) {
      // Test-mode product IDs in DB are invalid after switching to live keys.
      if (err?.code === 'resource_missing') {
        productId = null
        forceNewPrice = true
      } else {
        throw err
      }
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: productName,
      description: productDescription || undefined,
      metadata,
    })
    productId = product.id
  }

  const priceUnchanged =
    !forceNewPrice &&
    existing &&
    existing.active &&
    Number(existing.amount_cents) === normalizedAmount &&
    (existing.recurring_interval ?? null) === (recurringInterval ?? null)

  let priceId = existing?.stripe_price_id ?? null

  if (!priceUnchanged) {
    if (existing?.stripe_price_id) {
      await deactivateStripePrice(stripe, existing.stripe_price_id)
    }

    const priceParams = {
      product: productId,
      currency: 'usd',
      unit_amount: normalizedAmount,
      lookup_key: lookupKey,
      metadata,
    }
    if (recurringInterval) {
      priceParams.recurring = { interval: recurringInterval }
    }
    const price = await stripe.prices.create(priceParams)
    priceId = price.id
  }

  if (existing) {
    await pool.query(
      `UPDATE stripe_catalog_item SET
         facility_id = $2,
         stripe_product_id = $3,
         stripe_price_id = $4,
         amount_cents = $5,
         recurring_interval = $6,
         active = TRUE,
         last_synced_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [existing.id, facilityId, productId, priceId, normalizedAmount, recurringInterval],
    )
    return {
      status: priceUnchanged ? 'unchanged' : 'updated',
      lookupKey,
      stripeProductId: productId,
      stripePriceId: priceId,
    }
  }

  await pool.query(
    `INSERT INTO stripe_catalog_item (
       facility_id, entity_type, entity_id, sub_key,
       stripe_product_id, stripe_price_id, stripe_lookup_key,
       amount_cents, recurring_interval, active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)`,
    [
      facilityId,
      entityType,
      entityId,
      subKey,
      productId,
      priceId,
      lookupKey,
      normalizedAmount,
      recurringInterval,
    ],
  )
  return {
    status: 'created',
    lookupKey,
    stripeProductId: productId,
    stripePriceId: priceId,
  }
}

async function deactivateOrphanedProgramItems(pool, programsId, activeSubKeys, entityType) {
  const res = await pool.query(
    `SELECT stripe_lookup_key, sub_key FROM stripe_catalog_item
     WHERE entity_type = $1 AND entity_id = $2 AND active = TRUE`,
    [entityType, programsId],
  )
  for (const row of res.rows) {
    if (!activeSubKeys.has(row.sub_key)) {
      await deactivateCatalogByLookupKey(pool, row.stripe_lookup_key)
    }
  }
}

async function loadProgramRow(pool, programsId) {
  const schema = await resolveProgramsSchema(pool)
  const res = await pool.query(
    `SELECT id, facility_id, name, display_name,
            pricing_cost_amount_cents, pricing_slot_cost_monthly_cents, pricing_cost_unit,
            COALESCE(pricing_cost_options, '[]'::jsonb) AS pricing_cost_options,
            COALESCE(multi_class_pass_packages, '[]'::jsonb) AS multi_class_pass_packages
     FROM ${schema.programsTable} WHERE id = $1`,
    [programsId],
  )
  return res.rows[0] ?? null
}

function programDisplayName(row) {
  const display = String(row.display_name ?? row.name ?? '').trim()
  return display || `Program ${row.id}`
}

/** Sync all enabled pricing options + multi-class passes for one program. */
export async function syncProgramCatalog(pool, programsId) {
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  const rawProgram = await loadProgramRow(pool, programsId)
  if (!rawProgram) return { status: 'error', reason: 'program_not_found' }
  const program = hydrateProgramPricingRow(rawProgram)

  const facilityId = program.facility_id != null ? Number(program.facility_id) : null
  const programName = programDisplayName(program)
  const options = normalizeProgramPricingOptions(program.pricing_cost_options)
  const packages = normalizeMultiClassPassPackages(program.multi_class_pass_packages)

  const results = []
  const activeOptionKeys = new Set()
  const activePassIds = new Set()

  for (const opt of options) {
    const lookupKey = programOptionLookupKey(programsId, opt.key)
    if (opt.enabled && opt.amountCents > 0) {
      activeOptionKeys.add(opt.key)
      const label = OPTION_LABELS[opt.key] ?? opt.key
      results.push(
        await upsertCatalogItem(pool, {
          facilityId,
          entityType: 'program_option',
          entityId: programsId,
          subKey: opt.key,
          lookupKey,
          productName: `${programName} — ${label}`,
          productDescription: `${programName} (${label})`,
          amountCents: opt.amountCents,
          recurringInterval: recurringIntervalForOptionKey(opt.key),
          active: true,
        }),
      )
    } else {
      results.push(await deactivateCatalogByLookupKey(pool, lookupKey))
    }
  }

  for (const key of PROGRAM_PRICING_OPTION_KEYS) {
    if (!options.some((o) => o.key === key)) {
      results.push(await deactivateCatalogByLookupKey(pool, programOptionLookupKey(programsId, key)))
    }
  }

  await deactivateOrphanedProgramItems(pool, programsId, activeOptionKeys, 'program_option')

  for (const pkg of packages) {
    const lookupKey = passLookupKey(programsId, pkg.id)
    if (pkg.enabled && pkg.priceCents >= 0 && pkg.classCount > 0) {
      activePassIds.add(pkg.id)
      results.push(
        await upsertCatalogItem(pool, {
          facilityId,
          entityType: 'multi_class_pass',
          entityId: programsId,
          subKey: pkg.id,
          lookupKey,
          productName: `${programName} — ${pkg.label}`,
          productDescription: `${programName} multi-class pass (${pkg.classCount} classes)`,
          amountCents: pkg.priceCents,
          recurringInterval: null,
          active: true,
        }),
      )
    } else {
      results.push(await deactivateCatalogByLookupKey(pool, lookupKey))
    }
  }

  await deactivateOrphanedProgramItems(pool, programsId, activePassIds, 'multi_class_pass')

  return { status: 'ok', programsId, results }
}

export async function syncAdditionalFeeCatalog(pool, feeId) {
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  const res = await pool.query(`SELECT * FROM additional_fee WHERE id = $1`, [feeId])
  const fee = res.rows[0]
  if (!fee) return { status: 'error', reason: 'fee_not_found' }

  const lookupKey = feeLookupKey(feeId)
  const facilityId = fee.facility_id != null ? Number(fee.facility_id) : null
  const active = Boolean(fee.active) && Number(fee.amount_cents) > 0

  return upsertCatalogItem(pool, {
    facilityId,
    entityType: 'additional_fee',
    entityId: feeId,
    subKey: null,
    lookupKey,
    productName: String(fee.name),
    productDescription: fee.description ? String(fee.description) : '',
    amountCents: Number(fee.amount_cents),
    recurringInterval: null,
    active,
  })
}

export async function syncClassOverrideCatalog(pool, formId) {
  if (!stripeEnabled()) return { status: 'skipped', reason: 'stripe_disabled' }
  const res = await pool.query(
    `SELECT sf.id, sf.title, sf.pricing_overrides_program,
            sf.slot_cost_monthly_cents, sf.cost_unit, sf.cost_amount_cents,
            p.facility_id, p.display_name, p.name
     FROM scheduling_form sf
     LEFT JOIN programs p ON p.id = sf.programs_id
     WHERE sf.id = $1 AND sf.deleted_at IS NULL`,
    [formId],
  )
  const form = res.rows[0]
  if (!form) return { status: 'error', reason: 'form_not_found' }

  const lookupKey = formOverrideLookupKey(formId)
  const hasCustomOverride = formHasCustomPricingOverride(form)
  if (!hasCustomOverride) {
    return deactivateClassOverrideCatalog(pool, formId)
  }

  const formCost = readFormOverrideCost(form)
  const costUnit = formCost?.unit ?? 'per_month'
  const amountCents = Number(formCost?.amountCents ?? 0)
  const facilityId = form.facility_id != null ? Number(form.facility_id) : null
  const className = String(form.title ?? '').trim() || `Class ${formId}`
  const programName = String(form.display_name ?? form.name ?? '').trim()
  const active = amountCents > 0

  return upsertCatalogItem(pool, {
    facilityId,
    entityType: 'class_override',
    entityId: formId,
    subKey: 'override',
    lookupKey,
    productName: programName ? `${programName} — ${className} (override)` : `${className} (override)`,
    productDescription: `Custom pricing override for ${className}`,
    amountCents,
    recurringInterval: recurringIntervalForCostUnit(costUnit),
    active,
  })
}

export async function deactivateAdditionalFeeCatalog(pool, feeId) {
  return deactivateCatalogByLookupKey(pool, feeLookupKey(feeId))
}

export async function deactivateClassOverrideCatalog(pool, formId) {
  return deactivateCatalogByLookupKey(pool, formOverrideLookupKey(formId))
}

function buildCatalogOfferingLabel(row) {
  const programName = String(row.program_display_name ?? row.program_name ?? '').trim()
  switch (row.entity_type) {
    case 'program_option': {
      const label = OPTION_LABELS[row.sub_key] ?? row.sub_key
      return programName ? `${programName} — ${label}` : label
    }
    case 'multi_class_pass': {
      const packages = normalizeMultiClassPassPackages(row.multi_class_pass_packages ?? [])
      const pkg = packages.find((p) => p.id === row.sub_key)
      const passLabel = pkg?.label ?? `Pass ${row.sub_key}`
      return programName ? `${programName} — ${passLabel}` : passLabel
    }
    case 'additional_fee':
      return String(row.fee_name ?? `Fee ${row.entity_id}`)
    case 'class_override': {
      const className = String(row.form_title ?? `Class ${row.entity_id}`).trim()
      const parentName = String(row.form_program_display_name ?? row.form_program_name ?? '').trim()
      return parentName ? `${parentName} — ${className} (override)` : `${className} (override)`
    }
    default:
      return row.stripe_lookup_key
  }
}

/** Admin-facing rows: every mapped catalog item and its Stripe price. */
export async function listStripeCatalogBreakdown(pool) {
  await ensureStripeCatalogSchema(pool)
  const schema = await resolveProgramsSchema(pool)
  const res = await pool.query(
    `
      SELECT
        sci.id,
        sci.entity_type,
        sci.entity_id,
        sci.sub_key,
        sci.amount_cents,
        sci.recurring_interval,
        sci.active,
        sci.stripe_product_id,
        sci.stripe_price_id,
        sci.stripe_lookup_key,
        sci.last_synced_at,
        p.display_name AS program_display_name,
        p.name AS program_name,
        p.multi_class_pass_packages,
        af.name AS fee_name,
        sf.title AS form_title,
        parent.display_name AS form_program_display_name,
        parent.name AS form_program_name
      FROM stripe_catalog_item sci
      LEFT JOIN ${schema.programsTable} p
        ON sci.entity_type IN ('program_option', 'multi_class_pass') AND p.id = sci.entity_id
      LEFT JOIN additional_fee af
        ON sci.entity_type = 'additional_fee' AND af.id = sci.entity_id
      LEFT JOIN scheduling_form sf
        ON sci.entity_type = 'class_override' AND sf.id = sci.entity_id
      LEFT JOIN ${schema.programsTable} parent
        ON sci.entity_type = 'class_override' AND parent.id = sf.programs_id
      ORDER BY sci.active DESC, sci.entity_type, sci.entity_id, sci.sub_key NULLS LAST
    `,
  )

  return res.rows.map((row) => ({
    offering: buildCatalogOfferingLabel(row),
    entityType: row.entity_type,
    entityId: Number(row.entity_id),
    subKey: row.sub_key,
    amountCents: Number(row.amount_cents),
    recurringInterval: row.recurring_interval,
    active: Boolean(row.active),
    stripeProductId: row.stripe_product_id,
    stripePriceId: row.stripe_price_id,
    lookupKey: row.stripe_lookup_key,
    lastSyncedAt: row.last_synced_at,
  }))
}

export async function getCatalogSyncStatus(pool) {
  await ensureStripeCatalogSchema(pool)
  const totals = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE active) AS active_count,
      COUNT(*) FILTER (WHERE NOT active) AS inactive_count,
      COUNT(*) AS total_count
    FROM stripe_catalog_item
  `)
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  const stripeMode = secretKey.startsWith('sk_live_')
    ? 'live'
    : secretKey.startsWith('sk_test_')
      ? 'test'
      : secretKey
        ? 'unknown'
        : 'none'
  const items = await listStripeCatalogBreakdown(pool)
  return {
    stripeEnabled: stripeEnabled(),
    stripeMode,
    catalogItems: totals.rows[0],
    lastSynced: await pool.query(
      `SELECT MAX(last_synced_at) AS last_synced_at FROM stripe_catalog_item`,
    ).then((r) => r.rows[0]?.last_synced_at ?? null),
    items,
  }
}

/** Resolve stripe_price_id for a catalog entity (used by checkout in Phase 2). */
export async function resolveStripePriceId(pool, lookupKey) {
  await ensureStripeCatalogSchema(pool)
  const res = await pool.query(
    `SELECT stripe_price_id FROM stripe_catalog_item
     WHERE stripe_lookup_key = $1 AND active = TRUE`,
    [lookupKey],
  )
  return res.rows[0]?.stripe_price_id ?? null
}

/** Full backfill: all facilities → programs → fees → class overrides. */
export async function syncAllCatalog(pool) {
  if (!stripeEnabled()) {
    console.log('[stripeCatalogSync] STRIPE_ENABLED is false or STRIPE_SECRET_KEY missing — skipping.')
    return { status: 'skipped', reason: 'stripe_disabled' }
  }
  await ensureStripeCatalogSchema(pool)

  const summary = { programs: 0, fees: 0, forms: 0, errors: [] }
  const schema = await resolveProgramsSchema(pool)

  const programs = await pool.query(
    `SELECT id FROM ${schema.programsTable} WHERE archived IS NOT TRUE OR archived IS NULL`,
  )
  for (const row of programs.rows) {
    try {
      await syncProgramCatalog(pool, Number(row.id))
      summary.programs += 1
    } catch (err) {
      summary.errors.push({ type: 'program', id: row.id, message: err.message })
      console.error('[stripeCatalogSync] program', row.id, err)
    }
  }

  const fees = await pool.query(`SELECT id FROM additional_fee WHERE active = TRUE`)
  for (const row of fees.rows) {
    try {
      await syncAdditionalFeeCatalog(pool, Number(row.id))
      summary.fees += 1
    } catch (err) {
      summary.errors.push({ type: 'fee', id: row.id, message: err.message })
      console.error('[stripeCatalogSync] fee', row.id, err)
    }
  }

  const forms = await pool.query(
    `SELECT id FROM scheduling_form
     WHERE deleted_at IS NULL AND pricing_overrides_program = TRUE`,
  )
  for (const row of forms.rows) {
    try {
      await syncClassOverrideCatalog(pool, Number(row.id))
      summary.forms += 1
    } catch (err) {
      summary.errors.push({ type: 'form', id: row.id, message: err.message })
      console.error('[stripeCatalogSync] form', row.id, err)
    }
  }

  return { status: 'ok', summary }
}

/** Fire-and-forget helper for admin save hooks. */
export function scheduleStripeCatalogSync(label, fn) {
  if (!stripeEnabled()) return
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.error(`[stripeCatalogSync] ${label}:`, err?.message ?? err)
    })
}

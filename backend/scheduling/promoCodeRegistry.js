const TYPE_PREFIX = {
  promo_code: '',
  school: 'SCH',
  city: 'CTY',
  multi_class: 'MCLS',
  multi_child: 'MCHD',
  free_classes: 'FCLS',
}

const FREE_PASS_PREFIX = 'FP'

export function normalizePromoCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
}

function slugFromName(name, maxLen = 10) {
  const slug = String(name ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, maxLen)
  return slug || 'PROMO'
}

export function generateUniquePromoCode({ prefix = '', name = 'PROMO', occupied = new Set() }) {
  const base = slugFromName(name)
  const pfx = prefix ? `${prefix}-` : ''
  const candidates = [
    normalizePromoCode(`${pfx}${base}`),
    ...Array.from({ length: 99 }, (_, i) => normalizePromoCode(`${pfx}${base}${i + 2}`)),
    normalizePromoCode(`${pfx}${base}${Date.now().toString(36).toUpperCase().slice(-5)}`),
  ]
  for (const candidate of candidates) {
    if (candidate && !occupied.has(candidate)) return candidate
  }
  return normalizePromoCode(`${pfx}X${Date.now().toString(36).toUpperCase()}`)
}

function parseJsonField(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function promoCodeFromDiscountRow(row) {
  const config = parseJsonField(row.config)
  if (row.type === 'promo_code') {
    return normalizePromoCode(config.code || config.promo_code)
  }
  return normalizePromoCode(config.promo_code || config.code)
}

export function promoCodeFromFreePassIssuance(issuance) {
  const data = parseJsonField(issuance)
  return normalizePromoCode(data.promo_code)
}

export async function loadOccupiedPromoCodes(
  pool,
  facilityId,
  { excludeDiscountId = null, excludePassId = null } = {},
) {
  const codes = new Set()
  const rulesRes = await pool.query(
    `SELECT id, type, config FROM discount_rule
     WHERE facility_id = $1 OR facility_id IS NULL`,
    [facilityId],
  )
  for (const row of rulesRes.rows) {
    if (excludeDiscountId != null && Number(row.id) === Number(excludeDiscountId)) continue
    const code = promoCodeFromDiscountRow(row)
    if (code) codes.add(code)
  }

  const passesRes = await pool.query(
    `SELECT id, issuance FROM free_pass_template
     WHERE ($1::bigint IS NULL OR facility_id = $1)`,
    [facilityId],
  )
  for (const row of passesRes.rows) {
    if (excludePassId != null && Number(row.id) === Number(excludePassId)) continue
    const code = promoCodeFromFreePassIssuance(row.issuance)
    if (code) codes.add(code)
  }

  return codes
}

export function ensureDiscountRulePromoCode(value, occupiedCodes) {
  const config = { ...(value.config || {}) }
  const type = value.type || 'promo_code'
  let code = ''
  let wasManual = false

  if (type === 'promo_code') {
    code = normalizePromoCode(config.code || config.promo_code)
    wasManual = Boolean(config.code || config.promo_code) && config.promo_code_auto_generated !== true
  } else {
    code = normalizePromoCode(config.promo_code)
    wasManual = Boolean(config.promo_code) && config.promo_code_auto_generated !== true
  }

  if (!code) {
    code = generateUniquePromoCode({
      prefix: TYPE_PREFIX[type] ?? 'DSC',
      name: value.name,
      occupied: occupiedCodes,
    })
    config.promo_code_auto_generated = true
  } else if (occupiedCodes.has(code)) {
    code = generateUniquePromoCode({
      prefix: TYPE_PREFIX[type] ?? 'DSC',
      name: value.name,
      occupied: occupiedCodes,
    })
    config.promo_code_auto_generated = true
  } else {
    config.promo_code_auto_generated = wasManual ? false : config.promo_code_auto_generated === true
  }

  config.promo_code = code
  if (type === 'promo_code') config.code = code

  occupiedCodes.add(code)
  return { ...value, config }
}

export function ensureFreePassPromoCode(value, occupiedCodes) {
  const issuance = { ...(value.issuance || {}) }
  let code = normalizePromoCode(issuance.promo_code)
  const wasManual = Boolean(issuance.promo_code) && issuance.promo_code_auto_generated !== true

  if (!code) {
    code = generateUniquePromoCode({
      prefix: FREE_PASS_PREFIX,
      name: value.name,
      occupied: occupiedCodes,
    })
    issuance.promo_code_auto_generated = true
  } else if (occupiedCodes.has(code)) {
    code = generateUniquePromoCode({
      prefix: FREE_PASS_PREFIX,
      name: value.name,
      occupied: occupiedCodes,
    })
    issuance.promo_code_auto_generated = true
  } else {
    issuance.promo_code_auto_generated = wasManual
      ? false
      : issuance.promo_code_auto_generated === true
  }

  issuance.promo_code = code
  occupiedCodes.add(code)
  return { ...value, issuance }
}

export async function backfillMissingPromoCodes(pool, facilityId) {
  const occupied = await loadOccupiedPromoCodes(pool, facilityId)

  const rulesRes = await pool.query(
    `SELECT id, name, type, config FROM discount_rule
     WHERE facility_id = $1 OR facility_id IS NULL
     ORDER BY id ASC`,
    [facilityId],
  )

  for (const row of rulesRes.rows) {
    const config = parseJsonField(row.config)
    const hasCode =
      row.type === 'promo_code'
        ? normalizePromoCode(config.code || config.promo_code)
        : normalizePromoCode(config.promo_code)
    if (hasCode) continue

    const next = ensureDiscountRulePromoCode(
      { name: row.name, type: row.type, config },
      occupied,
    )
    await pool.query(`UPDATE discount_rule SET config = $2::jsonb, updated_at = now() WHERE id = $1`, [
      row.id,
      next.config,
    ])
  }

  const passesRes = await pool.query(
    `SELECT id, name, issuance FROM free_pass_template
     WHERE ($1::bigint IS NULL OR facility_id = $1)
     ORDER BY id ASC`,
    [facilityId],
  )

  for (const row of passesRes.rows) {
    const issuance = parseJsonField(row.issuance)
    if (normalizePromoCode(issuance.promo_code)) continue

    const next = ensureFreePassPromoCode({ name: row.name, issuance }, occupied)
    await pool.query(
      `UPDATE free_pass_template SET issuance = $2::jsonb, updated_at = now() WHERE id = $1`,
      [row.id, JSON.stringify(next.issuance)],
    )
  }
}

function describeDiscountSubtype(type) {
  const labels = {
    promo_code: 'Promo code',
    school: 'School discount',
    city: 'City discount',
    multi_class: 'Multi-class',
    multi_child: 'Multi-child',
    free_classes: 'Free classes',
  }
  return labels[type] ?? type
}

export async function buildPromoCodeRegistry(pool, facilityId) {
  const entries = []

  const rulesRes = await pool.query(
    `SELECT id, name, type, active, starts_at, ends_at, max_redemptions, redeemed_count, config
     FROM discount_rule
     WHERE facility_id = $1 OR facility_id IS NULL
     ORDER BY name ASC`,
    [facilityId],
  )

  for (const row of rulesRes.rows) {
    const config = parseJsonField(row.config)
    const code = promoCodeFromDiscountRow(row)
    if (!code) continue
    entries.push({
      code,
      sourceType: 'discount',
      sourceId: Number(row.id),
      sourceName: row.name,
      ruleType: row.type,
      subtypeLabel: describeDiscountSubtype(row.type),
      active: row.active !== false,
      autoGenerated: config.promo_code_auto_generated === true,
      redeemedCount: Number(row.redeemed_count ?? 0),
      maxRedemptions: row.max_redemptions != null ? Number(row.max_redemptions) : null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
    })
  }

  const passesRes = await pool.query(
    `SELECT id, name, active, starts_at, ends_at, max_redemptions, redeemed_count,
            benefit_unit, issuance
     FROM free_pass_template
     WHERE ($1::bigint IS NULL OR facility_id = $1)
     ORDER BY name ASC`,
    [facilityId],
  )

  for (const row of passesRes.rows) {
    const issuance = parseJsonField(row.issuance)
    const code = promoCodeFromFreePassIssuance(issuance)
    if (!code) continue
    entries.push({
      code,
      sourceType: 'free_pass',
      sourceId: Number(row.id),
      sourceName: row.name,
      benefitUnit: row.benefit_unit ?? null,
      subtypeLabel: 'Free pass',
      active: row.active !== false,
      autoGenerated: issuance.promo_code_auto_generated === true,
      redeemedCount: Number(row.redeemed_count ?? 0),
      maxRedemptions: row.max_redemptions != null ? Number(row.max_redemptions) : null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
    })
  }

  return entries.sort((a, b) => a.code.localeCompare(b.code))
}

export const MULTI_CLASS_SYSTEM_KEY = 'multi_class'
/** @deprecated migrated to multi_class */
export const LEGACY_MULTI_FAMILY_SYSTEM_KEY = 'multi_family'

export const MULTI_CLASS_DISCOUNT_TARGETS = ['lowest', 'highest', 'total']

export const DEFAULT_MULTI_CLASS_TIERS = [
  {
    threshold: 2,
    amountType: 'percent',
    amountValue: 1000,
    minMonthlyCents: 19900,
    minPaidEnrollments: 2,
  },
  {
    threshold: 3,
    amountType: 'percent',
    amountValue: 1500,
    minMonthlyCents: 29900,
    minPaidEnrollments: 3,
  },
  {
    threshold: 4,
    amountType: 'percent',
    amountValue: 2000,
    minMonthlyCents: 49900,
    minPaidEnrollments: 4,
  },
  {
    threshold: 5,
    amountType: 'percent',
    amountValue: 2500,
    minMonthlyCents: 59900,
    minPaidEnrollments: 5,
  },
]

export function mapTierRow(t) {
  return {
    threshold: Number(t.threshold),
    amountType: t.amount_type,
    amountValue: Number(t.amount_value),
    minMonthlyCents: t.min_monthly_cents != null ? Number(t.min_monthly_cents) : null,
    minPaidEnrollments: t.min_paid_enrollments != null ? Number(t.min_paid_enrollments) : null,
    minPerClassCents: t.min_per_class_cents != null ? Number(t.min_per_class_cents) : null,
    maxDiscountCents: t.max_discount_cents != null ? Number(t.max_discount_cents) : null,
  }
}

export function isMultiClassSystemRule(rule) {
  return (
    rule?.type === 'multi_class' &&
    (rule?.config?.system_key === MULTI_CLASS_SYSTEM_KEY ||
      rule?.config?.system_key === LEGACY_MULTI_FAMILY_SYSTEM_KEY)
  )
}

/** @deprecated use isMultiClassSystemRule */
export function isMultiFamilySystemRule(rule) {
  return isMultiClassSystemRule(rule)
}

export function multiClassDiscountTarget(rule) {
  const target = String(rule?.config?.discount_target ?? 'lowest').toLowerCase()
  return MULTI_CLASS_DISCOUNT_TARGETS.includes(target) ? target : 'lowest'
}

export function multiClassMinPayingClasses(rule) {
  const fromClasses = Number(rule?.config?.min_paying_classes)
  if (Number.isFinite(fromClasses) && fromClasses >= 2) return Math.floor(fromClasses)
  const legacyMembers = Number(rule?.config?.min_paying_members)
  if (Number.isFinite(legacyMembers) && legacyMembers >= 2) return Math.floor(legacyMembers)
  return 2
}

export function multiClassMinPerClassCents(rule) {
  const n = Number(rule?.config?.min_per_class_cents)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function multiClassTierMatchExact(rule) {
  return rule?.config?.tier_match_mode === 'exact'
}

function defaultMultiClassConfig() {
  return {
    system_key: MULTI_CLASS_SYSTEM_KEY,
    promo_code: 'MULTICLASS',
    promo_code_auto_generated: false,
    min_paying_classes: 2,
    discount_target: 'lowest',
    require_paying_enrollment: true,
    tier_match_mode: 'best_eligible',
    min_per_class_cents: null,
    scope_mode: 'household',
  }
}

async function insertTier(client, ruleId, tier) {
  await client.query(
    `INSERT INTO discount_rule_tier
       (rule_id, threshold, amount_type, amount_value,
        min_monthly_cents, min_paid_enrollments, min_per_class_cents, max_discount_cents)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      ruleId,
      tier.threshold,
      tier.amountType,
      tier.amountValue,
      tier.minMonthlyCents ?? null,
      tier.minPaidEnrollments ?? null,
      tier.minPerClassCents ?? null,
      tier.maxDiscountCents ?? null,
    ],
  )
}

async function migrateLegacyMultiFamilyRule(pool, facilityId) {
  const legacy = await pool.query(
    `SELECT id FROM discount_rule
     WHERE (facility_id = $1 OR facility_id IS NULL)
       AND type = 'multi_child'
       AND config->>'system_key' = $2
     LIMIT 1`,
    [facilityId, LEGACY_MULTI_FAMILY_SYSTEM_KEY],
  )
  if (legacy.rows.length === 0) return null

  const ruleId = Number(legacy.rows[0].id)
  await pool.query(
    `UPDATE discount_rule SET
       type = 'multi_class',
       name = 'Multi-class discount',
       description = 'Discount when multiple paid classes are on one account. One student with multiple classes qualifies the same as multiple family members with one class each.',
       exclusivity_group = 'multi_class',
       config = (config - 'system_key' - 'min_paying_members')
         || jsonb_build_object(
           'system_key', $2::text,
           'min_paying_classes', COALESCE((config->>'min_paying_members')::int, 2),
           'promo_code', COALESCE(NULLIF(config->>'promo_code', ''), 'MULTICLASS')
         ),
       updated_at = now()
     WHERE id = $1`,
    [ruleId, MULTI_CLASS_SYSTEM_KEY],
  )
  await backfillMultiClassTierDefaults(pool, ruleId)
  return ruleId
}

export async function ensureMultiClassDiscountRule(pool, facilityId) {
  const existing = await pool.query(
    `SELECT id FROM discount_rule
     WHERE (facility_id = $1 OR facility_id IS NULL)
       AND type = 'multi_class'
       AND config->>'system_key' = $2
     LIMIT 1`,
    [facilityId, MULTI_CLASS_SYSTEM_KEY],
  )
  if (existing.rows.length > 0) {
    const ruleId = Number(existing.rows[0].id)
    await backfillMultiClassTierDefaults(pool, ruleId)
    return ruleId
  }

  const migrated = await migrateLegacyMultiFamilyRule(pool, facilityId)
  if (migrated != null) return migrated

  const insert = await pool.query(
    `INSERT INTO discount_rule
       (facility_id, name, description, type, amount_type, amount_value, apply_to, calc_base,
        priority, stackable, exclusivity_group, max_discount_cents, scope_level, scope_ref_id,
        active, starts_at, ends_at, max_redemptions, config)
     VALUES ($1,$2,$3,'multi_class','percent',0,'per_class','pre',
             50,TRUE,'multi_class',NULL,'global',NULL,TRUE,NULL,NULL,NULL,$4::jsonb)
     RETURNING id`,
    [
      facilityId,
      'Multi-class discount',
      'Discount when multiple paid classes are on one account. One student with multiple classes qualifies the same as multiple family members with one class each.',
      defaultMultiClassConfig(),
    ],
  )
  const ruleId = Number(insert.rows[0].id)
  for (const tier of DEFAULT_MULTI_CLASS_TIERS) {
    await insertTier(pool, ruleId, tier)
  }
  return ruleId
}

/** @deprecated */
export const ensureMultiFamilyDiscountRule = ensureMultiClassDiscountRule

export async function backfillMultiClassTierDefaults(pool, ruleId) {
  const tiersRes = await pool.query(
    `SELECT id, threshold, min_monthly_cents, min_paid_enrollments
     FROM discount_rule_tier WHERE rule_id = $1 ORDER BY threshold ASC`,
    [ruleId],
  )
  if (tiersRes.rows.length === 0) {
    for (const tier of DEFAULT_MULTI_CLASS_TIERS) {
      await insertTier(pool, ruleId, tier)
    }
    return
  }
  const defaultsByThreshold = new Map(DEFAULT_MULTI_CLASS_TIERS.map((t) => [t.threshold, t]))
  for (const row of tiersRes.rows) {
    const def = defaultsByThreshold.get(Number(row.threshold))
    if (!def) continue
    if (row.min_monthly_cents != null && row.min_paid_enrollments != null) continue
    await pool.query(
      `UPDATE discount_rule_tier SET
         min_monthly_cents = COALESCE(min_monthly_cents, $2),
         min_paid_enrollments = COALESCE(min_paid_enrollments, $3)
       WHERE id = $1`,
      [row.id, def.minMonthlyCents, def.minPaidEnrollments],
    )
  }
}

/** @deprecated */
export const backfillMultiFamilyTierDefaults = backfillMultiClassTierDefaults

function monthlyCentsFromBreakdown(breakdown) {
  if (!breakdown) return null
  const b = typeof breakdown === 'string' ? JSON.parse(breakdown) : breakdown
  const line = b?.line
  if (line?.baseCents != null) return Math.max(0, Number(line.baseCents))
  if (line?.finalCents != null) return Math.max(0, Number(line.finalCents))
  return null
}

function mapSignupRowToLine(row, { familyId = null } = {}) {
  const breakdown =
    typeof row.pricing_breakdown === 'string'
      ? JSON.parse(row.pricing_breakdown)
      : row.pricing_breakdown
  const listCents = monthlyCentsFromBreakdown(breakdown)
  if (listCents == null || listCents <= 0) return null
  const finalCents =
    breakdown?.line?.finalCents != null
      ? Math.max(0, Number(breakdown.line.finalCents))
      : listCents
  if (finalCents <= 0) return null
  return {
    key: `account-db-${row.id}`,
    signupId: Number(row.id),
    formId: Number(row.form_id),
    programId: row.programs_id != null ? Number(row.programs_id) : null,
    sportId: null,
    offeringId: null,
    memberId: Number(row.member_id),
    familyId: familyId != null ? Number(familyId) : row.family_id != null ? Number(row.family_id) : null,
    baseCents: listCents,
    listCents,
    finalCents,
    includeInSubtotal: false,
    shadowOnly: true,
  }
}

export async function loadFamilyDbPaidLines(pool, familyId) {
  if (!familyId) return []
  const res = await pool.query(
    `SELECT s.id, s.member_id, s.form_id, s.pricing_breakdown, sf.programs_id, m.family_id
     FROM scheduling_signup s
     JOIN member m ON m.id = s.member_id
     JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
     WHERE m.family_id = $1
       AND s.status = 'confirmed'
       AND s.orphaned_at IS NULL`,
    [familyId],
  )
  const lines = []
  for (const row of res.rows) {
    const line = mapSignupRowToLine(row, { familyId })
    if (line) lines.push(line)
  }
  return lines
}

export async function loadMemberDbPaidLines(pool, memberId) {
  if (!memberId) return []
  const res = await pool.query(
    `SELECT s.id, s.member_id, s.form_id, s.pricing_breakdown, sf.programs_id, m.family_id
     FROM scheduling_signup s
     JOIN member m ON m.id = s.member_id
     JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
     WHERE s.member_id = $1
       AND s.status = 'confirmed'
       AND s.orphaned_at IS NULL`,
    [memberId],
  )
  const lines = []
  for (const row of res.rows) {
    const line = mapSignupRowToLine(row)
    if (line) lines.push(line)
  }
  return lines
}

export async function loadFamilyShadowLines(pool, familyId) {
  return loadFamilyDbPaidLines(pool, familyId)
}

export function computeAccountStats(allLines, { minPerClassCents = 0 } = {}) {
  const perClassMin = Math.max(0, Number(minPerClassCents) || 0)
  const paidLines = allLines.filter(
    (line) =>
      (line.listCents ?? line.baseCents ?? 0) > 0 &&
      (line.finalCents ?? line.baseCents ?? 0) > 0,
  )
  const qualifyingLines =
    perClassMin > 0
      ? paidLines.filter((line) => (line.listCents ?? line.baseCents ?? 0) >= perClassMin)
      : paidLines

  const payingMembers = new Set(
    qualifyingLines.map((line) => line.memberId).filter((id) => id != null),
  )

  return {
    payingMemberCount: payingMembers.size,
    paidClassCount: qualifyingLines.length,
    accountMonthlyCents: qualifyingLines.reduce(
      (sum, line) => sum + (line.listCents ?? line.baseCents ?? 0),
      0,
    ),
    allLines: qualifyingLines,
  }
}

export async function computeAccountDiscountStats(
  pool,
  { familyId = null, memberId = null },
  cartLines = [],
  options = {},
) {
  const empty = {
    payingMemberCount: 0,
    paidClassCount: 0,
    accountMonthlyCents: 0,
    dbLines: [],
    allLines: [],
    familyId: familyId != null ? Number(familyId) : null,
    memberId: memberId != null ? Number(memberId) : null,
  }
  if (!familyId && !memberId) return empty

  let dbLines = []
  if (familyId) {
    dbLines = await loadFamilyDbPaidLines(pool, familyId)
  } else {
    dbLines = await loadMemberDbPaidLines(pool, memberId)
  }

  const cartFiltered = cartLines.filter((line) => {
    if ((line.baseCents || 0) <= 0) return false
    if (familyId) {
      return line.familyId != null && Number(line.familyId) === Number(familyId)
    }
    return line.memberId != null && Number(line.memberId) === Number(memberId)
  })

  const cartWithList = cartFiltered.map((line) => ({
    ...line,
    listCents: line.listCents ?? line.baseCents ?? 0,
    finalCents: line.finalCents ?? line.baseCents ?? 0,
    shadowOnly: false,
    includeInSubtotal: line.includeInSubtotal !== false,
  }))

  const allLines = [...dbLines, ...cartWithList]
  const stats = computeAccountStats(allLines, options)
  return {
    ...stats,
    familyId: familyId != null ? Number(familyId) : null,
    memberId: memberId != null ? Number(memberId) : null,
    dbLines,
    allLines: stats.allLines,
    // Legacy aliases for engine
    familyMonthlyCents: stats.accountMonthlyCents,
    familyPaidClassCount: stats.paidClassCount,
    familyPayingCount: stats.paidClassCount,
    familyAllLines: stats.allLines,
  }
}

/** @deprecated */
export async function computeFamilyDiscountStats(pool, familyId, cartLines = [], options = {}) {
  return computeAccountDiscountStats(pool, { familyId }, cartLines, options)
}

export async function countPayingFamilyMembers(pool, familyId, lines = []) {
  const stats = computeAccountStats(lines)
  if (stats.paidClassCount > 0) return stats.payingMemberCount
  if (!familyId) return 0
  const dbLines = await loadFamilyDbPaidLines(pool, familyId)
  return computeAccountStats(dbLines).payingMemberCount
}

/**
 * Pick the best eligible tier by paid class count (household-wide).
 * Tier threshold = number of paid classes required for that benefit level.
 */
export function pickMultiClassTier(rule, stats) {
  const classCount = stats.paidClassCount ?? stats.familyPaidClassCount ?? 0
  const exact = multiClassTierMatchExact(rule)
  const ruleMinPerClass = multiClassMinPerClassCents(rule)

  const tiers = [...(rule.tiers || [])].sort((a, b) => Number(b.threshold) - Number(a.threshold))
  for (const tier of tiers) {
    if (Number(tier.threshold) > classCount) continue
    if (exact && Number(tier.threshold) !== classCount) continue

    const minMonthly = tier.minMonthlyCents ?? 0
    const minClasses = tier.minPaidEnrollments ?? Number(tier.threshold)
    const tierPerClass = tier.minPerClassCents ?? ruleMinPerClass ?? 0

    if ((stats.accountMonthlyCents ?? stats.familyMonthlyCents ?? 0) < minMonthly) continue
    if (classCount < minClasses) continue

    if (tierPerClass > 0) {
      const paidLines = stats.allLines || stats.familyAllLines || []
      const allMeet = paidLines.every((line) => (line.listCents ?? line.baseCents ?? 0) >= tierPerClass)
      if (!allMeet) continue
    }

    return tier
  }
  return null
}

/** @deprecated */
export const pickMultiFamilyTier = pickMultiClassTier

// ---------- Monthly spend volume (system) ----------

export const MONTHLY_SPEND_SYSTEM_KEY = 'monthly_spend'

/** threshold on tiers = minimum monthly account spend in cents */
export const DEFAULT_MONTHLY_SPEND_TIERS = [
  { threshold: 19900, amountType: 'percent', amountValue: 500 },
  { threshold: 29900, amountType: 'percent', amountValue: 1000 },
  { threshold: 49900, amountType: 'percent', amountValue: 1500 },
  { threshold: 59900, amountType: 'percent', amountValue: 2000 },
]

export function isMonthlySpendSystemRule(rule) {
  if (rule?.type !== 'spend_volume') return false
  if (rule?.config?.system_key === MONTHLY_SPEND_SYSTEM_KEY) return true
  return rule?.exclusivity_group === 'monthly_spend' || rule?.exclusivityGroup === 'monthly_spend'
}

export function isAccountSystemRule(rule) {
  return isMultiClassSystemRule(rule) || isMonthlySpendSystemRule(rule)
}

export function systemRuleSortRank(rule) {
  if (isMultiClassSystemRule(rule)) return 0
  if (isMonthlySpendSystemRule(rule)) return 1
  return 2
}

export function monthlySpendDiscountTarget(rule) {
  const target = String(rule?.config?.discount_target ?? 'total').toLowerCase()
  return MULTI_CLASS_DISCOUNT_TARGETS.includes(target) ? target : 'total'
}

export function monthlySpendMinPaidClasses(rule) {
  const n = Number(rule?.config?.min_paying_classes)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  // Household monthly-spend discounts require multiple paid classes unless explicitly configured.
  if (isMonthlySpendSystemRule(rule)) return 2
  return 0
}

export function monthlySpendMinPerClassCents(rule) {
  const n = Number(rule?.config?.min_per_class_cents)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function monthlySpendMinMonthlyCents(rule) {
  const n = Number(rule?.config?.min_monthly_spend_cents)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function defaultMonthlySpendConfig() {
  return {
    system_key: MONTHLY_SPEND_SYSTEM_KEY,
    promo_code: 'SPENDSAVE',
    promo_code_auto_generated: false,
    discount_target: 'total',
    require_paying_enrollment: true,
    min_paying_classes: 2,
    min_per_class_cents: null,
  }
}

export async function ensureMonthlySpendDiscountRule(pool, facilityId) {
  const existing = await pool.query(
    `SELECT id FROM discount_rule
     WHERE (facility_id = $1 OR facility_id IS NULL)
       AND type = 'spend_volume'
       AND config->>'system_key' = $2
     LIMIT 1`,
    [facilityId, MONTHLY_SPEND_SYSTEM_KEY],
  )
  if (existing.rows.length > 0) return Number(existing.rows[0].id)

  const orphan = await pool.query(
    `SELECT id FROM discount_rule
     WHERE (facility_id = $1 OR facility_id IS NULL)
       AND type = 'spend_volume'
       AND (config->>'system_key' IS NULL OR config->>'system_key' = '')
       AND (
         exclusivity_group = 'monthly_spend'
         OR name ILIKE 'monthly spend%'
       )
     LIMIT 1`,
    [facilityId],
  )
  if (orphan.rows.length > 0) {
    const ruleId = Number(orphan.rows[0].id)
    await pool.query(
      `UPDATE discount_rule SET
         name = COALESCE(NULLIF(name, ''), 'Monthly spend discount'),
         exclusivity_group = COALESCE(exclusivity_group, 'monthly_spend'),
         config = config || $2::jsonb,
         updated_at = now()
       WHERE id = $1`,
      [ruleId, JSON.stringify(defaultMonthlySpendConfig())],
    )
    const tiersRes = await pool.query(
      'SELECT id FROM discount_rule_tier WHERE rule_id = $1 LIMIT 1',
      [ruleId],
    )
    if (tiersRes.rows.length === 0) {
      for (const tier of DEFAULT_MONTHLY_SPEND_TIERS) {
        await insertTier(pool, ruleId, tier)
      }
    }
    return ruleId
  }

  const insert = await pool.query(
    `INSERT INTO discount_rule
       (facility_id, name, description, type, amount_type, amount_value, apply_to, calc_base,
        priority, stackable, exclusivity_group, max_discount_cents, scope_level, scope_ref_id,
        active, starts_at, ends_at, max_redemptions, config)
     VALUES ($1,$2,$3,'spend_volume','percent',0,'per_class','pre',
             55,TRUE,'monthly_spend',NULL,'global',NULL,TRUE,NULL,NULL,NULL,$4::jsonb)
     RETURNING id`,
    [
      facilityId,
      'Monthly spend discount',
      'Percentage or fixed discount when total monthly enrollment spend reaches spend thresholds.',
      defaultMonthlySpendConfig(),
    ],
  )
  const ruleId = Number(insert.rows[0].id)
  for (const tier of DEFAULT_MONTHLY_SPEND_TIERS) {
    await insertTier(pool, ruleId, tier)
  }
  return ruleId
}

export async function ensureAllSystemDiscountRules(pool, facilityId) {
  if (process.env.NODE_ENV === 'production') return
  await ensureMultiClassDiscountRule(pool, facilityId)
  await ensureMonthlySpendDiscountRule(pool, facilityId)
}

export function pickMonthlySpendTier(rule, stats) {
  const spend = stats.accountMonthlyCents ?? stats.familyMonthlyCents ?? 0
  const classCount = stats.paidClassCount ?? stats.familyPaidClassCount ?? 0
  const ruleMinPerClass = monthlySpendMinPerClassCents(rule)
  // Legacy rule-level floors (migrated tiers use per-threshold fields instead).
  const legacyMinSpend = monthlySpendMinMonthlyCents(rule)
  const legacyMinClasses = monthlySpendMinPaidClasses(rule)

  const tiers = [...(rule.tiers || [])].sort((a, b) => Number(b.threshold) - Number(a.threshold))
  for (const tier of tiers) {
    const tierSpendGate = Number(tier.threshold)
    if (spend < tierSpendGate) continue

    if (legacyMinSpend > 0 && spend < legacyMinSpend) continue

    const minClasses =
      tier.minPaidEnrollments != null
        ? Number(tier.minPaidEnrollments)
        : legacyMinClasses > 0
          ? legacyMinClasses
          : 0
    if (minClasses > 0 && classCount < minClasses) continue

    const tierPerClass = tier.minPerClassCents ?? ruleMinPerClass ?? 0
    if (tierPerClass > 0) {
      const paidLines = stats.allLines || stats.familyAllLines || []
      const allMeet = paidLines.every((line) => (line.listCents ?? line.baseCents ?? 0) >= tierPerClass)
      if (!allMeet) continue
    }

    return tier
  }
  return null
}

export function accountStatsFromLine(line) {
  const paidClassCount = line.accountPaidClassCount ?? line.familyPaidClassCount ?? 0
  const accountMonthlyCents = line.accountMonthlyCents ?? line.familyMonthlyCents ?? 0
  return {
    familyId: line.familyId ?? null,
    memberId: line.memberId ?? null,
    paidClassCount,
    accountMonthlyCents,
    allLines: line.accountAllLines ?? line.familyAllLines ?? [],
    familyMonthlyCents: accountMonthlyCents,
    familyPaidClassCount: paidClassCount,
    familyAllLines: line.accountAllLines ?? line.familyAllLines ?? [],
  }
}

/** Infer account stats from cart lines when DB enrichment was not run (e.g. order simulator). */
export function attachCartAccountStats(lines, rules = []) {
  const multiClassRule = rules.find(isMultiClassSystemRule)
  const spendRule = rules.find(isMonthlySpendSystemRule)
  if (!multiClassRule && !spendRule) return lines

  const minPerClassCents = Math.max(
    multiClassRule ? multiClassMinPerClassCents(multiClassRule) : 0,
    spendRule ? monthlySpendMinPerClassCents(spendRule) : 0,
  )

  const groups = new Map()
  for (const line of lines) {
    if (line.accountPaidClassCount != null && line.accountMonthlyCents != null) continue
    const key =
      line.familyId != null
        ? `family:${Number(line.familyId)}`
        : line.memberId != null
          ? `member:${Number(line.memberId)}`
          : 'cart:default'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(line)
  }

  for (const groupLines of groups.values()) {
    const withList = groupLines.map((line) => ({
      ...line,
      listCents: line.listCents ?? line.baseCents ?? 0,
      finalCents: line.finalCents ?? line.baseCents ?? 0,
    }))
    const stats = computeAccountStats(withList, { minPerClassCents })
    for (const line of groupLines) {
      line.accountPaidClassCount = stats.paidClassCount
      line.accountMonthlyCents = stats.accountMonthlyCents
      line.accountAllLines = stats.allLines
      line.familyPaidClassCount = stats.paidClassCount
      line.familyMonthlyCents = stats.accountMonthlyCents
      line.familyAllLines = stats.allLines
    }
  }

  return lines
}

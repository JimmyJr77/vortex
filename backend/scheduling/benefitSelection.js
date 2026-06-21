/**
 * Cost-level benefit selections: wire discount rules and free passes at
 * sport / program / class from Pricing → Costs.
 */

export function mapBenefitSelectionRow(r) {
  return {
    id: Number(r.id),
    scopeLevel: r.scope_level,
    scopeRefId: Number(r.scope_ref_id),
    benefitType: r.benefit_type,
    benefitId: Number(r.benefit_id),
    autoApply: Boolean(r.auto_apply),
    allowMemberCode: Boolean(r.allow_member_code),
    sortOrder: Number(r.sort_order ?? 0),
  }
}

export async function loadBenefitSelectionsForScope(pool, scopeLevel, scopeRefId) {
  const res = await pool.query(
    `SELECT * FROM pricing_benefit_selection
     WHERE scope_level = $1 AND scope_ref_id = $2
     ORDER BY sort_order ASC, id ASC`,
    [scopeLevel, scopeRefId],
  )
  return res.rows.map(mapBenefitSelectionRow)
}

export async function saveBenefitSelectionsForScope(pool, scopeLevel, scopeRefId, selections = []) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `DELETE FROM pricing_benefit_selection WHERE scope_level = $1 AND scope_ref_id = $2`,
      [scopeLevel, scopeRefId],
    )
    for (let i = 0; i < selections.length; i += 1) {
      const s = selections[i]
      await client.query(
        `INSERT INTO pricing_benefit_selection
           (scope_level, scope_ref_id, benefit_type, benefit_id, auto_apply, allow_member_code, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          scopeLevel,
          scopeRefId,
          s.benefitType,
          s.benefitId,
          Boolean(s.autoApply),
          s.allowMemberCode !== false,
          s.sortOrder ?? i,
        ],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return loadBenefitSelectionsForScope(pool, scopeLevel, scopeRefId)
}

const SCOPE_PRIORITY = { class: 3, program: 2, sport: 1 }

/**
 * Collect selections from class → program → sport (most specific wins per benefit).
 */
export async function resolveBenefitSelectionsForLine(pool, { sportId, programId, formId }) {
  const scopeQueries = []
  if (formId != null) scopeQueries.push({ level: 'class', refId: Number(formId) })
  if (programId != null) scopeQueries.push({ level: 'program', refId: Number(programId) })
  if (sportId != null) scopeQueries.push({ level: 'sport', refId: Number(sportId) })

  if (scopeQueries.length === 0) {
    return emptyResolved()
  }

  const res = await pool.query(
    `
    SELECT * FROM pricing_benefit_selection
    WHERE (scope_level, scope_ref_id) IN (
      SELECT * FROM UNNEST($1::text[], $2::bigint[])
    )
    ORDER BY sort_order ASC, id ASC
    `,
    [scopeQueries.map((s) => s.level), scopeQueries.map((s) => s.refId)],
  )

  const rows = res.rows.map(mapBenefitSelectionRow)
  const usesCostSelections = rows.length > 0

  const byKey = new Map()
  for (const row of rows) {
    const key = `${row.benefitType}:${row.benefitId}`
    const existing = byKey.get(key)
    if (!existing || SCOPE_PRIORITY[row.scopeLevel] > SCOPE_PRIORITY[existing.scopeLevel]) {
      byKey.set(key, row)
    }
  }
  const merged = [...byKey.values()]

  const discountRuleIds = new Set()
  const freePassIds = new Set()
  const autoApplyDiscountRuleIds = new Set()
  const autoApplyFreePassIds = new Set()
  const allowedPromoCodes = new Set()
  const autoPromoCodes = new Set()

  for (const row of merged) {
    if (row.benefitType === 'discount_rule') {
      discountRuleIds.add(row.benefitId)
      if (row.autoApply) autoApplyDiscountRuleIds.add(row.benefitId)
    } else if (row.benefitType === 'free_pass') {
      freePassIds.add(row.benefitId)
      if (row.autoApply) autoApplyFreePassIds.add(row.benefitId)
    }
  }

  return {
    usesCostSelections,
    selections: merged,
    discountRuleIds,
    freePassIds,
    autoApplyDiscountRuleIds,
    autoApplyFreePassIds,
    allowedPromoCodes,
    autoPromoCodes,
    freePassAttachments: [...freePassIds].map((id) => ({
      passTemplateId: id,
      autoApply: autoApplyFreePassIds.has(id),
    })),
  }
}

function emptyResolved() {
  return {
    usesCostSelections: false,
    selections: [],
    discountRuleIds: new Set(),
    freePassIds: new Set(),
    autoApplyDiscountRuleIds: new Set(),
    autoApplyFreePassIds: new Set(),
    allowedPromoCodes: new Set(),
    autoPromoCodes: new Set(),
    freePassAttachments: [],
  }
}

/** Merge legacy program promo allowlist when no cost selections exist. */
export function mergeLegacyProgramPromos(resolved, programPromoCodes = []) {
  if (resolved.usesCostSelections) return resolved
  const codes = (programPromoCodes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)
  for (const code of codes) {
    resolved.allowedPromoCodes.add(code)
  }
  return resolved
}

/**
 * After loading discount rules, map promo codes for auto-apply and allow-member-code.
 */
export function enrichPromoCodesFromSelections(resolved, discountRules = []) {
  const ruleById = new Map(discountRules.map((r) => [Number(r.id), r]))
  for (const id of resolved.discountRuleIds) {
    const rule = ruleById.get(id)
    if (!rule || rule.type !== 'promo_code') continue
    const code = String(rule.config?.code ?? '').trim().toUpperCase()
    if (!code) continue
    const row = resolved.selections.find(
      (s) => s.benefitType === 'discount_rule' && s.benefitId === id,
    )
    if (row?.allowMemberCode) resolved.allowedPromoCodes.add(code)
    if (row?.autoApply) resolved.autoPromoCodes.add(code)
  }
  return resolved
}

/** One-time migration of legacy program promo codes into benefit selections. */
export async function migrateProgramPromoCodesToSelections(pool, programId, promoCodes = []) {
  const codes = (promoCodes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)
  if (!codes.length) return

  const existing = await loadBenefitSelectionsForScope(pool, 'program', programId)
  if (existing.length > 0) return

  const rulesRes = await pool.query(
    `SELECT id, config FROM discount_rule WHERE type = 'promo_code' AND active = TRUE`,
  )
  const selections = []
  for (const code of codes) {
    const rule = rulesRes.rows.find(
      (r) => String(r.config?.code ?? '').trim().toUpperCase() === code,
    )
    if (rule) {
      selections.push({
        benefitType: 'discount_rule',
        benefitId: Number(rule.id),
        autoApply: false,
        allowMemberCode: true,
        sortOrder: selections.length,
      })
    }
  }
  if (selections.length) {
    await saveBenefitSelectionsForScope(pool, 'program', programId, selections)
  }
}

import { randomUUID } from 'crypto'
import { resolveProgramsSchema } from './schema.js'

export function normalizeMultiClassPassPackages(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const classCount = Math.max(1, Math.round(Number(item.classCount) || 0))
    const priceCents = Math.max(0, Math.round(Number(item.priceCents) || 0))
    const id = String(item.id || randomUUID())
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim()
        : `${classCount}-Class Pass`
    out.push({
      id,
      classCount,
      priceCents,
      enabled: Boolean(item.enabled),
      label,
    })
  }
  return out
}

export function enabledMultiClassPassPackages(packages = []) {
  return packages.filter((p) => p.enabled && p.classCount > 0 && p.priceCents >= 0)
}

export async function loadProgramPassPackages(pool, programsId) {
  const schema = await resolveProgramsSchema(pool)
  const res = await pool.query(
    `SELECT COALESCE(multi_class_pass_packages, '[]'::jsonb) AS packages
     FROM ${schema.programsTable} WHERE id = $1`,
    [programsId],
  )
  if (res.rows.length === 0) return []
  return enabledMultiClassPassPackages(normalizeMultiClassPassPackages(res.rows[0].packages))
}

export async function loadMemberPassBalances(pool, memberId, programsId = null) {
  const params = [memberId]
  let programFilter = ''
  if (programsId != null) {
    params.push(programsId)
    programFilter = ` AND programs_id = $2`
  }
  const res = await pool.query(
    `SELECT id, member_id, programs_id, package_id, class_count_purchased,
            classes_remaining, price_cents, package_label, purchased_at
     FROM member_multi_class_pass
     WHERE member_id = $1 AND classes_remaining > 0${programFilter}
     ORDER BY purchased_at ASC`,
    params,
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    memberId: Number(row.member_id),
    programsId: Number(row.programs_id),
    packageId: row.package_id,
    classCountPurchased: Number(row.class_count_purchased),
    classesRemaining: Number(row.classes_remaining),
    priceCents: Number(row.price_cents),
    packageLabel: row.package_label,
    purchasedAt: row.purchased_at,
  }))
}

export async function totalRemainingClassesForProgram(pool, memberId, programsId) {
  const res = await pool.query(
    `SELECT COALESCE(SUM(classes_remaining), 0)::int AS total
     FROM member_multi_class_pass
     WHERE member_id = $1 AND programs_id = $2 AND classes_remaining > 0`,
    [memberId, programsId],
  )
  return Number(res.rows[0]?.total ?? 0)
}

/** FIFO: pick oldest pass with remaining balance for a program. */
export async function selectPassForRedemption(client, memberId, programsId) {
  const res = await client.query(
    `SELECT id, classes_remaining, package_label
     FROM member_multi_class_pass
     WHERE member_id = $1 AND programs_id = $2 AND classes_remaining > 0
     ORDER BY purchased_at ASC
     LIMIT 1
     FOR UPDATE`,
    [memberId, programsId],
  )
  return res.rows[0] ?? null
}

export async function redeemPassForSignup(client, { memberPassId, signupId, memberId, programsId }) {
  const passRes = await client.query(
    `UPDATE member_multi_class_pass
     SET classes_remaining = classes_remaining - 1,
         updated_at = now()
     WHERE id = $1 AND classes_remaining > 0
     RETURNING classes_remaining, package_label`,
    [memberPassId],
  )
  if (passRes.rows.length === 0) {
    throw new Error('Multi-class pass has no remaining credits')
  }
  const remaining = Number(passRes.rows[0].classes_remaining)
  const redemption = await client.query(
    `INSERT INTO multi_class_pass_redemption
       (member_pass_id, signup_id, member_id, programs_id, classes_used, classes_remaining_after)
     VALUES ($1, $2, $3, $4, 1, $5)
     RETURNING id`,
    [memberPassId, signupId, memberId, programsId, remaining],
  )
  return {
    redemptionId: Number(redemption.rows[0].id),
    classesRemainingAfter: remaining,
    packageLabel: passRes.rows[0].package_label,
  }
}

export async function createMemberPassPurchase(client, {
  memberId,
  programsId,
  packageDef,
  billingChargeId = null,
}) {
  const res = await client.query(
    `INSERT INTO member_multi_class_pass
       (member_id, programs_id, package_id, class_count_purchased, classes_remaining,
        price_cents, package_label, billing_charge_id)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
     RETURNING id, classes_remaining`,
    [
      memberId,
      programsId,
      packageDef.id,
      packageDef.classCount,
      packageDef.priceCents,
      packageDef.label,
      billingChargeId,
    ],
  )
  return {
    passId: Number(res.rows[0].id),
    classesRemaining: Number(res.rows[0].classes_remaining),
  }
}

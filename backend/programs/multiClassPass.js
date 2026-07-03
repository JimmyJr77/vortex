import { randomUUID } from 'crypto'
import { resolveProgramsSchema } from './schema.js'
import { runIsolated } from '../scheduling/transactionSavepoint.js'

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
       (member_pass_id, signup_id, member_id, programs_id, classes_used, classes_remaining_after, entry_type, credit_delta)
     VALUES ($1, $2, $3, $4, 1, $5, 'use', -1)
     RETURNING id`,
    [memberPassId, signupId, memberId, programsId, remaining],
  )
  return {
    redemptionId: Number(redemption.rows[0].id),
    classesRemainingAfter: remaining,
    packageLabel: passRes.rows[0].package_label,
  }
}

/**
 * Restore outstanding pass credits consumed by a signup (e.g. on cancellation).
 * Idempotent: only restores the net unrestored uses per pass, then writes a
 * matching `restore` ledger row so re-running is a no-op.
 * @returns {Promise<{ restored:number }>}
 */
export async function restorePassCreditsForSignup(client, { signupId, reason = 'Enrollment cancelled' }) {
  if (signupId == null) return { restored: 0 }
  const outstanding = await client.query(
    `SELECT member_pass_id, member_id, programs_id,
            COALESCE(SUM(credit_delta), 0)::int AS net
     FROM multi_class_pass_redemption
     WHERE signup_id = $1
     GROUP BY member_pass_id, member_id, programs_id
     HAVING COALESCE(SUM(credit_delta), 0) < 0`,
    [signupId],
  )

  let restored = 0
  for (const row of outstanding.rows) {
    const restoreCount = -Number(row.net)
    if (restoreCount <= 0) continue
    const passRes = await client.query(
      `UPDATE member_multi_class_pass
       SET classes_remaining = classes_remaining + $2,
           status = CASE WHEN status = 'expired' THEN 'active' ELSE status END,
           updated_at = now()
       WHERE id = $1
       RETURNING classes_remaining`,
      [row.member_pass_id, restoreCount],
    )
    const remainingAfter = Number(passRes.rows[0]?.classes_remaining ?? 0)
    await client.query(
      `INSERT INTO multi_class_pass_redemption
         (member_pass_id, signup_id, member_id, programs_id, classes_used, classes_remaining_after, entry_type, credit_delta, reason)
       VALUES ($1, $2, $3, $4, $5, $6, 'restore', $5, $7)`,
      [row.member_pass_id, signupId, row.member_id, row.programs_id, restoreCount, remainingAfter, reason],
    )
    restored += restoreCount
  }
  return { restored }
}

/** Best-effort — enrollment cancel/delete must succeed even when pass ledger columns are absent. */
export async function safeRestorePassCreditsForSignup(client, opts) {
  try {
    return await runIsolated(client, () => restorePassCreditsForSignup(client, opts))
  } catch (err) {
    console.warn('[multiClassPass] restorePassCreditsForSignup skipped:', err?.message ?? err)
    return { restored: 0 }
  }
}

/**
 * Expire passes past their expires_at date. Writes an `expire` ledger row for the
 * remaining balance and zeroes the pass. Idempotent (only touches active passes
 * with remaining > 0 that are past expiry).
 * @returns {Promise<{ expiredPasses:number, expiredCredits:number }>}
 */
export async function expirePassCredits(pool, { asOf = new Date() } = {}) {
  const asOfStr = asOf.toISOString().slice(0, 10)
  const due = await pool.query(
    `SELECT id, member_id, programs_id, classes_remaining
     FROM member_multi_class_pass
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at < $1
       AND classes_remaining > 0`,
    [asOfStr],
  )

  let expiredPasses = 0
  let expiredCredits = 0
  for (const pass of due.rows) {
    const remaining = Number(pass.classes_remaining)
    await pool.query(
      `UPDATE member_multi_class_pass
       SET classes_remaining = 0, status = 'expired', updated_at = now()
       WHERE id = $1`,
      [pass.id],
    )
    await pool.query(
      `INSERT INTO multi_class_pass_redemption
         (member_pass_id, signup_id, member_id, programs_id, classes_used, classes_remaining_after, entry_type, credit_delta, reason)
       VALUES ($1, NULL, $2, $3, $4, 0, 'expire', $5, 'Pass expired')`,
      [pass.id, pass.member_id, pass.programs_id, remaining, -remaining],
    )
    expiredPasses += 1
    expiredCredits += remaining
  }
  return { expiredPasses, expiredCredits }
}

/**
 * Load the full redemption/usage history for a member (or a single pass), including
 * use/restore/expire/refund/adjust entries. Powers admin + member bundle usage views.
 */
export async function loadPassUsageHistory(pool, { memberId = null, memberPassId = null, limit = 200 }) {
  const params = []
  const filters = []
  if (memberId != null) {
    params.push(memberId)
    filters.push(`r.member_id = $${params.length}`)
  }
  if (memberPassId != null) {
    params.push(memberPassId)
    filters.push(`r.member_pass_id = $${params.length}`)
  }
  params.push(limit)
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const res = await pool.query(
    `SELECT r.id, r.member_pass_id, r.signup_id, r.member_id, r.programs_id,
            r.classes_used, r.classes_remaining_after, r.entry_type, r.credit_delta,
            r.reason, r.created_at, p.package_label
     FROM multi_class_pass_redemption r
     LEFT JOIN member_multi_class_pass p ON p.id = r.member_pass_id
     ${where}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $${params.length}`,
    params,
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    memberPassId: Number(row.member_pass_id),
    signupId: row.signup_id != null ? Number(row.signup_id) : null,
    memberId: row.member_id != null ? Number(row.member_id) : null,
    programsId: Number(row.programs_id),
    entryType: row.entry_type || 'use',
    classesUsed: Number(row.classes_used),
    creditDelta: row.credit_delta != null ? Number(row.credit_delta) : null,
    classesRemainingAfter: Number(row.classes_remaining_after),
    reason: row.reason || null,
    packageLabel: row.package_label || null,
    createdAt: row.created_at,
  }))
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

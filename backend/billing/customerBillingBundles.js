import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'

function mapBundlePass(row) {
  return {
    id: Number(row.id),
    memberId: Number(row.member_id),
    memberName: row.member_name ?? null,
    programsId: Number(row.programs_id),
    packageId: row.package_id,
    packageLabel: row.package_label ?? null,
    classCountPurchased: Number(row.class_count_purchased ?? 0),
    classesRemaining: Number(row.classes_remaining ?? 0),
    priceCents: Number(row.price_cents ?? 0),
    status: row.status ?? 'active',
    expiresAt: row.expires_at ?? null,
    purchasedAt: row.purchased_at ?? null,
  }
}

function mapBundleUsage(row) {
  return {
    id: Number(row.id),
    memberPassId: Number(row.member_pass_id),
    signupId: row.signup_id == null ? null : Number(row.signup_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    memberName: row.member_name ?? null,
    programsId: Number(row.programs_id),
    entryType: row.entry_type || 'use',
    classesUsed: Number(row.classes_used ?? 0),
    creditDelta: row.credit_delta == null ? null : Number(row.credit_delta),
    classesRemainingAfter: Number(row.classes_remaining_after ?? 0),
    reason: row.reason || null,
    packageLabel: row.package_label || null,
    createdAt: row.created_at,
  }
}

function isOptionalBundleSchemaError(error) {
  return error?.code === '42P01' || error?.code === '42703'
}

/**
 * Read household class-pass balances and recent usage without hydrating the
 * legacy billing account view. The tables are optional on older installations,
 * so an installation still awaiting the pass migration reports an empty set.
 */
export async function loadCustomerBillingBundles(pool, { familyId, usageLimit = 100 }) {
  try {
    const passesResult = await pool.query(
      `SELECT pass.*, TRIM(CONCAT(member.first_name, ' ', member.last_name)) AS member_name
       FROM member_multi_class_pass pass
       JOIN member ON member.id = pass.member_id
       WHERE ${canonicalActiveHouseholdMemberPredicate({
         memberAlias: 'member',
         familyIdReference: '$1',
         membershipAlias: 'bundle_membership',
         historyAlias: 'bundle_membership_history',
       })}
       ORDER BY pass.purchased_at DESC, pass.id DESC`,
      [Number(familyId)],
    )
    const bundlePasses = passesResult.rows.map(mapBundlePass)
    if (bundlePasses.length === 0) return { bundlePasses, bundleUsage: [] }

    const memberIds = [...new Set(bundlePasses.map((pass) => pass.memberId))]
    const normalizedLimit = Math.min(100, Math.max(1, Number(usageLimit) || 100))
    const usageResult = await pool.query(
      `SELECT usage.id, usage.member_pass_id, usage.signup_id, usage.member_id,
              usage.programs_id, usage.classes_used, usage.classes_remaining_after,
              usage.entry_type, usage.credit_delta, usage.reason, usage.created_at,
              pass.package_label,
              TRIM(CONCAT(member.first_name, ' ', member.last_name)) AS member_name
       FROM multi_class_pass_redemption usage
       LEFT JOIN member_multi_class_pass pass ON pass.id = usage.member_pass_id
       LEFT JOIN member ON member.id = usage.member_id
       WHERE usage.member_id = ANY($1::bigint[])
       ORDER BY usage.created_at DESC, usage.id DESC
       LIMIT $2`,
      [memberIds, normalizedLimit],
    )
    return { bundlePasses, bundleUsage: usageResult.rows.map(mapBundleUsage) }
  } catch (error) {
    if (isOptionalBundleSchemaError(error)) return { bundlePasses: [], bundleUsage: [] }
    throw error
  }
}

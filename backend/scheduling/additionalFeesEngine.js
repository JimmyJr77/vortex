export const FEE_APPLY_BASES = [
  'per_order',
  'per_slot',
  'per_class',
  'per_offering',
  'per_month',
  'per_year',
]

export const FEE_TRIGGER_TYPES = ['each_enrollment', 'new_member', 'once_per_year']

function withinWindow(fee, now) {
  if (fee.startsAt && new Date(fee.startsAt).getTime() > now) return false
  if (fee.endsAt && new Date(fee.endsAt).getTime() < now) return false
  return true
}

function scopeMatchesFee(fee, line) {
  const level = fee.scopeLevel || 'global'
  if (level === 'global') return true
  switch (level) {
    case 'sport':
      return fee.scopeRefId != null && Number(fee.scopeRefId) === Number(line.sportId)
    case 'program':
      return fee.scopeRefId != null && Number(fee.scopeRefId) === Number(line.programId)
    case 'class':
      return fee.scopeRefId != null && Number(fee.scopeRefId) === Number(line.formId)
    case 'offering':
      return fee.scopeRefId != null && Number(fee.scopeRefId) === Number(line.offeringId)
    default:
      return true
  }
}

function calendarYearKey(now = new Date()) {
  return String(now.getFullYear())
}

/**
 * @param {{
 *   fees: object[],
 *   lines: Array<{ key, formId, programId, sportId, offeringId }>,
 *   isNewMember?: boolean,
 *   redeemedPeriodKeys?: Set<string>,
 *   now?: number,
 * }} input
 */
export function computeOrderAdditionalFees({
  fees = [],
  lines = [],
  isNewMember = false,
  redeemedPeriodKeys = new Set(),
  now = Date.now(),
}) {
  const activeFees = fees
    .filter((f) => f.active !== false && withinWindow(f, now))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))

  const items = []
  let totalOneTimeCents = 0
  let totalMonthlyCents = 0

  for (const fee of activeFees) {
    if (fee.triggerType === 'new_member' && !isNewMember) continue

    const periodKey = `${fee.id}:${calendarYearKey(new Date(now))}`
    if (fee.triggerType === 'once_per_year' && redeemedPeriodKeys.has(periodKey)) continue

    const matchingLines = lines.filter((line) => scopeMatchesFee(fee, line))
    if (matchingLines.length === 0 && fee.applyBasis !== 'per_order') continue
    if (fee.applyBasis === 'per_order' && fee.scopeLevel !== 'global' && matchingLines.length === 0) {
      continue
    }

    const amountCents = Math.max(0, Math.round(Number(fee.amountCents) || 0))
    const interval = Math.max(1, Number(fee.applyInterval) || 1)
    let quantity = 0
    let lineCents = 0
    let recurring = false

    switch (fee.applyBasis) {
      case 'per_order':
        quantity = 1
        lineCents = amountCents
        break
      case 'per_slot':
        quantity = matchingLines.length
        lineCents = amountCents * quantity
        break
      case 'per_class':
        quantity = new Set(matchingLines.map((l) => l.formId)).size
        lineCents = amountCents * quantity
        break
      case 'per_offering': {
        const offeringIds = new Set(
          matchingLines.map((l) => l.offeringId).filter((id) => id != null),
        )
        quantity = offeringIds.size
        lineCents = amountCents * quantity
        break
      }
      case 'per_month': {
        quantity = Math.max(1, matchingLines.length)
        lineCents = Math.round((amountCents / interval) * quantity)
        recurring = true
        break
      }
      case 'per_year':
        quantity = 1
        lineCents = amountCents
        break
      default:
        continue
    }

    if (lineCents <= 0) continue

    if (recurring) {
      totalMonthlyCents += lineCents
    } else {
      totalOneTimeCents += lineCents
    }

    items.push({
      feeId: fee.id,
      name: fee.name,
      applyBasis: fee.applyBasis,
      applyInterval: fee.applyInterval ?? 1,
      triggerType: fee.triggerType,
      quantity,
      amountCents: lineCents,
      recurring,
      scopeLevel: fee.scopeLevel,
    })
  }

  return {
    enabled: items.length > 0,
    items,
    totalOneTimeCents,
    totalMonthlyCents,
    totalCents: totalOneTimeCents,
  }
}

export async function loadActiveAdditionalFees(pool, facilityId) {
  const res = await pool.query(
    `SELECT * FROM additional_fee
     WHERE ($1::bigint IS NULL OR facility_id = $1 OR facility_id IS NULL)
       AND active = TRUE
     ORDER BY priority ASC, id ASC`,
    [facilityId],
  )
  return res.rows.map(mapFeeRow)
}

export function mapFeeRow(r) {
  return {
    id: Number(r.id),
    facilityId: r.facility_id != null ? Number(r.facility_id) : null,
    name: r.name,
    description: r.description ?? null,
    amountCents: Number(r.amount_cents ?? 0),
    applyBasis: r.apply_basis,
    applyInterval: Number(r.apply_interval ?? 1),
    triggerType: r.trigger_type,
    scopeLevel: r.scope_level,
    scopeRefId: r.scope_ref_id != null ? Number(r.scope_ref_id) : null,
    active: r.active !== false,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    priority: Number(r.priority ?? 100),
    config: r.config || {},
  }
}

export async function loadMemberFeeRedemptionKeys(pool, memberId, feeIds = []) {
  if (!memberId || feeIds.length === 0) return new Set()
  const res = await pool.query(
    `SELECT fee_id, period_key FROM additional_fee_redemption
     WHERE member_id = $1 AND fee_id = ANY($2::bigint[])`,
    [memberId, feeIds],
  )
  return new Set(res.rows.map((r) => `${Number(r.fee_id)}:${r.period_key}`))
}

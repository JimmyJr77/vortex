import { id, inputError } from './common.js'

export async function saveMarketingSpend(db, facilityId, userId, month, body = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900) throw inputError('Choose a valid month.')
  const { amountCents, version } = body
  if (amountCents !== null && (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 100000000000)) {
    throw inputError('Enter a nonnegative amount with at most two decimal places, or clear the amount.')
  }
  if (!Number.isSafeInteger(version) || version < 0) throw inputError('Refresh before saving this month.')
  const result = await db.query(`INSERT INTO enrollment_marketing_spend(facility_id,month,amount_cents,updated_by)
    SELECT $1,$2::date,$3,$4 WHERE $5=0 OR EXISTS (
      SELECT 1 FROM enrollment_marketing_spend WHERE facility_id=$1 AND month=$2::date AND version=$5)
    ON CONFLICT(facility_id,month) DO UPDATE SET amount_cents=EXCLUDED.amount_cents,
      updated_by=EXCLUDED.updated_by,updated_at=now(),version=enrollment_marketing_spend.version+1
    WHERE enrollment_marketing_spend.version=$5
    RETURNING to_char(month,'YYYY-MM') AS month,amount_cents AS "amountCents",version`,
  [id(facilityId, 'facility'), `${month}-01`, amountCents, id(userId, 'user'), version])
  if (!result.rows.length) throw inputError('This month changed since you opened it. Refresh and try again.', 409)
  return { ...result.rows[0], amountCents: result.rows[0].amountCents == null ? null : Number(result.rows[0].amountCents) }
}

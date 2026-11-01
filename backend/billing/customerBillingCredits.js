import { ensureCustomerBillingAccount } from './customerBillingQueries.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { recordBillingActivity } from './billingActivity.js'

export async function createCustomerBillingCredit(pool, {
  familyId, facilityId, actorUserId, amountCents, reason, requestKey,
}) {
  const amount = Number(amountCents)
  const actor = Number(actorUserId)
  const explanation = typeof reason === 'string' ? reason.trim() : ''
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) throw new Error('Enter a positive credit amount in whole cents.')
  if (!explanation || explanation.length > 2000) throw new Error('A reason between 1 and 2,000 characters is required.')
  if (!Number.isSafeInteger(actor) || actor <= 0) throw new Error('A logged-in staff account is required.')
  if (!requestKey || !/^[A-Za-z0-9_.:-]{8,160}$/.test(requestKey)) throw new Error('A valid credit request key is required.')
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    await db.query('BEGIN')
    try {
      await db.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(account.id)])
      const sourceId = `${account.id}:${requestKey}`
      const existing = (await db.query(`SELECT * FROM billing_charge
        WHERE source_type='manual_account_credit' AND source_id=$1`, [sourceId])).rows[0]
      if (existing) {
        if (Number(existing.amount_cents) !== -amount || existing.metadata?.reason !== explanation
          || Number(existing.created_by_user_id) !== actor) throw new Error('This request key was already used for different credit details.')
        await db.query('COMMIT')
        return { credit: existing, created: false }
      }
      // A remote invoice/checkout already owns its quoted amount. Never promise
      // to reduce that payment by silently changing only the local ledger.
      const reserved = (await db.query(`SELECT EXISTS (
        SELECT 1 FROM billing_monthly_invoice WHERE family_billing_account_id=$1
          AND status IN ('draft','open','failed','payment_method_required')
      ) OR EXISTS (
        SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=$1
          AND (status IN ('pending','processing','reconciliation_required')
            OR (status='reserved' AND expires_at>now()))
      ) OR EXISTS (
        SELECT 1 FROM stripe_pending_enrollment WHERE family_billing_account_id=$1
          AND (status='processing' OR (status='pending' AND expires_at>now()))
      ) AS reserved`, [account.id])).rows[0]?.reserved
      if (reserved) {
        const error = new Error('An invoice or payment is already pending. Resolve or cancel it before adding credit so the next payment uses the correct amount.')
        error.statusCode = 409
        throw error
      }
      const user = (await db.query('SELECT id,full_name FROM app_user WHERE id=$1', [actor])).rows[0]
      if (!user) throw new Error('The logged-in staff account was not found.')
      const credit = (await db.query(`INSERT INTO billing_charge
        (family_billing_account_id,source_type,source_id,description,amount_cents,
         gross_amount_cents,discount_amount_cents,charge_type,billing_interval,
         collection_status,created_by_user_id,metadata)
        VALUES ($1,'manual_account_credit',$2,$3,$4,$4,0,'credit','one_time','none',$5,$6::jsonb)
        RETURNING *`, [account.id, sourceId, `Account credit: ${explanation}`, -amount, actor,
        JSON.stringify({ reason: explanation, createdByName: user.full_name || `Staff #${actor}` })])).rows[0]
      await recordBillingActivity(db, { eventKey: `account-credit:${credit.id}`, accountId: account.id,
        chargeId: credit.id, eventType: 'account_credit_created',
        summary: `Account credit added: ${explanation}`, afterValue: { amountCents: amount, creditId: Number(credit.id) },
        details: { reason: explanation }, actorUserId: actor, actorType: 'admin' })
      await db.query('COMMIT')
      return { credit, created: true }
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
}

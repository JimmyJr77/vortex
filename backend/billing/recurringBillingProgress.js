import { randomUUID } from 'node:crypto'
import { retryBillingProgressWrite } from './billingDatabaseRecovery.js'
import { recordRecurringBillingExceptions } from './recurringBillingOutcome.js'

export async function createRecurringBillingProgress(pool, { asOf, collectPayments, runId = randomUUID() }) {
  // One atomic, replayable statement records the complete collection inventory
  // before preparation or any payment begins. A killed process leaves visible
  // pending/running rows instead of silently losing the remaining households.
  await retryBillingProgressWrite(() => pool.query(`WITH run AS (
    INSERT INTO billing_recurring_run(id,as_of,collect_payments)
    VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING id
  ) INSERT INTO billing_recurring_account_progress(run_id,family_billing_account_id,phase,status)
    SELECT run.id,account.id,'collection','pending' FROM run,family_billing_account account
    WHERE account.is_active=TRUE ON CONFLICT DO NOTHING`, [runId, asOf, collectPayments]))
  return {
    runId,
    async record({ accountId, phase = 'collection', status, attempt = 1, result = {} }) {
      const saved = await retryBillingProgressWrite(() => pool.query(`WITH heartbeat AS (
        UPDATE billing_recurring_run SET phase=$3,updated_at=now() WHERE id=$1 RETURNING id
      ) INSERT INTO billing_recurring_account_progress
        (run_id,family_billing_account_id,phase,status,attempt_count,result)
        SELECT id,$2,$3,$4,$5,$6::jsonb FROM heartbeat
        ON CONFLICT (run_id,family_billing_account_id,phase) DO UPDATE SET
          status=EXCLUDED.status,attempt_count=EXCLUDED.attempt_count,
          result=EXCLUDED.result,updated_at=now() RETURNING run_id`,
      [runId, accountId, phase, status, attempt, JSON.stringify(result ?? {})]))
      if (!saved.rows[0]) throw new Error('The recurring billing run is missing; account progress was not saved.')
      if (status === 'blocked') {
        await retryBillingProgressWrite(() => recordRecurringBillingExceptions(pool, {
          blockedAccounts: [{ accountId, ...result, phase, runId }],
        }))
      }
    },
    async finish(status, summary = {}, error = null) {
      const result = await retryBillingProgressWrite(() => pool.query(`UPDATE billing_recurring_run SET
        status=CASE WHEN $2 IN ('completed','completed_with_review_holds') AND EXISTS (
          SELECT 1 FROM billing_recurring_account_progress WHERE run_id=$1
            AND (status IN ('pending','running','retrying') OR ($2='completed' AND status='blocked'))
        ) THEN 'failed' ELSE $2 END,
        phase='finished',summary=$3::jsonb,error_message=$4,completed_at=now(),updated_at=now()
        WHERE id=$1 RETURNING status`, [runId, status, JSON.stringify(summary), error?.message ?? null]))
      if (!result.rows[0]) throw new Error('The recurring billing run is missing; completion was not saved.')
      return result.rows[0].status
    },
  }
}

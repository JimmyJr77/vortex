import { ensureRecurringEnrollmentMappings } from './recurringEnrollmentMappings.js'
import { facilityDate, nextBillingMonth } from './canonicalBillingMigrationState.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { reconcileUpcomingProvisionalChargesForAccount } from './canonicalRecurringChargePosting.js'

/** Prepare upcoming ledgers independently of historical collection checks.
 * Manual-collection households still need a bill. Legacy remote subscriptions
 * remain excluded so this cannot introduce a second collector/ledger owner. */
export async function prepareUpcomingBilling(db, { now = new Date() } = {}) {
  const accounts = await db.query(`SELECT account.id,facility.timezone FROM family_billing_account account
    JOIN family ON family.id=account.family_id JOIN facility ON facility.id=family.facility_id
    WHERE account.is_active=TRUE AND NOT EXISTS (
      SELECT 1 FROM billing_subscription subscription
      WHERE subscription.family_billing_account_id=account.id
        AND subscription.status='active' AND subscription.stripe_subscription_id IS NOT NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM billing_account_migration migration
      WHERE migration.family_billing_account_id=account.id
        AND migration.state NOT IN ('verified','rolled_back','failed_rolled_back','superseded')
        AND NOT EXISTS (SELECT 1 FROM billing_account_migration verified
          WHERE verified.family_billing_account_id=account.id AND verified.state='verified')
    ) ORDER BY account.id`)
  const results = []
  for (const account of accounts.rows) {
    try {
      results.push({accountId:Number(account.id),...await withBillingAccountCollectionLock(db,account.id,
        async (client) => {
          const today=facilityDate(now,account.timezone)
          const currentMonth=`${today.slice(0,7)}-01`
          await ensureRecurringEnrollmentMappings(client,{accountId:account.id,billingMonth:currentMonth})
          await ensureRecurringEnrollmentMappings(client,{accountId:account.id,billingMonth:nextBillingMonth(currentMonth)})
          return reconcileUpcomingProvisionalChargesForAccount(client,{accountId:account.id,now})
        })})
    } catch (error) {
      results.push({accountId:Number(account.id),status:'blocked',code:error.code,message:error.message})
    }
  }
  return results
}

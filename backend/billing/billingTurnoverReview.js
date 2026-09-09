import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { reconcileCanonicalRecurringChargesForMonth } from './canonicalRecurringChargePosting.js'
import { loadCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import { facilityDate, nextBillingMonth } from './canonicalBillingMigrationState.js'

/** Read-only completeness audit, independent of collection/migration ownership.
 * Include empty accounts: a confirmed signup without a subscription is exactly
 * the failure that a subscription-only inventory would miss. */
export async function reviewBillingTurnover(db, { now = new Date(), accountIds = null } = {}) {
  const accounts = await db.query(
    `SELECT account.id, account.family_id, account.is_active,
            account.household_monthly_billing_enabled,
            family.family_name, facility.timezone
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
      WHERE ($1::bigint[] IS NULL OR account.id = ANY($1::bigint[]))
      ORDER BY account.id`, [accountIds],
  )
  const rows = []
  for (const account of accounts.rows) {
    const row = { accountId: Number(account.id), familyId: Number(account.family_id),
      name: account.family_name, billingMonth: 'unknown', issues: [] }
    try {
      const today = facilityDate(now, account.timezone)
      const month = Number(today.slice(8, 10)) >= 5
        ? nextBillingMonth(`${today.slice(0, 7)}-01`) : `${today.slice(0, 7)}-01`
      row.billingMonth = month
      const pricing = await resolveFamilyEnrollmentPricing(db, { familyId: account.family_id,
        periodKey: month.slice(0, 7), ensureSchema: false, strictPricing: true })
      row.expectedCents = pricing.netCents
      row.expectedCount = pricing.lines.length
      row.expectedLines = pricing.lines.map((line) => ({ signupId: line.signupId,
        subscriptionId: line.subscriptionId, memberId: line.memberId, amountCents: line.netCents }))
      const actual = await db.query(
        `SELECT id, amount_cents, member_id, subscription_id FROM billing_charge
          WHERE family_billing_account_id = $1 AND charge_type = 'recurring'
            AND service_period_start = $2::date
            AND COALESCE(metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
          ORDER BY id`, [account.id, month],
      )
      row.postedCount = actual.rows.length
      row.postedCents = actual.rows.reduce((sum, charge) => sum + Number(charge.amount_cents), 0)
      row.postedChargeIds = actual.rows.map((charge) => Number(charge.id))
      try {
        const parity = await reconcileCanonicalRecurringChargesForMonth(db, {
          accountId: account.id, billingMonth: month, facilityTimeZone: account.timezone,
          now, allowEarlyPosting: true, apply: false,
        })
        row.issues.push(...parity.issues)
      } catch (error) {
        row.issues.push(...(error.details?.issues ?? [{ code: error.code ?? 'billing_review_failed', message: error.message }]))
      }
      if (pricing.lines.length && !account.household_monthly_billing_enabled) {
        row.issues.push({ code: 'collection_mode_requires_review', message: 'Recurring tuition exists without enabled household collection; verify manual collection intent.' })
      }
      const snapshot = await loadCanonicalFinancialSnapshot(db, { accountId: account.id,
        recurringBillingMonth: month.slice(0, 7), asOf: now })
      row.balanceCents = snapshot.balanceCents
      row.outstandingCents = snapshot.outstandingBalanceCents
      row.creditCents = snapshot.futureCreditsCents
      row.missingPostedCents = Math.max(0, row.expectedCents - row.postedCents)
    } catch (error) {
      row.issues.push({ code: 'billing_review_failed', message: error.message })
    }
    row.verified = row.issues.length === 0
    rows.push(row)
  }
  return { reviewedAt: now.toISOString(), accountCount: rows.length,
    issueAccountCount: rows.filter((row) => !row.verified).length,
    expectedCents: rows.reduce((n, row) => n + (row.expectedCents ?? 0), 0),
    postedCents: rows.reduce((n, row) => n + (row.postedCents ?? 0), 0), accounts: rows }
}

/** Persist actionable exceptions; never invoke a payment, refund or posting API. */
export async function recordBillingTurnoverReview(db, review) {
  for (const row of review.accounts) {
    const key = `billing-turnover:${row.accountId}:${row.billingMonth}`
    if (row.verified) {
      await db.query(`UPDATE stripe_billing_alert SET resolved_at = COALESCE(resolved_at, now()),
        action_status = 'resolved', resolution_note = 'Upcoming ledger and pricing verified.', updated_at = now()
        WHERE stripe_event_id = $1 AND action_status <> 'suspended'`, [key])
    } else {
      await db.query(`INSERT INTO stripe_billing_alert
        (stripe_event_id, family_billing_account_id, alert_type, severity, message, details)
        VALUES ($1, $2, 'billing_turnover_incomplete', 'critical', $3, $4::jsonb)
        ON CONFLICT (stripe_event_id) DO UPDATE SET message = EXCLUDED.message,
          details = EXCLUDED.details, resolved_at = NULL, action_status = 'open', updated_at = now()`,
      [key, row.accountId, `Billing turnover for ${row.billingMonth.slice(0, 7)} requires attention.`, JSON.stringify(row)])
    }
  }
}

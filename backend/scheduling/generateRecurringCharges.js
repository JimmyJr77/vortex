/**
 * Monthly recurring-charge generator (Billing Overhaul Phase 2b).
 *
 * For every `active` billing_subscription whose next_bill_date has arrived, post one
 * recurring `billing_charge` per due period and advance next_bill_date. Idempotent:
 * each posted charge uses source_type='billing_subscription',
 * source_id='<subscriptionId>:<YYYY-MM>' against uq_billing_charge_source, so running
 * the job twice for the same period creates no duplicates. Missed months are caught up
 * (bounded by maxCatchUpPerSub) so a lapsed scheduler still bills every period once.
 *
 * Run via `npm run billing:recurring` (see runRecurringCharges.js) from cron/scheduler.
 */

import {
  parseDbDate,
} from './billingSubscriptions.js'
import {
  applyPendingPauseCredits,
  applyScheduledPauses,
  syncFamilyEnrollmentDiscounts,
} from './pauseEnrollmentBilling.js'
import { processDueEnrollmentCancellations } from './memberEnrollmentCancel.js'
import { autoCompleteEndedEnrollments } from './adminEnrollmentsView.js'
import { allocateHouseholdPayments } from '../billing/paymentAllocation.js'
import { createHouseholdMonthlyInvoice } from '../billing/householdMonthlyInvoice.js'
import { facilityDate } from '../billing/canonicalBillingMigrationState.js'
import { withBillingAccountCollectionLock } from '../billing/billingAccountCollectionLock.js'
import { reconcileCanonicalRecurringChargesForMonth } from '../billing/canonicalRecurringChargePosting.js'
import { postHardenedLegacyRecurringChargesForMonth } from '../billing/hardenedLegacyRecurringChargePosting.js'
import { postDueAnnualMembershipRenewals } from '../billing/annualMembershipRenewalPosting.js'

const MIGRATION_HOUSEHOLD_OWNED_STATES = new Set(['household_active', 'failed_forward_only'])

export function recurringBillingClock(asOf, timeZone) {
  const timestamp = asOf instanceof Date ? asOf : new Date(asOf)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Recurring billing requires a valid as-of timestamp.')
  const asOfDate = facilityDate(timestamp, timeZone)
  return {
    asOfDate,
    asOfMidnight: parseDbDate(asOfDate),
    billingMonth: `${asOfDate.slice(0, 7)}-01`,
    isMonthBoundary: asOfDate.endsWith('-01'),
    dayOfMonth: Number(asOfDate.slice(8, 10)),
    isNextMonthPostingDay: Number(asOfDate.slice(8, 10)) >= 5,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ asOf?: Date, maxCatchUpPerSub?: number }} [options]
 * @returns {Promise<{ subscriptionsProcessed:number, chargesPosted:number, periodsAdvanced:number }>}
 */
async function loadRecurringBillingAccounts(db, accountId = null) {
  return db.query(
    `SELECT account.*, family.facility_id,
            facility.timezone AS facility_timezone,
            migration.state AS migration_state,
            verified_migration.id IS NOT NULL AS has_verified_migration,
            verified_migration.effective_month AS verified_collection_month
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
       LEFT JOIN LATERAL (
         SELECT candidate.state
           FROM billing_account_migration candidate
          WHERE candidate.family_billing_account_id = account.id
          ORDER BY candidate.id DESC
          LIMIT 1
       ) migration ON TRUE
       LEFT JOIN LATERAL (
         SELECT candidate.id,
                CASE
                  WHEN NULLIF(candidate.parity_snapshot ->> 'collectionDeferredToMonth', '') IS NULL
                    THEN candidate.cutover_month
                  WHEN candidate.parity_snapshot ->> 'collectionDeferredToMonth'
                       ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
                    THEN (candidate.parity_snapshot ->> 'collectionDeferredToMonth')::date
                  ELSE NULL::date
                END AS effective_month
           FROM billing_account_migration candidate
          WHERE candidate.family_billing_account_id = account.id
            AND candidate.state = 'verified'
            AND candidate.verified_at IS NOT NULL
          ORDER BY candidate.id DESC
          LIMIT 1
       ) verified_migration ON TRUE
      WHERE account.is_active = TRUE
        AND ($1::bigint IS NULL OR account.id = $1)
      ORDER BY account.id`,
    [accountId == null ? null : Number(accountId)],
  ).then((result) => result.rows)
}

async function loadDueRecurringSubscriptions(db, { accountId, asOfDate }) {
  return db.query(
    `SELECT subscription.id, subscription.next_bill_date
       FROM billing_subscription subscription
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status = 'active'
        AND subscription.next_bill_date IS NOT NULL
        AND subscription.next_bill_date <= $2::date
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
      ORDER BY subscription.next_bill_date, subscription.id`,
    [Number(accountId), asOfDate],
  ).then((result) => result.rows)
}

async function loadMonthlyInvoiceState(db, { accountId, billingMonth }) {
  return db.query(
    `SELECT id, status, automatic_attempt_count, payment_attempted_at,
            stripe_payment_intent_id
       FROM billing_monthly_invoice
      WHERE family_billing_account_id = $1
        AND billing_month = $2::date
      LIMIT 1`,
    [Number(accountId), billingMonth],
  ).then((result) => result.rows[0] ?? null).catch((error) => {
    if (error?.code === '42P01' || error?.code === '42703') return null
    throw error
  })
}

function monthStart(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.toISOString().slice(0, 7)}-01`
  }
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-01` : null
}

export function billingMonthEnd(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-01$/)
  if (!match) throw new Error('Billing month must use YYYY-MM-01 format.')
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) throw new Error('Billing month must use YYYY-MM-01 format.')
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

export function recurringCollectionMode(account, { billingMonth = null } = {}) {
  const state = account?.migration_state == null ? null : String(account.migration_state)
  const householdEnabled = account?.household_monthly_billing_enabled === true
  const hasVerifiedMigration = account?.has_verified_migration === true || state === 'verified'
  // A verified cutover is terminal collection evidence. Later shadow/audit
  // rows must never move the recurring worker back to a migration-managed or
  // legacy collector while the durable household account remains enabled.
  if (hasVerifiedMigration) {
    if (householdEnabled) {
      if (billingMonth != null) {
        const currentMonth = monthStart(billingMonth)
        const effectiveMonth = monthStart(account?.verified_collection_month)
        if (!currentMonth || !effectiveMonth) {
          const error = new Error(
            `Billing account ${account?.id ?? 'unknown'} has no valid verified collection boundary.`,
          )
          error.code = 'recurring_collection_boundary_invalid'
          error.details = {
            billingMonth,
            verifiedCollectionMonth: account?.verified_collection_month ?? null,
          }
          throw error
        }
        if (currentMonth < effectiveMonth) return 'canonical_household_deferred'
      }
      return 'canonical_household'
    }
  } else if (state == null || state === 'rolled_back') {
    if (!householdEnabled) return 'legacy'
  } else if (MIGRATION_HOUSEHOLD_OWNED_STATES.has(state)) {
    if (householdEnabled) return 'migration_managed'
  } else if (!householdEnabled) {
    return 'migration_managed'
  }
  const error = new Error(
    `Billing account ${account?.id ?? 'unknown'} has incompatible migration and collection state.`,
  )
  error.code = 'recurring_collection_state_inconsistent'
  error.details = { migrationState: state, householdMonthlyBillingEnabled: householdEnabled }
  throw error
}

/**
 * Run one account's lifecycle, canonical charge posting, allocation, and optional
 * household invoice while the caller owns the account collection session lock.
 */
export async function processRecurringBillingAccount(db, account, {
  asOfTimestamp,
  clock,
  maxCatchUpPerSub = 12,
  completionProcessor = autoCompleteEndedEnrollments,
  cancellationProcessor = processDueEnrollmentCancellations,
  scheduledPauseProcessor = applyScheduledPauses,
  pauseCreditProcessor = applyPendingPauseCredits,
  discountSynchronizer = syncFamilyEnrollmentDiscounts,
  recurringChargeReconciler = reconcileCanonicalRecurringChargesForMonth,
  legacyChargePoster = postHardenedLegacyRecurringChargesForMonth,
  annualRenewalPoster = postDueAnnualMembershipRenewals,
  paymentAllocator = allocateHouseholdPayments,
  invoiceFactory = createHouseholdMonthlyInvoice,
} = {}) {
  const fresh = (await loadRecurringBillingAccounts(db, account.id))[0] ?? null
  if (!fresh) return { skipped: 'inactive', accountId: Number(account.id) }
  const collectionMode = recurringCollectionMode(fresh, { billingMonth: clock.billingMonth })
  if (collectionMode === 'migration_managed') {
    return {
      skipped: 'migration_managed',
      accountId: Number(fresh.id),
      migrationState: fresh.migration_state,
    }
  }
  const canonicalLedgerOwned = collectionMode === 'canonical_household'
    || collectionMode === 'canonical_household_deferred'

  const completedEnrollmentIds = await completionProcessor(db, {
    strict: true,
    accountId: Number(fresh.id),
    facilityId: Number(fresh.facility_id),
    asOfDate: clock.asOfDate,
  })
  const cancelledEnrollmentIds = await cancellationProcessor(db, {
    force: true,
    strict: true,
    accountId: Number(fresh.id),
    facilityId: Number(fresh.facility_id),
    asOfDate: clock.asOfDate,
  })
  const scheduledPausesApplied = await scheduledPauseProcessor(db, {
    strict: true,
    accountId: Number(fresh.id),
    facilityId: Number(fresh.facility_id),
    asOfDate: clock.asOfDate,
    asOf: asOfTimestamp,
  })
  const lifecycleChanges =
    (completedEnrollmentIds?.length ?? 0) +
    (cancelledEnrollmentIds?.length ?? 0) +
    Number(scheduledPausesApplied ?? 0)
  if (lifecycleChanges > 0) {
    await discountSynchronizer(db, Number(fresh.family_id), {
      strict: true,
      periodKey: clock.billingMonth,
      syncStripe: collectionMode === 'legacy',
    })
  }
  const pauseCreditsPosted = await pauseCreditProcessor(db, {
    periodStart: clock.asOfDate,
    facilityId: Number(fresh.facility_id),
    accountId: Number(fresh.id),
    strict: true,
  })

  // Annual memberships use the same immutable household ledger and collector
  // as tuition. The poster re-enters the account advisory lock and commits the
  // charge, any promo redemption, and the annual schedule advance together.
  const annualRenewals = await annualRenewalPoster(db, {
    accountId: Number(fresh.id),
    asOfDate: clock.asOfDate,
    billingThroughDate: collectionMode === 'canonical_household'
      ? billingMonthEnd(clock.billingMonth)
      : clock.asOfDate,
    asOfTimestamp,
    maxCatchUpPerSubscription: maxCatchUpPerSub,
  })

  let chargesPosted = Number(annualRenewals?.chargesPosted ?? 0)
  let periodsAdvanced = Number(annualRenewals?.periodsAdvanced ?? 0)
  const processedSubscriptionIds = new Set()
  const reconciledMonths = new Set()
  let rounds = 0
  while (rounds < maxCatchUpPerSub) {
    const due = await loadDueRecurringSubscriptions(db, {
      accountId: fresh.id,
      asOfDate: clock.asOfDate,
    })
    if (due.length === 0) break
    const billingMonth = monthStart(due[0].next_bill_date)
    if (!billingMonth) throw new Error(`Subscription ${due[0].id} has an invalid next bill date.`)
    const dueThisPeriod = due.filter((row) => monthStart(row.next_bill_date) === billingMonth)
    const postRecurringCharges = canonicalLedgerOwned
      ? recurringChargeReconciler
      : legacyChargePoster
    const reconciled = await postRecurringCharges(db, {
      accountId: Number(fresh.id),
      billingMonth,
      facilityTimeZone: fresh.facility_timezone,
      now: asOfTimestamp,
      apply: true,
    })
    if (reconciled.verified !== true) {
      const error = new Error(`Recurring charge parity failed for account ${fresh.id}.`)
      error.code = 'recurring_charge_parity_failed'
      error.details = reconciled
      throw error
    }
    reconciledMonths.add(billingMonth)
    chargesPosted += reconciled.postedChargeIds?.length ?? 0
    periodsAdvanced += dueThisPeriod.length
    for (const row of dueThisPeriod) processedSubscriptionIds.add(Number(row.id))
    rounds += 1

    const remaining = await loadDueRecurringSubscriptions(db, {
      accountId: fresh.id,
      asOfDate: clock.asOfDate,
    })
    if (
      remaining.length > 0 &&
      monthStart(remaining[0].next_bill_date) === billingMonth &&
      dueThisPeriod.some((row) => Number(row.id) === Number(remaining[0].id))
    ) {
      const error = new Error(`Recurring schedule made no progress for account ${fresh.id} in ${billingMonth}.`)
      error.code = 'recurring_schedule_no_progress'
      throw error
    }
  }

  const remainingDue = await loadDueRecurringSubscriptions(db, {
    accountId: fresh.id,
    asOfDate: clock.asOfDate,
  })
  if (remainingDue.length > 0) {
    const error = new Error(`Recurring catch-up limit was reached for account ${fresh.id}.`)
    error.code = 'recurring_catchup_limit_exceeded'
    throw error
  }

  if (canonicalLedgerOwned && !reconciledMonths.has(clock.billingMonth)) {
    const current = await recurringChargeReconciler(db, {
      accountId: Number(fresh.id),
      billingMonth: clock.billingMonth,
      facilityTimeZone: fresh.facility_timezone,
      now: asOfTimestamp,
      apply: true,
    })
    if (current.verified !== true) {
      const error = new Error(`Recurring charge parity failed for account ${fresh.id}.`)
      error.code = 'recurring_charge_parity_failed'
      error.details = current
      throw error
    }
    chargesPosted += current.postedChargeIds?.length ?? 0
  }

  // The fifth is a billing-preparation cutoff, not a collection event. Post the
  // following month's deterministic enrollment charges now so account cards and
  // Account History are accurate, but leave Stripe untouched until the first.
  if (canonicalLedgerOwned && clock.isNextMonthPostingDay) {
    const nextMonth = monthStart(new Date(`${clock.billingMonth}T12:00:00.000Z`))
    const nextBillingMonth = new Date(`${nextMonth}T12:00:00.000Z`)
    nextBillingMonth.setUTCMonth(nextBillingMonth.getUTCMonth() + 1)
    const next = await recurringChargeReconciler(db, {
      accountId: Number(fresh.id),
      billingMonth: `${nextBillingMonth.getUTCFullYear()}-${String(nextBillingMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
      facilityTimeZone: fresh.facility_timezone,
      now: asOfTimestamp,
      apply: true,
      allowEarlyPosting: true,
    })
    if (next.verified !== true) {
      const error = new Error(`Upcoming recurring charge parity failed for account ${fresh.id}.`)
      error.code = 'upcoming_recurring_charge_parity_failed'
      error.details = next
      throw error
    }
    chargesPosted += next.postedChargeIds?.length ?? 0
  }

  let householdInvoicesCreated = 0
  // Reconcile every settled household payment after all current-period ledger
  // rows (including annual membership renewals) exist. Open invoice lines and
  // in-flight attempts are excluded by the allocator, so this cannot bypass
  // a Stripe collection reservation; it only applies already-collected money
  // to an otherwise-unallocated charge.
  await paymentAllocator(db, { accountId: Number(fresh.id), actorType: 'system' })

  if (collectionMode === 'canonical_household') {
    const existingInvoice = await loadMonthlyInvoiceState(db, {
      accountId: Number(fresh.id),
      billingMonth: clock.billingMonth,
    })
    // A first-of-month collection may catch up once if the worker was down and
    // no current-month invoice exists. A confirmed failure is retried exactly
    // once on the facility's fifth day. Existing payment-method-required or
    // unknown/processing invoices are deliberately not retried by the worker.
    const shouldAttemptInitial = clock.isMonthBoundary || !existingInvoice
    const shouldAttemptRetry = clock.dayOfMonth === 5
      && existingInvoice?.status === 'failed'
      && Number(existingInvoice.automatic_attempt_count ?? 0) === 1
      && Boolean(existingInvoice.stripe_payment_intent_id)
    if (shouldAttemptInitial || shouldAttemptRetry) {
      const result = await invoiceFactory(db, {
        account: fresh,
        billingMonth: clock.billingMonth,
        facilityTimeZone: fresh.facility_timezone,
        automaticAttemptPolicy: shouldAttemptRetry ? 'retry_on_fifth' : 'initial',
        now: asOfTimestamp,
      })
      if (['feature_disabled', 'not_enabled', 'stripe_unavailable'].includes(result?.skipped)) {
        const error = new Error(
          `Household invoice collection is unavailable for billing account ${fresh.id}: ${result.skipped}.`,
        )
        error.code = 'household_invoice_collection_unavailable'
        error.details = { accountId: Number(fresh.id), skipped: result.skipped }
        throw error
      }
      if (result.created) householdInvoicesCreated += 1
    }
  }
  return {
    accountId: Number(fresh.id),
    subscriptionsProcessed:
      processedSubscriptionIds.size + Number(annualRenewals?.subscriptionsProcessed ?? 0),
    chargesPosted,
    periodsAdvanced,
    annualRenewalChargesPosted: Number(annualRenewals?.chargesPosted ?? 0),
    annualRenewalPeriodsAdvanced: Number(annualRenewals?.periodsAdvanced ?? 0),
    pauseCreditsPosted,
    householdInvoicesCreated,
    collectionMode,
  }
}

export async function generateRecurringCharges(pool, {
  asOf = new Date(),
  maxCatchUpPerSub = 12,
  accountLock = withBillingAccountCollectionLock,
  accountProcessor = processRecurringBillingAccount,
} = {}) {
  const asOfTimestamp = asOf instanceof Date ? asOf : new Date(asOf)
  if (Number.isNaN(asOfTimestamp.getTime())) throw new Error('Recurring billing requires a valid as-of timestamp.')

  const accounts = await loadRecurringBillingAccounts(pool)
  let subscriptionsProcessed = 0
  let chargesPosted = 0
  let periodsAdvanced = 0
  let pauseCreditsPosted = 0
  let householdInvoicesCreated = 0
  const blockedAccounts = []
  const skippedMigrationAccountIds = []

  for (const account of accounts) {
    const clock = recurringBillingClock(asOfTimestamp, account.facility_timezone)
    try {
      const result = await accountLock(pool, Number(account.id), (lockedDb) => accountProcessor(lockedDb, account, {
        asOfTimestamp,
        clock,
        maxCatchUpPerSub,
      }))
      if (result?.skipped === 'migration_managed') {
        skippedMigrationAccountIds.push(Number(account.id))
        continue
      }
      subscriptionsProcessed += Number(result?.subscriptionsProcessed ?? 0)
      chargesPosted += Number(result?.chargesPosted ?? 0)
      periodsAdvanced += Number(result?.periodsAdvanced ?? 0)
      pauseCreditsPosted += Number(result?.pauseCreditsPosted ?? 0)
      householdInvoicesCreated += Number(result?.householdInvoicesCreated ?? 0)
    } catch (error) {
      blockedAccounts.push({
        accountId: Number(account.id),
        code: error?.code ?? 'recurring_account_failed',
      })
      console.error('[billing] recurring account blocked:', account.id, error?.code ?? null, error?.message ?? error)
    }
  }

  return {
    subscriptionsProcessed,
    chargesPosted,
    periodsAdvanced,
    pauseCreditsPosted,
    householdInvoicesCreated,
    accountsBlocked: blockedAccounts.length,
    blockedAccountIds: blockedAccounts.map((entry) => entry.accountId),
    blockedAccounts,
    skippedMigrationAccountIds,
  }
}

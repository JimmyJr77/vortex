#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import Stripe from 'stripe'
import {
  buildSignupOrderPreview,
  computeExistingEnrollmentDiscounts,
} from '../scheduling/orderPricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const connectionString =
  process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL

if (!connectionString) {
  throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')
}

function needsSsl(value) {
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
}

const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
})

const requestedAccountIds = new Set(
  (process.argv.find((arg) => arg.startsWith('--account-ids='))?.split('=')[1] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite),
)
const requestedPromoRuleId = Number(
  process.argv.find((arg) => arg.startsWith('--promo-rule-id='))?.split('=')[1],
)
const verifySignupIds = (process.argv.find((arg) => arg.startsWith('--verify-signup-ids='))?.split('=')[1] ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map(Number)
  .filter(Number.isFinite)

const ELIGIBLE_ENROLLMENTS_SQL = `
  WITH eligible AS (
    SELECT
      s.id AS signup_id,
      s.member_id,
      s.enrollment_start_date,
      s.manual_discount_cents,
      s.manual_discount_pct,
      s.manual_discount_reason,
      s.pricing_breakdown,
      m.family_id,
      account.id AS account_id,
      account.stripe_customer_id,
      active_subscription.id AS billing_subscription_id,
      active_subscription.stripe_subscription_id,
      COALESCE(
        NULLIF(s.pricing_breakdown ->> 'billingType', ''),
        NULLIF(s.pricing_breakdown ->> 'billing_type', ''),
        NULLIF(s.pricing_breakdown -> 'line' ->> 'billingType', ''),
        NULLIF(s.pricing_breakdown -> 'line' ->> 'billing_type', ''),
        'recurring'
      ) AS billing_type
    FROM scheduling_signup s
    JOIN member m ON m.id = s.member_id
    JOIN scheduling_form sf ON sf.id = s.form_id
    JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
    LEFT JOIN scheduling_offering offering ON offering.id = sg.offering_id
    LEFT JOIN family_billing_account account ON account.family_id = m.family_id
    LEFT JOIN LATERAL (
      SELECT bs.id, bs.stripe_subscription_id
      FROM billing_subscription bs
      WHERE bs.source_type = 'scheduling_signup'
        AND bs.source_id = s.id::text
        AND bs.status <> 'cancelled'
      ORDER BY CASE bs.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, bs.id DESC
      LIMIT 1
    ) active_subscription ON TRUE
    WHERE s.status = 'confirmed'
      AND s.orphaned_at IS NULL
      AND sf.deleted_at IS NULL
      AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > CURRENT_DATE)
      AND COALESCE(offering.end_date, sg.active_end, sf.end_date) IS DISTINCT FROM DATE '-infinity'
      AND (
        COALESCE(offering.end_date, sg.active_end, sf.end_date) IS NULL
        OR COALESCE(offering.end_date, sg.active_end, sf.end_date) >= CURRENT_DATE
      )
  )
  SELECT *
  FROM eligible
  WHERE billing_type <> 'one_time'
  ORDER BY account_id NULLS LAST, signup_id
`

async function loadDefaultCardAccountIds(rows) {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY_PROD ||
    process.env.STRIPE_SECRET_KEY_TEST
  if (!key) return { accountIds: new Set(), errors: [], mode: 'unconfigured' }

  const stripe = new Stripe(key)
  const customers = new Map()
  for (const row of rows) {
    if (row.account_id != null && row.stripe_customer_id) {
      customers.set(Number(row.account_id), String(row.stripe_customer_id))
    }
  }

  const accountIds = new Set()
  const errors = []
  for (const [accountId, customerId] of customers) {
    try {
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      })
      if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
        accountIds.add(accountId)
      }
    } catch (error) {
      errors.push({ accountId, code: error?.code || 'stripe_error' })
    }
  }

  return {
    accountIds,
    errors,
    mode: key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown',
  }
}

async function verifySubscriptions(signupIds) {
  if (signupIds.length === 0) return null
  const client = await pool.connect()
  let rows
  let recentLedgerCharges = 0
  try {
    await client.query('BEGIN READ ONLY')
    rows = (
      await client.query(
        `SELECT signup.id AS signup_id,
                signup.manual_discount_pct,
                signup.manual_discount_rule_id,
                subscription.id AS billing_subscription_id,
                subscription.monthly_amount_cents,
                subscription.discount_amount_cents,
                subscription.net_monthly_cents,
                subscription.next_bill_date,
                subscription.stripe_subscription_id,
                subscription.price_sync_status,
                COUNT(adjustment.id)::int AS legacy_adjustment_count
         FROM scheduling_signup signup
         JOIN billing_subscription subscription
           ON subscription.source_type = 'scheduling_signup'
          AND subscription.source_id = signup.id::text
          AND subscription.status <> 'cancelled'
         LEFT JOIN enrollment_price_adjustment adjustment
           ON adjustment.signup_id = signup.id
          AND adjustment.kind = 'legacy_discount'
          AND adjustment.status = 'active'
         WHERE signup.id = ANY($1::bigint[])
         GROUP BY signup.id, subscription.id
         ORDER BY signup.id`,
        [signupIds],
      )
    ).rows
    recentLedgerCharges = Number(
      (
        await client.query(
          `SELECT COUNT(*)::int AS count
           FROM billing_charge
           WHERE subscription_id = ANY($1::bigint[])
             AND created_at >= now() - interval '30 minutes'`,
          [rows.map((row) => Number(row.billing_subscription_id))],
        )
      ).rows[0]?.count ?? 0,
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY_PROD ||
    process.env.STRIPE_SECRET_KEY_TEST
  const stripe = new Stripe(key)
  const verified = []
  for (const row of rows) {
    let stripeState = null
    try {
      const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
        expand: ['items.data.price', 'latest_invoice'],
      })
      stripeState = {
        status: subscription.status,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        amountCents: Number(subscription.items?.data?.[0]?.price?.unit_amount ?? 0),
        latestInvoiceId:
          typeof subscription.latest_invoice === 'string'
            ? subscription.latest_invoice
            : subscription.latest_invoice?.id ?? null,
        latestInvoiceStatus:
          typeof subscription.latest_invoice === 'object'
            ? subscription.latest_invoice?.status ?? null
            : null,
        latestInvoiceTotalCents:
          typeof subscription.latest_invoice === 'object'
            ? Number(subscription.latest_invoice?.total ?? 0)
            : null,
        latestInvoiceAmountPaidCents:
          typeof subscription.latest_invoice === 'object'
            ? Number(subscription.latest_invoice?.amount_paid ?? 0)
            : null,
      }
    } catch (error) {
      stripeState = { error: error?.code || error?.message || 'stripe_error' }
    }
    verified.push({
      signupId: Number(row.signup_id),
      billingSubscriptionId: Number(row.billing_subscription_id),
      grossCents: Number(row.monthly_amount_cents),
      discountCents: Number(row.discount_amount_cents),
      netCents: Number(row.net_monthly_cents),
      nextBillDate: row.next_bill_date,
      priceSyncStatus: row.price_sync_status,
      manualDiscountPct:
        row.manual_discount_pct == null ? null : Number(row.manual_discount_pct),
      manualDiscountRuleId:
        row.manual_discount_rule_id == null ? null : Number(row.manual_discount_rule_id),
      legacyAdjustmentCount: Number(row.legacy_adjustment_count),
      stripe: stripeState,
    })
  }
  return { recentLedgerCharges, subscriptions: verified }
}

async function loadResolvedPrices(client, rows, promoCodes = []) {
  const prices = new Map()
  const familyIds = [...new Set(rows.map((row) => Number(row.family_id)).filter(Number.isFinite))]

  for (const familyId of familyIds) {
    const members = (
      await client.query(
        `SELECT m.id, m.billing_city, m.graduation_year, latest.responses
         FROM member m
         LEFT JOIN LATERAL (
           SELECT s.responses
           FROM scheduling_signup s
           WHERE s.member_id = m.id AND s.orphaned_at IS NULL
           ORDER BY s.created_at DESC, s.id DESC
           LIMIT 1
         ) latest ON TRUE
         WHERE m.family_id = $1 AND m.is_active = TRUE
         ORDER BY m.id`,
        [familyId],
      )
    ).rows
    const previewExistingLines = []
    let anchorMemberId = null

    for (const member of members) {
      const responses =
        typeof member.responses === 'string'
          ? JSON.parse(member.responses)
          : member.responses ?? {}
      const graduationYearValue =
        member.graduation_year ?? responses.graduation_year ?? null
      const memberContext = {
        city: member.billing_city ?? null,
        school: responses.current_school
          ? String(responses.current_school).trim()
          : null,
        graduationYear:
          graduationYearValue == null || graduationYearValue === ''
            ? null
            : Number(graduationYearValue),
        familyId,
      }
      const preview = await buildSignupOrderPreview(client, {
        memberId: Number(member.id),
        newSignups: [],
        promoCodes,
        memberContext,
      })
      for (const cls of preview?.existingClasses ?? []) {
        if (cls.id == null || !(Number(cls.monthlyPrice) > 0)) continue
        anchorMemberId = anchorMemberId ?? Number(member.id)
        const grossCents = Math.round(Number(cls.monthlyPrice) * 100)
        previewExistingLines.push({
          key: `audit-existing-${cls.id}`,
          signupId: Number(cls.id),
          formId: cls.formId,
          programId: cls.programsId ?? null,
          sportId: null,
          memberId: Number(member.id),
          familyId,
          memberCity: memberContext.city,
          memberSchool: memberContext.school,
          memberGraduationYear: memberContext.graduationYear,
          baseCents: grossCents,
          listCents: grossCents,
          finalCents: grossCents,
          includeInSubtotal: false,
          shadowOnly: true,
        })
      }
    }

    if (anchorMemberId == null || previewExistingLines.length === 0) continue
    const anchorLine = previewExistingLines.find(
      (line) => line.memberId === anchorMemberId,
    )
    const discounts = await computeExistingEnrollmentDiscounts(client, {
      memberId: anchorMemberId,
      promoCodes,
      memberContext: {
        familyId,
        city: anchorLine?.memberCity ?? null,
        school: anchorLine?.memberSchool ?? null,
        graduationYear: anchorLine?.memberGraduationYear ?? null,
      },
      previewExistingLines,
      formRows: new Map(),
      scopeMeta: new Map(),
    })
    for (const line of discounts?.accountLines ?? []) {
      prices.set(Number(line.signupId), {
        grossCents: Math.max(0, Math.round(Number(line.baseCents ?? line.listCents) || 0)),
        netCents: Math.max(0, Math.round(Number(line.finalCents) || 0)),
        discounts: (line.applied ?? []).map((item) => ({
          ruleId: item.ruleId == null ? null : Number(item.ruleId),
          name: item.name ?? null,
          source: item.source ?? null,
          amountCents: Math.max(0, Math.round(Number(item.amountCents) || 0)),
        })),
      })
    }
  }

  return prices
}

async function loadDiscountRedemptions(client, rows) {
  const signupIds = rows.map((row) => Number(row.signup_id)).filter(Number.isFinite)
  if (signupIds.length === 0) return new Map()
  const result = await client.query(
    `SELECT redemption.signup_id, redemption.amount_cents, redemption.kind,
            rule.id AS rule_id, rule.name, rule.type
     FROM discount_redemption redemption
     LEFT JOIN discount_rule rule ON rule.id = redemption.rule_id
     WHERE redemption.signup_id = ANY($1::bigint[])
     ORDER BY redemption.signup_id, redemption.id`,
    [signupIds],
  )
  const bySignup = new Map()
  for (const row of result.rows) {
    const signupId = Number(row.signup_id)
    if (!bySignup.has(signupId)) bySignup.set(signupId, [])
    bySignup.get(signupId).push({
      ruleId: row.rule_id == null ? null : Number(row.rule_id),
      name: row.name ?? null,
      type: row.type ?? null,
      kind: row.kind,
      amountCents: Math.max(0, Number(row.amount_cents) || 0),
    })
  }
  return bySignup
}

async function loadPendingEnrollmentSnapshots(client, rows) {
  const memberIds = [...new Set(rows.map((row) => Number(row.member_id)).filter(Number.isFinite))]
  if (memberIds.length === 0) return new Map()
  const result = await client.query(
    `SELECT DISTINCT ON (member_id)
            member_id, status, due_now_cents, created_at, preview_snapshot
     FROM stripe_pending_enrollment
     WHERE member_id = ANY($1::bigint[])
     ORDER BY member_id, created_at DESC, id DESC`,
    [memberIds],
  )
  return new Map(result.rows.map((row) => [Number(row.member_id), row]))
}

async function main() {
  const client = await pool.connect()
  let rows
  let resolvedPrices = new Map()
  let discountRedemptions = new Map()
  let pendingSnapshots = new Map()
  let discountRules = []
  const includeDetails = process.argv.includes('--details')
  try {
    // The canonical pricing loader includes idempotent boot-time schema checks.
    // Detail mode therefore runs in a transaction that is always rolled back;
    // the normal aggregate audit remains database-enforced read-only.
    await client.query(includeDetails ? 'BEGIN' : 'BEGIN READ ONLY')
    rows = (await client.query(ELIGIBLE_ENROLLMENTS_SQL)).rows
    if (includeDetails) {
      let requestedPromoCodes = []
      if (Number.isFinite(requestedPromoRuleId)) {
        const promoResult = await client.query(
          `SELECT COALESCE(config->>'code', config->>'promo_code') AS code
           FROM discount_rule WHERE id = $1 AND active = TRUE`,
          [requestedPromoRuleId],
        )
        if (promoResult.rows[0]?.code) requestedPromoCodes = [promoResult.rows[0].code]
      }
      resolvedPrices = await loadResolvedPrices(
        client,
        rows.filter(
          (row) =>
            row.stripe_customer_id &&
            (requestedAccountIds.size === 0 || requestedAccountIds.has(Number(row.account_id))) &&
            (row.billing_subscription_id == null || row.stripe_subscription_id == null),
        ),
        requestedPromoCodes,
      )
      discountRedemptions = await loadDiscountRedemptions(client, rows)
      pendingSnapshots = await loadPendingEnrollmentSnapshots(client, rows)
      discountRules = (
        await client.query(
          `SELECT id, name, type, amount_type, amount_value, apply_to, calc_base,
                  priority, stackable, scope_level, scope_ref_id,
                  config - 'code' - 'promo_code' AS config
           FROM discount_rule
           WHERE active = TRUE
           ORDER BY priority, id`,
        )
      ).rows
    }
    await client.query(includeDetails ? 'ROLLBACK' : 'COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const gaps = rows.filter(
    (row) => row.billing_subscription_id == null || row.stripe_subscription_id == null,
  )
  const stripeState = await loadDefaultCardAccountIds(gaps)
  const repairable = gaps.filter(
    (row) => row.account_id != null && stripeState.accountIds.has(Number(row.account_id)),
  )
  const verification = await verifySubscriptions(verifySignupIds)

  const summary = {
    stripeMode: stripeState.mode,
    eligibleEnrollments: rows.length,
    eligibleAccounts: new Set(rows.map((row) => row.account_id).filter(Boolean)).size,
    missingLocalSubscriptions: gaps.filter((row) => row.billing_subscription_id == null).length,
    missingStripeSubscriptions: gaps.filter(
      (row) => row.billing_subscription_id != null && row.stripe_subscription_id == null,
    ).length,
    gapAccountsWithStripeCustomer: new Set(
      gaps.filter((row) => row.stripe_customer_id).map((row) => row.account_id),
    ).size,
    gapAccountsWithDefaultSavedCard: new Set(repairable.map((row) => row.account_id)).size,
    repairableEnrollments: repairable.length,
    stripeLookupErrors: stripeState.errors,
    repairScope: [...new Set(repairable.map((row) => Number(row.account_id)))].map((accountId) => ({
      accountId,
      signupIds: repairable
        .filter((row) => Number(row.account_id) === accountId)
        .map((row) => Number(row.signup_id)),
    })),
    ...(verification ? { verification } : {}),
    ...(process.argv.includes('--details')
      ? {
          activeDiscountRules: discountRules.map((row) => ({
            id: Number(row.id),
            name: row.name,
            type: row.type,
            amountType: row.amount_type,
            amountValue: Number(row.amount_value),
            applyTo: row.apply_to,
            calcBase: row.calc_base,
            priority: Number(row.priority),
            stackable: Boolean(row.stackable),
            scopeLevel: row.scope_level,
            scopeRefId: row.scope_ref_id == null ? null : Number(row.scope_ref_id),
            config: row.config ?? {},
          })),
          repairRows: repairable
            .filter(
              (row) =>
                requestedAccountIds.size === 0 ||
                requestedAccountIds.has(Number(row.account_id)),
            )
            .map((row) => ({
            accountId: Number(row.account_id),
            signupId: Number(row.signup_id),
            memberId: Number(row.member_id),
            enrollmentStartDate: row.enrollment_start_date,
            manualDiscountCents:
              row.manual_discount_cents == null ? null : Number(row.manual_discount_cents),
            manualDiscountPct:
              row.manual_discount_pct == null ? null : Number(row.manual_discount_pct),
            manualDiscountReason: row.manual_discount_reason ?? null,
            pricingLine: row.pricing_breakdown?.line ?? null,
            resolvedPrice: resolvedPrices.get(Number(row.signup_id)) ?? null,
            discountRedemptions:
              discountRedemptions.get(Number(row.signup_id)) ?? [],
            latestPendingEnrollment:
              pendingSnapshots.has(Number(row.member_id))
                ? {
                    status: pendingSnapshots.get(Number(row.member_id)).status,
                    dueNowCents: Number(
                      pendingSnapshots.get(Number(row.member_id)).due_now_cents ?? 0,
                    ),
                    createdAt: pendingSnapshots.get(Number(row.member_id)).created_at,
                    previewSnapshot:
                      pendingSnapshots.get(Number(row.member_id)).preview_snapshot ?? null,
                  }
                : null,
          })),
        }
      : {}),
  }

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error(error?.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })

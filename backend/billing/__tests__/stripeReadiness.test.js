import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStripeReadiness, getStripeOperationsDashboard } from '../stripeReconciliation.js'

test('live readiness passes only when every operational check passes', () => {
  const now = new Date('2026-07-25T12:00:00.000Z')
  const readiness = buildStripeReadiness({
    enabled: true,
    secretKey: 'sk_live_example',
    webhookSecrets: 'whsec_example',
    latestReconciliation: {
      status: 'succeeded',
      completed_at: '2026-07-25T10:00:00.000Z',
    },
    failedWebhookCount: 0,
    criticalAlertCount: 0,
    emailDomainVerified: true,
    now,
  })
  assert.equal(readiness.mode, 'live')
  assert.equal(readiness.readyForLivePayments, true)
  assert.ok(readiness.checks.every((check) => check.passed))
})

test('stale reconciliation and missing webhook secret block readiness', () => {
  const readiness = buildStripeReadiness({
    enabled: true,
    secretKey: 'sk_live_example',
    webhookSecrets: '',
    latestReconciliation: {
      status: 'succeeded',
      completed_at: '2026-07-20T10:00:00.000Z',
    },
    failedWebhookCount: 1,
    criticalAlertCount: 2,
    emailDomainVerified: false,
    now: new Date('2026-07-25T12:00:00.000Z'),
  })
  assert.equal(readiness.readyForLivePayments, false)
  assert.deepEqual(
    readiness.checks.filter((check) => !check.passed).map((check) => check.key),
    ['webhook_signing', 'reconciliation', 'webhook_failures', 'critical_alerts', 'email_domain'],
  )
})

test('operations dashboard exposes bounded incident history without secret values', async () => {
  const previous = {
    STRIPE_ENABLED: process.env.STRIPE_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_EMAIL_DOMAIN_VERIFIED: process.env.STRIPE_EMAIL_DOMAIN_VERIFIED,
  }
  process.env.STRIPE_ENABLED = 'true'
  process.env.STRIPE_SECRET_KEY = 'sk_live_do_not_return'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_do_not_return'
  process.env.STRIPE_EMAIL_DOMAIN_VERIFIED = 'true'
  const run = {
    id: 9,
    status: 'succeeded',
    completed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    stripe_payments_checked: 4,
    payments_inserted: 0,
    mismatches_found: 0,
    disputes_checked: 0,
  }
  const incident = {
    event_id: 'evt_failed',
    event_type: 'invoice.payment_failed',
    status: 'failed',
    attempts: 2,
    last_error: 'processor timeout',
    updated_at: new Date().toISOString(),
  }
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM stripe_billing_alert')) return { rows: [] }
      if (sql.includes('SELECT * FROM stripe_reconciliation_run')) return { rows: [run] }
      if (sql.includes('GROUP BY status')) return { rows: [{ status: 'processed', count: 4 }] }
      if (sql.includes('FROM stripe_webhook_event') && sql.includes('attempts')) return { rows: [incident] }
      return { rows: [] }
    },
  }
  try {
    const dashboard = await getStripeOperationsDashboard(pool, { allowGlobal: true })
    assert.deepEqual(dashboard.recentReconciliations, [run])
    assert.deepEqual(dashboard.webhookIncidents, [incident])
    assert.equal(dashboard.readyForLivePayments, true)
    assert.equal(JSON.stringify(dashboard).includes('do_not_return'), false)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

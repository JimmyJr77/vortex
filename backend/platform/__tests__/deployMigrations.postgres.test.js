import assert from 'node:assert/strict'
import test from 'node:test'

import pg from 'pg'

import {
  DEPLOY_MIGRATION_FILES,
  DEPLOY_MIGRATION_LOCK_ID,
  runDeployMigrations,
} from '../../deployMigrations.js'
import { assertDeployBillingSchema } from '../../billing/billingSchemaReadiness.js'

const { Pool } = pg

const integrationEnabled = process.env.RUN_DISPOSABLE_POSTGRES_MIGRATION_TESTS === 'true'
const configuredDatabaseUrl = process.env.BILLING_MIGRATION_TEST_DATABASE_URL ?? ''

function disposableDatabaseTarget(connectionString) {
  let parsed
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error('BILLING_MIGRATION_TEST_DATABASE_URL must be a valid PostgreSQL URL.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('The migration integration test accepts only a PostgreSQL URL.')
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  if (!loopbackHosts.has(parsed.hostname)) {
    throw new Error('The migration integration test accepts only a loopback PostgreSQL server.')
  }

  for (const parameter of ['host', 'hostaddr', 'dbname', 'database', 'service']) {
    if (parsed.searchParams.has(parameter)) {
      throw new Error(`The migration integration test URL cannot override ${parameter}.`)
    }
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const isDedicatedTestDatabase = databaseName === 'vortex_migration_ci'
    || /^vortex_migration_test(?:_[a-z0-9_]+)?$/.test(databaseName)
  if (!isDedicatedTestDatabase) {
    throw new Error(
      'The migration integration database must be named vortex_migration_ci or vortex_migration_test[_suffix].',
    )
  }

  return { connectionString: parsed.toString(), databaseName }
}

async function resetPublicSchema(client) {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE')
  await client.query('CREATE SCHEMA public')
}

async function createPrerequisiteSchema(client) {
  await client.query(`
    CREATE TABLE facility (
      id BIGSERIAL PRIMARY KEY
    );

    CREATE TABLE member (
      id BIGSERIAL PRIMARY KEY
    );

    CREATE TABLE family (
      id BIGSERIAL PRIMARY KEY
    );

    CREATE TABLE family_billing_account (
      id BIGSERIAL PRIMARY KEY,
      household_monthly_billing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE billing_account_activity (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE billing_charge (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE billing_payment (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      external_status TEXT
    );

    CREATE TABLE billing_payment_application (
      id BIGSERIAL PRIMARY KEY,
      billing_payment_id BIGINT NOT NULL REFERENCES billing_payment(id) ON DELETE RESTRICT,
      billing_charge_id BIGINT NOT NULL REFERENCES billing_charge(id) ON DELETE RESTRICT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      application_kind TEXT NOT NULL DEFAULT 'application'
        CHECK (application_kind IN ('application', 'reversal')),
      reverses_application_id BIGINT REFERENCES billing_payment_application(id) ON DELETE RESTRICT,
      idempotency_key TEXT,
      allocation_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX uq_billing_payment_application_idempotency
      ON billing_payment_application(idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    CREATE TABLE billing_refund (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE multi_class_pass_redemption (
      id BIGSERIAL PRIMARY KEY
    );

    CREATE TABLE scheduling_signup (
      id BIGSERIAL PRIMARY KEY,
      member_id BIGINT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE billing_subscription (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT REFERENCES family_billing_account(id) ON DELETE RESTRICT,
      source_type TEXT,
      pricing_option_key TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_subscription_id TEXT,
      stripe_subscription_item_id TEXT,
      stripe_subscription_schedule_id TEXT
    );

    CREATE TABLE drop_in_registration (
      id BIGSERIAL PRIMARY KEY,
      member_id BIGINT,
      class_date DATE,
      status TEXT
    );

    CREATE TABLE stripe_webhook_event (
      event_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'received',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE stripe_pending_enrollment (
      id BIGSERIAL PRIMARY KEY,
      family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id),
      member_id BIGINT NOT NULL REFERENCES member(id),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_snapshot JSONB,
      due_now_cents INTEGER NOT NULL DEFAULT 0,
      checkout_mode TEXT NOT NULL DEFAULT 'payment',
      stripe_checkout_session_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
    );

    CREATE TABLE discount_rule (
      id BIGSERIAL PRIMARY KEY
    );

    CREATE TABLE discount_redemption (
      id BIGSERIAL PRIMARY KEY,
      rule_id BIGINT REFERENCES discount_rule(id),
      member_id BIGINT REFERENCES member(id)
    );
  `)
}

async function assertDeployReadinessFailsAfterGuardDrop(client, {
  dropSql,
  readinessField,
  expectedObject,
}) {
  await client.query('BEGIN')
  try {
    await client.query(dropSql)
    await assert.rejects(
      assertDeployBillingSchema(client),
      (error) => {
        assert.equal(error.code, 'BILLING_SCHEMA_NOT_READY')
        assert.ok(error.readiness?.[readinessField]?.includes(expectedObject))
        return true
      },
    )
  } finally {
    await client.query('ROLLBACK')
  }
}

test('disposable PostgreSQL target guard rejects production-like and remote databases', () => {
  assert.throws(
    () => disposableDatabaseTarget('postgresql://postgres:secret@db.example.com/vortex_migration_ci'),
    /loopback/,
  )
  assert.throws(
    () => disposableDatabaseTarget('postgresql://postgres:secret@127.0.0.1/vortex_athletics'),
    /must be named/,
  )
  assert.throws(
    () => disposableDatabaseTarget('postgresql://postgres:secret@127.0.0.1/vortex_migration_ci?host=db.example.com'),
    /cannot override host/,
  )
  assert.equal(
    disposableDatabaseTarget('postgresql://postgres:secret@127.0.0.1/vortex_migration_ci').databaseName,
    'vortex_migration_ci',
  )
})

test('deploy migrations dry-run, apply once, become a no-op, and reject checksum drift', {
  skip: integrationEnabled ? false : 'set RUN_DISPOSABLE_POSTGRES_MIGRATION_TESTS=true to run',
  timeout: 60_000,
}, async () => {
  const target = disposableDatabaseTarget(configuredDatabaseUrl)
  const pool = new Pool({
    connectionString: target.connectionString,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
    lock_timeout: 10_000,
    max: 2,
  })
  let client

  try {
    client = await pool.connect()
    const identity = await client.query('SELECT current_database() AS database_name')
    assert.equal(identity.rows[0]?.database_name, target.databaseName)

    await resetPublicSchema(client)
    await createPrerequisiteSchema(client)
    await client.query(
      `INSERT INTO billing_payment (amount_cents, external_status)
       VALUES (100, NULL), (200, 'recorded'), (300, 'failed')`,
    )

    const dryRun = await runDeployMigrations(client, {
      dryRun: true,
      logger: { info() {} },
    })
    assert.equal(dryRun.dryRun, true)
    assert.deepEqual(dryRun.applied, DEPLOY_MIGRATION_FILES)
    assert.equal(dryRun.readiness.ready, true)

    const afterDryRun = await client.query(`
      SELECT
        to_regclass('public.schema_migrations') AS migration_table,
        to_regclass('public.billing_monthly_invoice') AS invoice_table,
        to_regclass('public.facility') AS prerequisite_table
    `)
    assert.equal(afterDryRun.rows[0]?.migration_table, null)
    assert.equal(afterDryRun.rows[0]?.invoice_table, null)
    assert.equal(afterDryRun.rows[0]?.prerequisite_table, 'facility')

    const firstApply = await runDeployMigrations(client, { logger: { info() {} } })
    assert.deepEqual(firstApply.applied, DEPLOY_MIGRATION_FILES)
    assert.deepEqual(firstApply.skipped, [])
    assert.equal(firstApply.readiness.ready, true)

    const normalizedPayments = await client.query(
      `SELECT amount_cents, external_status
         FROM billing_payment
        ORDER BY amount_cents`,
    )
    assert.deepEqual(normalizedPayments.rows, [
      { amount_cents: 100, external_status: 'settled' },
      { amount_cents: 200, external_status: 'settled' },
      { amount_cents: 300, external_status: 'failed' },
    ])
    const defaultPayment = await client.query(
      `INSERT INTO billing_payment (amount_cents)
       VALUES (400)
       RETURNING external_status`,
    )
    assert.equal(defaultPayment.rows[0]?.external_status, 'settled')
    await assert.rejects(
      client.query(
        `INSERT INTO billing_payment (amount_cents, external_status)
         VALUES (500, 'arbitrary_client_state')`,
      ),
      /billing_payment_external_status_check/,
    )

    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP TRIGGER trg_billing_payment_application_capacity ON billing_payment_application',
      readinessField: 'missingTriggers',
      expectedObject: 'billing_payment_application.trg_billing_payment_application_capacity',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP FUNCTION validate_billing_payment_attempt_reservation_total() CASCADE',
      readinessField: 'missingFunctions',
      expectedObject: 'validate_billing_payment_attempt_reservation_total',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'ALTER TABLE billing_migration_run DROP CONSTRAINT billing_migration_run_apply_provenance_check',
      readinessField: 'missingConstraints',
      expectedObject: 'billing_migration_run.billing_migration_run_apply_provenance_check',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP TRIGGER trg_billing_migration_subscription_claim ON billing_account_migration_item',
      readinessField: 'missingTriggers',
      expectedObject: 'billing_account_migration_item.trg_billing_migration_subscription_claim',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'ALTER TABLE billing_migration_subscription_claim DROP CONSTRAINT billing_migration_subscription_claim_pkey',
      readinessField: 'missingConstraints',
      expectedObject: 'billing_migration_subscription_claim.billing_migration_subscription_claim_pkey',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP TRIGGER trg_billing_migration_accepted_baseline_capture ON billing_account_migration',
      readinessField: 'missingTriggers',
      expectedObject: 'billing_account_migration.trg_billing_migration_accepted_baseline_capture',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP TRIGGER trg_billing_monthly_invoice_line_ownership ON billing_monthly_invoice_line',
      readinessField: 'missingTriggers',
      expectedObject: 'billing_monthly_invoice_line.trg_billing_monthly_invoice_line_ownership',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP TRIGGER trg_billing_charge_credit_application_capacity ON billing_charge_credit_application',
      readinessField: 'missingTriggers',
      expectedObject: 'billing_charge_credit_application.trg_billing_charge_credit_application_capacity',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'DROP INDEX idx_stripe_webhook_event_processing_lease',
      readinessField: 'missingRelations',
      expectedObject: 'idx_stripe_webhook_event_processing_lease',
    })
    await assertDeployReadinessFailsAfterGuardDrop(client, {
      dropSql: 'ALTER TABLE stripe_webhook_event DROP CONSTRAINT stripe_webhook_event_terminal_claim_check',
      readinessField: 'missingConstraints',
      expectedObject: 'stripe_webhook_event.stripe_webhook_event_terminal_claim_check',
    })

    const baselineFacility = await client.query(
      'INSERT INTO facility DEFAULT VALUES RETURNING id',
    )
    const baselineAccount = await client.query(
      `INSERT INTO family_billing_account (household_monthly_billing_enabled)
       VALUES (FALSE) RETURNING id`,
    )
    const baselineRun = await client.query(
      `INSERT INTO billing_migration_run (
         migration_key, mode, status, code_version, manifest_checksum,
         facility_id, target_month, facility_timezone, cohort, configuration, started_at
       ) VALUES (
         'canonical-household-billing-v1', 'apply', 'running', 'postgres-test-v1', $1,
         $2, '2026-09-01', 'America/New_York', 'postgres-test',
         jsonb_build_object('accountIds', jsonb_build_array($3::bigint)), now()
       ) RETURNING id`,
      ['a'.repeat(64), baselineFacility.rows[0].id, baselineAccount.rows[0].id],
    )
    const initialBaseline = await client.query(
      `INSERT INTO billing_account_migration (
         billing_migration_run_id, family_billing_account_id, state,
         payer_validation_status, parity_status, source_collection_mode,
         target_collection_mode, cutover_month,
         account_snapshot, pricing_snapshot, ledger_snapshot,
         initial_stripe_snapshot, rollback_snapshot, snapshot_hash
       ) VALUES (
         $1, $2, 'shadow_verified', 'verified', 'matched', 'legacy_per_class',
         'household_monthly', '2026-09-01',
         jsonb_build_object('id', $2::bigint),
         '{"targetMonth":"2026-09-01","timezone":"America/New_York"}'::jsonb,
         '{"balanceCents":10000}'::jsonb,
         '{"customerId":"cus_initial"}'::jsonb,
         '{"subscriptions":[]}'::jsonb,
         $3
       ) RETURNING *`,
      [baselineRun.rows[0].id, baselineAccount.rows[0].id, 'b'.repeat(64)],
    )
    assert.equal(initialBaseline.rows[0].accepted_baseline_version, 1)
    assert.equal(initialBaseline.rows[0].accepted_snapshot_hash, 'b'.repeat(64))
    const initialBaselineHistory = await client.query(
      `SELECT baseline_version, snapshot_hash, acceptance_reason
         FROM billing_account_migration_baseline
        WHERE billing_account_migration_id = $1`,
      [initialBaseline.rows[0].id],
    )
    assert.deepEqual(initialBaselineHistory.rows, [{
      baseline_version: 1,
      snapshot_hash: 'b'.repeat(64),
      acceptance_reason: 'initial_shadow_verification',
    }])

    const repairedBaseline = await client.query(
      `UPDATE billing_account_migration
          SET lease_owner = 'postgres-repair-worker',
              lease_expires_at = now() + interval '5 minutes',
              accepted_baseline_version = 2,
              accepted_snapshot_hash = $2,
              accepted_account_snapshot = jsonb_build_object('id', family_billing_account_id, 'repaired', true),
              accepted_pricing_snapshot = pricing_snapshot,
              accepted_ledger_snapshot = '{"balanceCents":7000}'::jsonb,
              accepted_stripe_snapshot = initial_stripe_snapshot,
              accepted_rollback_snapshot = rollback_snapshot,
              accepted_at = now()
        WHERE id = $1
        RETURNING accepted_baseline_version, accepted_snapshot_hash`,
      [initialBaseline.rows[0].id, 'c'.repeat(64)],
    )
    assert.deepEqual(repairedBaseline.rows[0], {
      accepted_baseline_version: 2,
      accepted_snapshot_hash: 'c'.repeat(64),
    })
    const baselineHistory = await client.query(
      `SELECT baseline_version, snapshot_hash, acceptance_reason
         FROM billing_account_migration_baseline
        WHERE billing_account_migration_id = $1
        ORDER BY baseline_version`,
      [initialBaseline.rows[0].id],
    )
    assert.deepEqual(baselineHistory.rows, [
      {
        baseline_version: 1,
        snapshot_hash: 'b'.repeat(64),
        acceptance_reason: 'initial_shadow_verification',
      },
      {
        baseline_version: 2,
        snapshot_hash: 'c'.repeat(64),
        acceptance_reason: 'deterministic_repair_reaudit',
      },
    ])
    await assert.rejects(
      client.query(
        `UPDATE billing_account_migration
            SET account_snapshot = '{"mutated":true}'::jsonb
          WHERE id = $1`,
        [initialBaseline.rows[0].id],
      ),
      /initial migration snapshots are immutable/,
    )
    await assert.rejects(
      client.query(
        `UPDATE billing_account_migration_baseline
            SET acceptance_reason = 'mutated'
          WHERE billing_account_migration_id = $1 AND baseline_version = 1`,
        [initialBaseline.rows[0].id],
      ),
      /baseline history is append-only/,
    )

    const claimAccounts = await client.query(
      `INSERT INTO family_billing_account (household_monthly_billing_enabled)
       VALUES (FALSE), (FALSE) RETURNING id`,
    )
    const claimAccountIds = claimAccounts.rows.map((row) => Number(row.id))
    const claimRun = await client.query(
      `INSERT INTO billing_migration_run (
         migration_key, mode, status, code_version, manifest_checksum,
         facility_id, target_month, facility_timezone, cohort, configuration, started_at
       ) VALUES (
         'canonical-household-billing-v1', 'apply', 'running', 'postgres-test-v1', $1,
         $2, '2026-09-01', 'America/New_York', 'claim-race',
         jsonb_build_object('accountIds', to_jsonb($3::bigint[])), now()
       ) RETURNING id`,
      ['d'.repeat(64), baselineFacility.rows[0].id, claimAccountIds],
    )
    const claimMigrations = await client.query(
      `INSERT INTO billing_account_migration (
         billing_migration_run_id, family_billing_account_id, state,
         source_collection_mode, target_collection_mode, cutover_month
       )
       SELECT $1, scoped.account_id, 'discovered', 'legacy_per_class', 'household_monthly', '2026-09-01'
         FROM unnest($2::bigint[]) AS scoped(account_id)
       RETURNING id, family_billing_account_id`,
      [claimRun.rows[0].id, claimAccountIds],
    )
    const claimMigrationByAccount = new Map(claimMigrations.rows.map((row) => (
      [Number(row.family_billing_account_id), Number(row.id)]
    )))
    const sharedSubscription = await client.query(
      'INSERT INTO billing_subscription DEFAULT VALUES RETURNING id',
    )
    const competingClient = await pool.connect()
    try {
      await client.query('BEGIN')
      await competingClient.query('BEGIN')
      await client.query(
        `INSERT INTO billing_account_migration_item (
           billing_account_migration_id, item_type, source_id,
           billing_subscription_id, former_stripe_subscription_id
         ) VALUES ($1, 'billing_subscription', 'first', $2, 'sub_concurrent_claim')`,
        [claimMigrationByAccount.get(claimAccountIds[0]), sharedSubscription.rows[0].id],
      )
      const competingInsert = competingClient.query(
        `INSERT INTO billing_account_migration_item (
           billing_account_migration_id, item_type, source_id,
           billing_subscription_id, former_stripe_subscription_id
         ) VALUES ($1, 'billing_subscription', 'second', $2, 'sub_concurrent_claim')`,
        [claimMigrationByAccount.get(claimAccountIds[1]), sharedSubscription.rows[0].id],
      )
      await new Promise((resolve) => setTimeout(resolve, 25))
      await client.query('COMMIT')
      await assert.rejects(competingInsert, /belongs to account|already belongs to active migration item/)
      await competingClient.query('ROLLBACK')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      await competingClient.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      competingClient.release()
    }
    const durableClaims = await client.query(
      `SELECT claim_kind, claim_value, family_billing_account_id
         FROM billing_migration_subscription_claim
        WHERE claim_value IN ($1, $2)
        ORDER BY claim_kind`,
      [String(sharedSubscription.rows[0].id), 'sub_concurrent_claim'],
    )
    assert.deepEqual(durableClaims.rows.map((row) => ({
      kind: row.claim_kind,
      value: row.claim_value,
      accountId: Number(row.family_billing_account_id),
    })), [
      {
        kind: 'local_subscription',
        value: String(sharedSubscription.rows[0].id),
        accountId: claimAccountIds[0],
      },
      {
        kind: 'stripe_subscription',
        value: 'sub_concurrent_claim',
        accountId: claimAccountIds[0],
      },
    ])

    const reservationAccount = await client.query(
      `INSERT INTO family_billing_account (household_monthly_billing_enabled)
       VALUES (FALSE) RETURNING id`,
    )
    const reservationCharge = await client.query(
      `INSERT INTO billing_charge (family_billing_account_id)
       VALUES ($1) RETURNING id`,
      [reservationAccount.rows[0].id],
    )
    await client.query('BEGIN')
    const validAttempt = await client.query(
      `INSERT INTO billing_payment_attempt (
         family_billing_account_id, attempt_type, request_key, amount_cents, expires_at
       ) VALUES ($1, 'member_balance_checkout', 'postgres-valid-attempt', 1000, now() + interval '1 day')
       RETURNING id`,
      [reservationAccount.rows[0].id],
    )
    await client.query(
      `INSERT INTO billing_payment_attempt_charge (
         billing_payment_attempt_id, billing_charge_id, amount_cents
       ) VALUES ($1, $2, 1000)`,
      [validAttempt.rows[0].id, reservationCharge.rows[0].id],
    )
    await client.query('COMMIT')

    await client.query('BEGIN')
    const invalidAttempt = await client.query(
      `INSERT INTO billing_payment_attempt (
         family_billing_account_id, attempt_type, request_key, amount_cents, expires_at
       ) VALUES ($1, 'member_balance_checkout', 'postgres-invalid-attempt', 1000, now() + interval '1 day')
       RETURNING id`,
      [reservationAccount.rows[0].id],
    )
    await client.query(
      `INSERT INTO billing_payment_attempt_charge (
         billing_payment_attempt_id, billing_charge_id, amount_cents
       ) VALUES ($1, $2, 900)`,
      [invalidAttempt.rows[0].id, reservationCharge.rows[0].id],
    )
    await assert.rejects(client.query('COMMIT'), /reserves 900, expected 1000/)
    await client.query('ROLLBACK')

    const capacityPayment = await client.query(
      `INSERT INTO billing_payment (family_billing_account_id, amount_cents)
       VALUES ($1, 1000) RETURNING id`,
      [reservationAccount.rows[0].id],
    )
    await client.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind
       ) VALUES ($1, $2, 700, 'application')`,
      [capacityPayment.rows[0].id, reservationCharge.rows[0].id],
    )
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind
       ) VALUES ($1, $2, 400, 'application')`,
      [capacityPayment.rows[0].id, reservationCharge.rows[0].id],
    )
    await assert.rejects(client.query('COMMIT'), /has 1100 applied cents, received 1000/)
    await client.query('ROLLBACK')

    const invoiceCreditAccount = await client.query(
      `INSERT INTO family_billing_account (household_monthly_billing_enabled)
       VALUES (TRUE) RETURNING id`,
    )
    const foreignInvoiceCreditAccount = await client.query(
      `INSERT INTO family_billing_account (household_monthly_billing_enabled)
       VALUES (TRUE) RETURNING id`,
    )
    const invoiceCreditSources = await client.query(
      `INSERT INTO billing_charge (family_billing_account_id, amount_cents)
       VALUES ($1, 1000), ($1, 400), ($1, -300), ($1, -200), ($2, 500)
       RETURNING id, amount_cents`,
      [invoiceCreditAccount.rows[0].id, foreignInvoiceCreditAccount.rows[0].id],
    )
    const invoiceCreditInvoice = await client.query(
      `INSERT INTO billing_monthly_invoice (
         family_billing_account_id, billing_month, subtotal_cents, credit_cents, total_cents
       ) VALUES ($1, '2026-11-01', 1000, 300, 700)
       RETURNING id`,
      [invoiceCreditAccount.rows[0].id],
    )
    const [positiveSource, secondPositiveSource, negativeSource, secondNegativeSource, foreignSource] = invoiceCreditSources.rows
    await client.query(
      `INSERT INTO billing_monthly_invoice_line (
         billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
       ) VALUES
         ($1, $2, 'charge', 'Net charge slice', 1000),
         ($1, $3, 'credit', 'Canonical account credit', -300)`,
      [invoiceCreditInvoice.rows[0].id, positiveSource.id, negativeSource.id],
    )
    await assert.rejects(
      client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
         ) VALUES ($1, $2, 'charge', 'Overstated charge', 401)`,
        [invoiceCreditInvoice.rows[0].id, secondPositiveSource.id],
      ),
      /exceeds its positive ledger charge/,
    )
    await assert.rejects(
      client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
         ) VALUES ($1, $2, 'charge', 'Negative source as charge', 100)`,
        [invoiceCreditInvoice.rows[0].id, secondNegativeSource.id],
      ),
      /exceeds its positive ledger charge/,
    )
    await assert.rejects(
      client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
         ) VALUES ($1, $2, 'credit', 'Positive source as credit', -100)`,
        [invoiceCreditInvoice.rows[0].id, secondPositiveSource.id],
      ),
      /exceeds its negative ledger charge/,
    )
    await assert.rejects(
      client.query(
        `INSERT INTO billing_monthly_invoice_line (
           billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
         ) VALUES ($1, $2, 'charge', 'Foreign account source', 500)`,
        [invoiceCreditInvoice.rows[0].id, foreignSource.id],
      ),
      /belongs to a different billing account/,
    )

    await client.query(
      `UPDATE billing_monthly_invoice SET status = 'paid'
        WHERE id = $1`,
      [invoiceCreditInvoice.rows[0].id],
    )
    const invoiceCreditLines = await client.query(
      `SELECT id, line_type
         FROM billing_monthly_invoice_line
        WHERE billing_monthly_invoice_id = $1
        ORDER BY id`,
      [invoiceCreditInvoice.rows[0].id],
    )
    const invoiceChargeLine = invoiceCreditLines.rows.find((line) => line.line_type === 'charge')
    const invoiceCreditLine = invoiceCreditLines.rows.find((line) => line.line_type === 'credit')
    await client.query(
      `INSERT INTO billing_charge_credit_application (
         billing_monthly_invoice_id, credit_invoice_line_id,
         target_invoice_line_id, amount_cents, idempotency_key
       ) VALUES ($1, $2, $3, 300, 'postgres-credit-allocation:1')`,
      [invoiceCreditInvoice.rows[0].id, invoiceCreditLine.id, invoiceChargeLine.id],
    )

    const overfundingPayment = await client.query(
      `INSERT INTO billing_payment (family_billing_account_id, amount_cents)
       VALUES ($1, 701) RETURNING id`,
      [invoiceCreditAccount.rows[0].id],
    )
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind
       ) VALUES ($1, $2, 701, 'application')`,
      [overfundingPayment.rows[0].id, positiveSource.id],
    )
    await assert.rejects(
      client.query('COMMIT'),
      /over-funded by payments and credits/,
    )
    await client.query('ROLLBACK')

    const voidCreditInvoice = await client.query(
      `INSERT INTO billing_monthly_invoice (
         family_billing_account_id, billing_month, status,
         subtotal_cents, credit_cents, total_cents
       ) VALUES ($1, '2026-12-01', 'void', 400, 200, 200)
       RETURNING id`,
      [invoiceCreditAccount.rows[0].id],
    )
    const voidCreditLines = await client.query(
      `INSERT INTO billing_monthly_invoice_line (
         billing_monthly_invoice_id, billing_charge_id, line_type, description, amount_cents
       ) VALUES
         ($1, $2, 'charge', 'Released void target', 400),
         ($1, $3, 'credit', 'Released void credit', -200)
       RETURNING id, line_type`,
      [voidCreditInvoice.rows[0].id, secondPositiveSource.id, secondNegativeSource.id],
    )
    await assert.rejects(
      client.query(
        `INSERT INTO billing_charge_credit_application (
           billing_monthly_invoice_id, credit_invoice_line_id,
           target_invoice_line_id, amount_cents, idempotency_key
         ) VALUES ($1, $2, $3, 200, 'postgres-credit-allocation:void')`,
        [
          voidCreditInvoice.rows[0].id,
          voidCreditLines.rows.find((line) => line.line_type === 'credit').id,
          voidCreditLines.rows.find((line) => line.line_type === 'charge').id,
        ],
      ),
      /require a paid invoice/,
    )

    await assert.rejects(
      client.query(
        `UPDATE billing_charge_credit_application
            SET amount_cents = 299
          WHERE idempotency_key = 'postgres-credit-allocation:1'`,
      ),
      /append-only/,
    )

    const retirementRelations = await client.query(`
      SELECT
        to_regclass('public.billing_legacy_telemetry_heartbeat') AS heartbeat_table,
        to_regclass('public.billing_cycle_verification_evidence') AS cycle_evidence_table
    `)
    assert.equal(retirementRelations.rows[0]?.heartbeat_table, 'billing_legacy_telemetry_heartbeat')
    assert.equal(retirementRelations.rows[0]?.cycle_evidence_table, 'billing_cycle_verification_evidence')
    await client.query(`
      INSERT INTO billing_legacy_telemetry_heartbeat (
        observed_on, status, successful_check_count, error_count,
        expected_route_count, first_checked_at, last_checked_at
      ) VALUES ('2026-09-01', 'healthy', 1, 0, 19, now(), now())
    `)

    const defaultAfterFirstApply = await client.query(`
      SELECT pg_get_expr(attribute_default.adbin, attribute_default.adrelid) AS expression
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
      JOIN pg_attrdef attribute_default
        ON attribute_default.adrelid = relation.oid
       AND attribute_default.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND relation.relname = 'family_billing_account'
        AND attribute.attname = 'household_monthly_billing_enabled'
    `)
    assert.equal(defaultAfterFirstApply.rows[0]?.expression, 'false')

    const remediationAccounts = await client.query(`
      INSERT INTO family_billing_account (household_monthly_billing_enabled)
      VALUES (TRUE), (TRUE), (TRUE), (TRUE)
      RETURNING id
    `)
    const [unsafeAccount, canonicalAccount, activityAccount, invoiceAccount] = remediationAccounts.rows
    await client.query(
      `INSERT INTO billing_account_activity (family_billing_account_id, event_type)
       VALUES ($1, 'household_monthly_billing_migrated')`,
      [activityAccount.id],
    )
    const migrationRun = await client.query(
      `INSERT INTO billing_migration_run (migration_key, mode)
       VALUES ('canonical-household-billing-v1', 'shadow')
       RETURNING id`,
    )
    const canonicalMigration = await client.query(
      `INSERT INTO billing_account_migration (
         billing_migration_run_id,
         family_billing_account_id,
         state,
         target_collection_mode,
         household_activated_at
       ) VALUES ($1, $2, 'household_active', 'household_monthly', now())
       RETURNING id`,
      [migrationRun.rows[0].id, canonicalAccount.id],
    )
    const cycleEvidence = await client.query(
      `INSERT INTO billing_cycle_verification_evidence (
         family_billing_account_id, billing_account_migration_id, billing_month, status,
         legacy_collector_count, collector_count, household_invoice_count,
         remote_household_invoice_count, unexpected_stripe_invoice_count,
         local_invoice_line_total_cents, local_invoice_subtotal_cents,
         local_invoice_line_subtotal_cents, local_invoice_line_credit_cents,
         local_invoice_credit_cents, local_invoice_total_cents, facility_timezone,
         collector_unique, household_invoice_unique, remote_household_invoice_unique,
         line_parity, no_unexpected_stripe_invoice, issues, evidence,
         evidence_hash, verifier_version, verified_at
       ) VALUES (
         $1, $2, '2026-06-01', 'verified', 0, 1, 1, 1, 0,
         12000, 12000, 12000, 0, 0, 12000, 'UTC', TRUE, TRUE, TRUE, TRUE, TRUE,
         '[]'::jsonb, '{}'::jsonb, $3, 'postgres-test-v1', now()
       ) RETURNING id`,
      [canonicalAccount.id, canonicalMigration.rows[0].id, 'a'.repeat(64)],
    )
    await assert.rejects(
      client.query(
        `UPDATE billing_cycle_verification_evidence SET verifier_version = 'mutated'
          WHERE id = $1`,
        [cycleEvidence.rows[0].id],
      ),
      /append-only/,
    )
    await client.query(
      `INSERT INTO billing_monthly_invoice (family_billing_account_id, billing_month)
       VALUES ($1, '2026-09-01')`,
      [invoiceAccount.id],
    )

    // Re-run only the remediation migration against representative rows to
    // prove unsafe inherited TRUE is disabled while durable evidence survives.
    await client.query(
      'ALTER TABLE family_billing_account ALTER COLUMN household_monthly_billing_enabled SET DEFAULT TRUE',
    )
    await client.query(
      `DELETE FROM schema_migrations
       WHERE filename = '786_billing_household_default_remediation.sql'`,
    )
    const remediationApply = await runDeployMigrations(client, { logger: { info() {} } })
    assert.deepEqual(remediationApply.applied, ['786_billing_household_default_remediation.sql'])
    assert.equal(remediationApply.readiness.ready, true)

    const remediated = await client.query(
      `SELECT id, household_monthly_billing_enabled
       FROM family_billing_account
       WHERE id = ANY($1::bigint[])
       ORDER BY id`,
      [remediationAccounts.rows.map(({ id }) => id)],
    )
    assert.deepEqual(remediated.rows.map((row) => ({
      id: Number(row.id),
      enabled: row.household_monthly_billing_enabled,
    })), [
      { id: Number(unsafeAccount.id), enabled: false },
      { id: Number(canonicalAccount.id), enabled: true },
      { id: Number(activityAccount.id), enabled: true },
      { id: Number(invoiceAccount.id), enabled: true },
    ])
    const remediationAudit = await client.query(
      `SELECT family_billing_account_id, outcome, reason
       FROM billing_household_default_remediation_audit
       WHERE family_billing_account_id = ANY($1::bigint[])
       ORDER BY family_billing_account_id`,
      [remediationAccounts.rows.map(({ id }) => id)],
    )
    assert.deepEqual(remediationAudit.rows.map((row) => ({
      accountId: Number(row.family_billing_account_id),
      outcome: row.outcome,
      reason: row.reason,
    })), [
      { accountId: Number(unsafeAccount.id), outcome: 'disabled', reason: 'implicit_default_without_cutover_evidence' },
      { accountId: Number(canonicalAccount.id), outcome: 'preserved', reason: 'canonical_activation_evidence' },
      { accountId: Number(activityAccount.id), outcome: 'preserved', reason: 'explicit_enable_activity' },
      { accountId: Number(invoiceAccount.id), outcome: 'preserved', reason: 'existing_household_invoice' },
    ])
    const preservedInvoice = await client.query(
      'SELECT COUNT(*)::int AS count FROM billing_monthly_invoice WHERE family_billing_account_id = $1',
      [invoiceAccount.id],
    )
    assert.equal(preservedInvoice.rows[0]?.count, 1)

    const secondApply = await runDeployMigrations(client, { logger: { info() {} } })
    assert.deepEqual(secondApply.applied, [])
    assert.deepEqual(secondApply.skipped, DEPLOY_MIGRATION_FILES)
    assert.equal(secondApply.readiness.ready, true)

    const migrationRows = await client.query('SELECT filename FROM schema_migrations ORDER BY filename')
    assert.deepEqual(
      migrationRows.rows.map(({ filename }) => filename),
      [...DEPLOY_MIGRATION_FILES].sort(),
    )

    await client.query(
      `UPDATE schema_migrations
          SET checksum = $2
        WHERE filename = $1`,
      [DEPLOY_MIGRATION_FILES[0], '0'.repeat(64)],
    )
    await assert.rejects(
      runDeployMigrations(client, { logger: { info() {} } }),
      (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
    )

    // A separate session must be able to acquire the lock. PostgreSQL advisory
    // locks are re-entrant on one session, so checking with `client` would not
    // prove that the failed deploy released its lock.
    const lockCheck = await pool.query(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [DEPLOY_MIGRATION_LOCK_ID],
    )
    assert.equal(lockCheck.rows[0]?.acquired, true)
    await pool.query('SELECT pg_advisory_unlock($1)', [DEPLOY_MIGRATION_LOCK_ID])
  } finally {
    if (client) {
      await resetPublicSchema(client).catch(() => {})
      client.release()
    }
    await pool.end()
  }
})

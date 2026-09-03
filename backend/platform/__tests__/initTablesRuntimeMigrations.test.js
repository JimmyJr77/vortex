import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  RUNTIME_COMPATIBILITY_MIGRATIONS,
  verifyAppliedRequiredBillingMigration,
  verifyRequiredBillingMigrationAtRuntime,
  verifyRequiredBillingMigrationsAtRuntime,
} from '../initTables.js'
import {
  legacyMigrationChecksum,
  migrationChecksum,
} from '../../deployMigrations.js'

test('platform boot includes every schema contract required by current Admin routes', () => {
  assert.deepEqual(RUNTIME_COMPATIBILITY_MIGRATIONS, [
    'add_scheduling_member_pricing.sql',
    'add_program_pricing_defaults.sql',
    '100_stripe_pending_enrollment_client_confirmed.sql',
    '763_customer_billing_admin.sql',
    '764_canonical_enrollment_promo_assignments.sql',
    '765_restore_failed_customer_billing_promos.sql',
    '766_stackable_customer_billing_promos.sql',
    '767_remove_internal_customer_billing_sync_messages.sql',
    '768_annual_membership_auto_renewal.sql',
    '769_annual_membership_renewal_tracking.sql',
    '770_billing_charge_promo_metadata.sql',
    '771_membership_payment_allocation.sql',
    '772_payment_application_constraint_cleanup.sql',
    '773_enrollment_paid_through_billing_dates.sql',
    '774_household_monthly_invoicing.sql',
    '775_annual_membership_renewal_pricing.sql',
    '775_member_billing_audit_paging_indexes.sql',
    '776_annual_membership_renewal_promo_redemptions.sql',
    '777_media_release_optional.sql',
    '778_billing_canonical_migration_state.sql',
    '779_billing_modern_admin_idempotency.sql',
    '780_scheduling_enrollment_lifecycle_schema.sql',
    '781_billing_canonical_migration_contract.sql',
    '782_billing_legacy_endpoint_traffic.sql',
    '783_member_billing_drop_in_paging_index.sql',
    '784_billing_household_default_off.sql',
    '785_billing_migration_durable_safety.sql',
    '786_billing_household_default_remediation.sql',
    '787_billing_pause_credit_schema.sql',
    '788_billing_retirement_evidence.sql',
    '789_billing_payment_attempt_reservations.sql',
    '790_billing_migration_subscription_claims.sql',
    '791_billing_migration_accepted_baselines.sql',
    '792_billing_monthly_invoice_charge_credits.sql',
    '793_billing_webhook_claim_leases.sql',
    '794_billing_payment_attempt_reconciliation_fairness.sql',
    '795_billing_household_invoice_credit_applications.sql',
    '796_billing_retirement_invoice_parity.sql',
    '797_billing_payment_settlement_and_pass_idempotency.sql',
    '798_checkout_fulfillment_idempotency.sql',
    '799_billing_payment_stripe_invoice_link.sql',
    '806_storefront.sql',
  ])
})

test('restored base billing migrations retain their pinned legacy checksums', () => {
  const checksums = new Map([
    ['057_stripe_pending_enrollment.sql', '4195216797'],
    ['058_billing_stripe_links.sql', '924214856'],
    ['399_stripe_pending_enrollment_setup_mode.sql', '1900260129'],
    ['400_stripe_pending_enrollment_processing_status.sql', '3097831513'],
  ])
  for (const [filename, expected] of checksums) {
    const sql = fs.readFileSync(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8')
    assert.equal(legacyMigrationChecksum(sql), expected, filename)
  }
})

test('runtime accepts exact restored-base legacy billing files without rewriting migration history', async () => {
  const checksums = new Map([
    ['057_stripe_pending_enrollment.sql', '4195216797'],
    ['058_billing_stripe_links.sql', '924214856'],
    ['399_stripe_pending_enrollment_setup_mode.sql', '1900260129'],
    ['400_stripe_pending_enrollment_processing_status.sql', '3097831513'],
  ])
  const client = {
    async query() {
      throw new Error('legacy runtime verification must remain read-only')
    },
  }

  for (const [filename, storedChecksum] of checksums) {
    const migrationPath = new URL(`../../migrations/${filename}`, import.meta.url)
    assert.deepEqual(
      await verifyAppliedRequiredBillingMigration(client, {
        filename,
        migrationPath,
        storedChecksum,
      }),
      { status: 'legacy_verified', checksum: storedChecksum },
      filename,
    )

    await assert.rejects(
      verifyAppliedRequiredBillingMigration(client, {
        filename,
        migrationPath,
        storedChecksum,
        readFile: (path, encoding) => `${fs.readFileSync(path, encoding)}\n`,
      }),
      (error) => error.code === 'REQUIRED_BILLING_MIGRATION_CHECKSUM_MISMATCH',
      `${filename} must still fail closed if even one byte changes`,
    )
  }
})

test('runtime rejects historical checksum variants until deploy migration normalization runs', async () => {
  const historicalVariants = new Map([
    ['057_stripe_pending_enrollment.sql', ['3788120324', '322505987']],
    ['058_billing_stripe_links.sql', ['2266470195']],
  ])

  for (const [filename, storedChecksums] of historicalVariants) {
    for (const storedChecksum of storedChecksums) {
      await assert.rejects(
        verifyAppliedRequiredBillingMigration({ query: async () => ({ rows: [] }) }, {
          filename,
          migrationPath: new URL(`../../migrations/${filename}`, import.meta.url),
          storedChecksum,
        }),
        (error) => error.code === 'REQUIRED_BILLING_MIGRATION_CHECKSUM_MISMATCH',
        `${filename}:${storedChecksum}`,
      )
    }
  }
})

test('runtime accepts only pinned historical SHA-256 aliases after deploy normalization', async () => {
  const historicalVariants = new Map([
    ['057_stripe_pending_enrollment.sql', [
      'edf084bb143c4365728ec6fbcd8c462b88698c86bf403129ef55a23669e7d1e4',
      'ee89aad175bcc427b090cb80145a1502d11621fe98a89869fb8917db8b35e8c9',
    ]],
    ['058_billing_stripe_links.sql', [
      '1f0635f80093c1beea17030b9cfc4a469fc58de19bc06069663cb23678ba8dab',
    ]],
  ])
  const client = {
    async query() {
      throw new Error('historical runtime verification must remain read-only')
    },
  }

  for (const [filename, storedChecksums] of historicalVariants) {
    for (const storedChecksum of storedChecksums) {
      assert.deepEqual(
        await verifyAppliedRequiredBillingMigration(client, {
          filename,
          migrationPath: new URL(`../../migrations/${filename}`, import.meta.url),
          storedChecksum,
        }),
        { status: 'historical_verified', checksum: storedChecksum },
        `${filename}:${storedChecksum}`,
      )
    }
  }

  await assert.rejects(
    verifyAppliedRequiredBillingMigration(client, {
      filename: '058_billing_stripe_links.sql',
      migrationPath: new URL('../../migrations/058_billing_stripe_links.sql', import.meta.url),
      storedChecksum: '1f0635f80093c1beea17030b9cfc4a469fc58de19bc06069663cb23678ba8dab',
      readFile: (path, encoding) => `${fs.readFileSync(path, encoding)}\n`,
    }),
    (error) => error.code === 'REQUIRED_BILLING_MIGRATION_CHECKSUM_MISMATCH',
  )
})

test('runtime verifies SHA-256 or the exact legacy checksum without writing', async () => {
  const sql = 'SELECT 1;\n'
  const calls = []
  const client = {
    async query(statement, params) {
      calls.push({ statement: String(statement), params })
      return { rows: [{ checksum: params[1] }] }
    },
  }
  const common = {
    filename: '786_billing_household_default_remediation.sql',
    migrationPath: '/virtual/786.sql',
    fileExists: () => true,
    readFile: () => sql,
  }

  assert.deepEqual(
    await verifyAppliedRequiredBillingMigration(client, {
      ...common,
      storedChecksum: migrationChecksum(sql),
    }),
    { status: 'verified', checksum: migrationChecksum(sql) },
  )
  assert.equal(calls.length, 0)

  assert.deepEqual(
    await verifyAppliedRequiredBillingMigration(client, {
      ...common,
      storedChecksum: legacyMigrationChecksum(sql),
    }),
    { status: 'legacy_verified', checksum: legacyMigrationChecksum(sql) },
  )
  assert.equal(calls.length, 0)
})

test('runtime fails closed when deploy has not recorded a required migration and executes no SQL', async () => {
  const calls = []
  const client = {
    async query(statement, params) {
      calls.push({ statement: String(statement), params })
      throw new Error('runtime verification must not query')
    },
  }

  await assert.rejects(
    verifyRequiredBillingMigrationAtRuntime(client, {
      filename: '788_billing_retirement_evidence.sql',
      migrationPath: '/virtual/788.sql',
      isApplied: false,
      fileExists: () => true,
      readFile: () => 'CREATE TABLE forbidden_runtime_ddl (id bigint);\n',
    }),
    (error) => error.code === 'REQUIRED_BILLING_MIGRATION_NOT_APPLIED',
  )
  assert.deepEqual(calls, [])
})

test('runtime rejects missing required files and unknown required checksum drift', async () => {
  await assert.rejects(
    verifyAppliedRequiredBillingMigration({ query: async () => ({ rows: [] }) }, {
      filename: '786_billing_household_default_remediation.sql',
      migrationPath: '/missing/786.sql',
      storedChecksum: 'unknown',
      fileExists: () => false,
    }),
    (error) => error.code === 'REQUIRED_BILLING_MIGRATION_MISSING',
  )

  await assert.rejects(
    verifyAppliedRequiredBillingMigration({ query: async () => ({ rows: [] }) }, {
      filename: '786_billing_household_default_remediation.sql',
      migrationPath: '/virtual/786.sql',
      storedChecksum: 'unknown',
      fileExists: () => true,
      readFile: () => 'SELECT 1;\n',
    }),
    (error) => error.code === 'REQUIRED_BILLING_MIGRATION_CHECKSUM_MISMATCH',
  )
})

test('startup verifier checks every required checksum without applying migrations', async () => {
  const sqlByFile = new Map([
    ['first.sql', 'SELECT 1;\n'],
    ['second.sql', 'SELECT 2;\n'],
  ])
  const queries = []
  let released = false
  const client = {
    async query(statement, params) {
      queries.push({ statement: String(statement), params })
      return {
        rows: [...sqlByFile].map(([filename, sql]) => ({
          filename,
          checksum: migrationChecksum(sql),
        })),
      }
    },
    release() { released = true },
  }

  const result = await verifyRequiredBillingMigrationsAtRuntime({
    async connect() { return client },
  }, {
    migrationFiles: [...sqlByFile.keys()],
    migrationsDirectory: '/virtual',
    fileExists: (filename) => sqlByFile.has(filename.split('/').pop()),
    readFile: (filename) => sqlByFile.get(filename.split('/').pop()),
  })

  assert.equal(result.ready, true)
  assert.deepEqual(result.migrations.map(({ filename }) => filename), [...sqlByFile.keys()])
  assert.equal(queries.length, 1)
  assert.match(queries[0].statement, /^SELECT filename, checksum/m)
  assert.doesNotMatch(queries[0].statement, /\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE)\b/i)
  assert.equal(released, true)
})

test('startup verifier rejects checksum drift for the complete required set', async () => {
  let released = false
  const client = {
    async query() {
      return { rows: [{ filename: 'required.sql', checksum: 'stale-checksum' }] }
    },
    release() { released = true },
  }

  await assert.rejects(
    verifyRequiredBillingMigrationsAtRuntime({
      async connect() { return client },
    }, {
      migrationFiles: ['required.sql'],
      migrationsDirectory: '/virtual',
      fileExists: () => true,
      readFile: () => 'SELECT 1;\n',
    }),
    (error) => error.code === 'REQUIRED_BILLING_MIGRATION_CHECKSUM_MISMATCH',
  )
  assert.equal(released, true)
})

test('server verifies required billing checksums before readiness and listen even when boot migrations are skipped', () => {
  const source = fs.readFileSync(new URL('../../server.js', import.meta.url), 'utf8')
  const start = source.indexOf('const startServer = async () =>')
  const end = source.indexOf('// ========== TEMPORARY MIGRATION ENDPOINT', start)
  const startup = source.slice(start, end)

  const initialize = startup.indexOf('await initDatabase()')
  const verify = startup.indexOf('await verifyRequiredBillingMigrationsAtRuntime(pool)')
  const readiness = startup.indexOf('await assertRequiredBillingSchema(pool)')
  const listen = startup.indexOf('server.listen(')
  assert.ok(initialize >= 0 && initialize < verify)
  assert.ok(verify < readiness)
  assert.ok(readiness < listen)

  const skipBranchStart = source.indexOf("if (process.env.SKIP_PLATFORM_BOOT_MIGRATIONS === 'true')")
  const skipBranchEnd = source.indexOf('// Migration 090 removed', skipBranchStart)
  const skipBranch = source.slice(skipBranchStart, skipBranchEnd)
  assert.match(skipBranch, /Skipping heavyweight platform boot migrations/)
  assert.doesNotMatch(skipBranch, /verifyRequiredBillingMigrationsAtRuntime/)
  assert.match(source, /if \(isRequiredBillingStartupError\(error\)\) throw error/)
})

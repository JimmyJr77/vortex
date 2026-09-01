import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { ensureBillingAccessRecoverySchema } from '../billingAccessRecovery.js'
import { ensureBillingAdminActionSchema } from '../billingAdminActions.js'
import { ensureBillingChargeSchema } from '../billingChargeSchema.js'
import { ensureHouseholdMonthlyInvoiceSchema } from '../householdMonthlyInvoice.js'
import {
  ensureBillingStripeLinksSchema,
  ensureStripeBillingSchema,
} from '../stripeBilling.js'
import {
  ensureBillingRecurringSchema,
  ensureStripeCatalogSchema,
} from '../stripeCatalogSync.js'
import { ensureStripeOperationsSchema } from '../stripeOperations.js'
import { ensureEnrollmentLifecycleColumns } from '../../scheduling/enrollmentLifecycle.js'
import { ensurePauseCreditTable } from '../../scheduling/pauseEnrollmentBilling.js'
import { buildAdminMemberEnrollments } from '../../scheduling/adminEnrollmentsView.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const billingDirectory = path.join(testDirectory, '..')
const schedulingDirectory = path.join(billingDirectory, '..', 'scheduling')

test('billing production modules contain no request-time migration loader or schema DDL', () => {
  const productionModules = fs.readdirSync(billingDirectory)
    .filter((filename) => filename.endsWith('.js'))

  for (const filename of productionModules) {
    const source = fs.readFileSync(path.join(billingDirectory, filename), 'utf8')
    assert.doesNotMatch(
      source,
      /\breadFileSync\b|(?:\.\.\/)?migrations\//,
      `${filename} must not load migration files at request time`,
    )
    assert.doesNotMatch(
      source,
      /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|FUNCTION|TRIGGER|VIEW|MATERIALIZED\s+VIEW|EXTENSION|CONSTRAINT)\b/i,
      `${filename} must not contain request-time schema DDL`,
    )
  }
})

test('modern enrollment price adjustments do not depend on the legacy account view', () => {
  const source = fs.readFileSync(path.join(billingDirectory, 'customerBillingAdjustments.js'), 'utf8')
  assert.doesNotMatch(source, /buildBillingAccountView|billingAccountView\.js/)
  assert.match(source, /loadCanonicalFinancialSnapshot/)
})

test('canonical household pricing is read-only by default and migration audit opts out of compatibility DDL', () => {
  const pricingSource = fs.readFileSync(path.join(billingDirectory, 'familyEnrollmentPricing.js'), 'utf8')
  const auditSource = fs.readFileSync(path.join(billingDirectory, 'canonicalBillingMigrationAudit.js'), 'utf8')

  assert.match(pricingSource, /ensureSchema\s*=\s*false/)
  assert.match(
    auditSource,
    /resolveFamilyEnrollmentPricing\([\s\S]*?ensureSchema:\s*false/,
  )
})

test('billing-adjacent enrollment modules contain no request-time schema DDL', () => {
  for (const filename of ['enrollmentLifecycle.js', 'pauseEnrollmentBilling.js']) {
    const source = fs.readFileSync(path.join(schedulingDirectory, filename), 'utf8')
    assert.doesNotMatch(
      source,
      /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|FUNCTION|TRIGGER|VIEW|MATERIALIZED\s+VIEW|EXTENSION|CONSTRAINT)\b/i,
      `${filename} must not contain request-time schema DDL`,
    )
  }
})

test('public billing schema compatibility hooks perform no database queries', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      throw new Error('schema compatibility hooks must not query')
    },
  }
  const hooks = [
    ensureBillingAccessRecoverySchema,
    ensureBillingAdminActionSchema,
    ensureBillingChargeSchema,
    ensureHouseholdMonthlyInvoiceSchema,
    ensureBillingStripeLinksSchema,
    ensureStripeBillingSchema,
    ensureBillingRecurringSchema,
    ensureStripeCatalogSchema,
    ensureStripeOperationsSchema,
    ensureEnrollmentLifecycleColumns,
    ensurePauseCreditTable,
  ]

  for (const hook of hooks) await hook(pool)
  assert.equal(queryCount, 0)
})

test('customer enrollment projection is strictly read-only', async () => {
  const statements = []
  const pool = {
    async query(sql) {
      const statement = String(sql)
      statements.push(statement)
      assert.doesNotMatch(
        statement,
        /\b(?:CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/i,
        'customer billing enrollment reads must not mutate data or schema',
      )
      if (statement.includes('information_schema.tables')) {
        return { rows: [{ table_name: 'programs' }] }
      }
      if (statement.includes("table_name = 'program'")) {
        return { rows: [{ column_name: 'programs_id' }] }
      }
      if (statement.includes("table_name = 'scheduling_form'")) {
        return { rows: [{ column_name: 'programs_id' }, { column_name: 'program_id' }] }
      }
      if (statement.includes('FROM member WHERE id = $1')) {
        return {
          rows: [{ id: 11, first_name: 'Read', last_name: 'Only', family_id: 7 }],
        }
      }
      return { rows: [] }
    },
  }

  const result = await buildAdminMemberEnrollments(pool, 11, { readOnly: true })
  assert.deepEqual(result, {
    member: { id: 11, firstName: 'Read', lastName: 'Only' },
    rows: [],
  })
  assert.ok(statements.length > 0)
})

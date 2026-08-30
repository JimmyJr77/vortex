import test from 'node:test'
import assert from 'node:assert/strict'
import { RUNTIME_COMPATIBILITY_MIGRATIONS } from '../initTables.js'

test('platform boot includes every schema contract required by current Admin routes', () => {
  assert.deepEqual(RUNTIME_COMPATIBILITY_MIGRATIONS, [
    'add_scheduling_member_pricing.sql',
    'add_program_pricing_defaults.sql',
    '763_customer_billing_admin.sql',
  ])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { RUNTIME_COMPATIBILITY_MIGRATIONS } from '../initTables.js'

test('platform boot includes every schema contract required by current Admin routes', () => {
  assert.deepEqual(RUNTIME_COMPATIBILITY_MIGRATIONS, [
    'add_scheduling_member_pricing.sql',
    'add_program_pricing_defaults.sql',
    '763_customer_billing_admin.sql',
    '764_canonical_enrollment_promo_assignments.sql',
    '765_restore_failed_customer_billing_promos.sql',
    '766_stackable_customer_billing_promos.sql',
    '767_remove_internal_customer_billing_sync_messages.sql',
    '768_annual_membership_auto_renewal.sql',
    '769_annual_membership_renewal_tracking.sql',
  ])
})

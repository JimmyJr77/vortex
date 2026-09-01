#!/usr/bin/env node

/**
 * Retired unsafe compatibility command.
 *
 * Household collection cutovers must use the durable canonical migration
 * state machine. Keeping this inert stub makes direct invocations fail before
 * loading database or Stripe credentials while older deployment automation is
 * being removed.
 */

console.error(
  'billing:migrate-household-invoices is retired. Use the canonical billing migration audit/prepare/advance commands.',
)
process.exitCode = 1

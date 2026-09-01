import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('enrollment and annual checkout contain no Stripe Subscription creation API', () => {
  for (const relativePath of [
    '../stripeEnrollmentCheckout.js',
    '../annualMembershipCheckout.js',
  ]) {
    const checkoutSource = source(relativePath)
    assert.doesNotMatch(checkoutSource, /\.subscriptions\s*\.\s*create\s*\(/)
    assert.doesNotMatch(checkoutSource, /mode\s*:\s*['"]subscription['"]/)
  }
})

test('the obsolete household migration command is absent and its direct script is inert', () => {
  const packageJson = JSON.parse(source('../../package.json'))
  assert.equal(packageJson.scripts?.['billing:migrate-household-invoices'], undefined)

  const retiredScript = source('../../scripts/migrate-household-monthly-billing.mjs')
  assert.match(retiredScript, /process\.exitCode = 1/)
  assert.doesNotMatch(retiredScript, /from ['"]pg['"]|getStripeClient|\.subscriptions\s*\.|\.query\s*\(/)
})

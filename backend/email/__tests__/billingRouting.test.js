import test from 'node:test'
import assert from 'node:assert/strict'

import { isFinancialCategory } from '../emailCategories.js'
import { billingMailbox } from '../emailPolicy.js'
import { resolveValidatedReplyTo } from '../sendEmail.js'

function withBillingEnv(values, fn) {
  const keys = ['BILLING_REPLY_TO', 'BILLING_ALERT_EMAIL', 'VORTEX_ROOT_DOMAIN', 'SMTP_REPLY_TO']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    Object.assign(process.env, values)
    return fn()
  } finally {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('financial email categories always reply to the billing mailbox', () => {
  withBillingEnv(
    {
      BILLING_REPLY_TO: 'billing@vortexathletics.com',
      SMTP_REPLY_TO: 'frontdesk@vortexathletics.com',
    },
    () => {
      for (const category of ['enrollment_receipt', 'payment_receipt', 'payment_failed', 'refund_receipt', 'billing_alert']) {
        assert.equal(isFinancialCategory(category), true)
        assert.equal(resolveValidatedReplyTo('personal@example.com', category), 'billing@vortexathletics.com')
      }
    },
  )
})

test('billing mailbox defaults to billing on the Vortex root domain', () => {
  withBillingEnv({}, () => {
    assert.equal(billingMailbox(), 'billing@vortexathletics.com')
    assert.equal(resolveValidatedReplyTo(null, 'payment_failed'), 'billing@vortexathletics.com')
  })
})

test('nonfinancial mail keeps the normal monitored reply-to', () => {
  withBillingEnv({ SMTP_REPLY_TO: 'frontdesk@vortexathletics.com' }, () => {
    assert.equal(resolveValidatedReplyTo(null, 'account_welcome'), 'frontdesk@vortexathletics.com')
  })
})

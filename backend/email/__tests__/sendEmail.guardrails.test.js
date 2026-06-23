import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendEmail } from '../sendEmail.js'

// These guardrails run BEFORE any SMTP transport is created, so they are testable
// without SMTP credentials. No email pool is registered, so suppression/cooldown are
// no-ops and do not interfere.

const base = { to: 'parent@gmail.com', subject: 'Subject', text: 'Body', html: '<p>Body</p>' }

test('rejects an invalid recipient', async () => {
  await assert.rejects(() => sendEmail({ ...base, to: 'not-an-email' }), /Invalid recipient/)
})

test('rejects an unknown category', async () => {
  await assert.rejects(() => sendEmail({ ...base, category: 'made_up' }), /Unknown email category/)
})

test('rejects promotional content in a transactional email', async () => {
  await assert.rejects(
    () => sendEmail({ ...base, category: 'parent_email_verification', text: 'Get 20% off now' }),
    /promotional content/,
  )
})

test('rejects a marketing unsubscribe link on a transactional email', async () => {
  await assert.rejects(
    () =>
      sendEmail({
        ...base,
        category: 'parent_account_invitation',
        listUnsubscribeUrl: 'https://news.vortexathletics.com/email/unsubscribe/x',
      }),
    /must not include a marketing unsubscribe/,
  )
})

test('rejects a marketing email without a one-click unsubscribe URL', async () => {
  await assert.rejects(
    () => sendEmail({ ...base, category: 'newsletter' }),
    /requires a one-click unsubscribe/,
  )
})

test('a clean transactional email passes guardrails (fails later only on missing SMTP)', async () => {
  // With no SMTP configured, the call should fail at transport creation, NOT at guardrails.
  await assert.rejects(
    () => sendEmail({ ...base, category: 'parent_email_verification' }),
    (err) => {
      assert.ok(!/promotional|unsubscribe|Unknown|Invalid recipient/.test(err.message), err.message)
      return true
    },
  )
})

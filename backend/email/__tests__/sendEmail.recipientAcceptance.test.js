import test from 'node:test'
import assert from 'node:assert/strict'

import { smtpAcceptedRecipient } from '../sendEmail.js'

test('accepts a recipient only when SMTP explicitly accepts that address', () => {
  assert.equal(
    smtpAcceptedRecipient({ accepted: ['Member@Example.com'], rejected: [] }, 'member@example.com'),
    true,
  )
})

test('rejects a reset delivery when SMTP rejects or omits its recipient', () => {
  assert.equal(
    smtpAcceptedRecipient({ accepted: [], rejected: ['member@example.com'] }, 'member@example.com'),
    false,
  )
  assert.equal(
    smtpAcceptedRecipient({ accepted: ['other@example.com'], rejected: [] }, 'member@example.com'),
    false,
  )
})

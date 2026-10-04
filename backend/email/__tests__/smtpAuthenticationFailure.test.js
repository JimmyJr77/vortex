import test from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import { registerEmailPool } from '../emailDeliveryStore.js'
import { isSmtpAuthenticationFailure } from '../sendEmail.js'

test('SMTP login errors are not recipient bounces', () => {
  for (const responseCode of [530, 534, 535, 538]) {
    assert.equal(isSmtpAuthenticationFailure({ responseCode }), true)
  }
  assert.equal(isSmtpAuthenticationFailure({ code: 'EAUTH', responseCode: 550 }), true)
  assert.equal(isSmtpAuthenticationFailure({ code: 'EENVELOPE', responseCode: 550 }), false)
})

test('534 is logged as failed without creating a recipient suppression', async () => {
  const original = nodemailer.createTransport
  const oldUser = process.env.SMTP_USER
  const oldPass = process.env.SMTP_PASS
  const writes = []
  process.env.SMTP_USER = 'sender@example.com'
  process.env.SMTP_PASS = 'test-password'
  nodemailer.createTransport = () => ({ sendMail: async () => { throw Object.assign(new Error('App password required'), { responseCode: 534 }) } })
  registerEmailPool({ query: async (sql, values) => {
    writes.push({ sql, values })
    return { rows: sql.includes('INSERT INTO email_delivery') ? [{ id: 1 }] : [] }
  } })
  try {
    const { sendEmail } = await import('../sendEmail.js?auth-regression')
    await assert.rejects(sendEmail({ to: 'team@example.com', subject: 'Registration', text: 'Enrollment', html: '<p>Enrollment</p>', category: 'registration_alert', skipPolicy: true }), /SMTP login/)
    assert.equal(writes.some(({ sql }) => sql.includes('INSERT INTO email_suppression')), false)
    const update = writes.find(({ sql }) => sql.includes('UPDATE email_delivery'))
    assert.equal(update.values[1], 'failed')
    assert.equal(update.values[3], 'auth_failed')
  } finally {
    nodemailer.createTransport = original
    registerEmailPool(null)
    if (oldUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = oldUser
    if (oldPass === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = oldPass
  }
})

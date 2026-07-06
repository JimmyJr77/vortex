import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMentions, resolveTwilioCredentials, shouldSendCriticalSms } from '../criticalAlerts.js'

describe('criticalAlerts', () => {
  it('parses user and member mention tokens', () => {
    const mentions = parseMentions('Hi @user:12 and @member:34')
    assert.equal(mentions.length, 2)
    assert.deepEqual(mentions[0], { userId: 12 })
    assert.deepEqual(mentions[1], { memberId: 34 })
  })

  it('prefers API key credentials over auth token', () => {
    const creds = resolveTwilioCredentials({
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_FROM_NUMBER: '+15551234567',
      TWILIO_API_KEY_SID: 'SK123',
      TWILIO_API_KEY_SECRET: 'secret',
      TWILIO_AUTH_TOKEN: 'fallback',
    })
    assert.equal(creds.ok, true)
    assert.equal(creds.authMode, 'api_key')
    assert.equal(creds.basicUser, 'SK123')
    assert.equal(creds.basicPass, 'secret')
  })

  it('falls back to auth token when API key is missing', () => {
    const creds = resolveTwilioCredentials({
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_FROM_NUMBER: '+15551234567',
      TWILIO_AUTH_TOKEN: 'main_token',
    })
    assert.equal(creds.ok, true)
    assert.equal(creds.authMode, 'auth_token')
    assert.equal(creds.basicUser, 'AC123')
    assert.equal(creds.basicPass, 'main_token')
  })

  it('returns not configured without account sid, from number, or credentials', () => {
    assert.equal(resolveTwilioCredentials({}).ok, false)
    assert.equal(
      resolveTwilioCredentials({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_FROM_NUMBER: '+15551234567',
      }).ok,
      false,
    )
  })

  it('gates SMS on sender flag and recipient opt-in', () => {
    const pref = { allow_critical_sms: true, phone_e164: '+15551234567' }
    assert.equal(shouldSendCriticalSms(false, pref), false)
    assert.equal(shouldSendCriticalSms(true, pref), true)
    assert.equal(shouldSendCriticalSms(true, { allow_critical_sms: false, phone_e164: '+15551234567' }), false)
    assert.equal(shouldSendCriticalSms(true, { allow_critical_sms: true, phone_e164: null }), false)
  })
})

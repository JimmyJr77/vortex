import test from 'node:test'
import assert from 'node:assert/strict'
import { sendDropInConfirmationNotifications } from '../dropInNotificationEmail.js'

function notificationPool(overrides = {}) {
  const state = {
    member_confirmation_email_sent_at: null,
    team_notification_email_sent_at: null,
  }
  const row = {
    id: 42,
    member_id: 7,
    first_name: 'Jamie',
    last_name: 'Rivera',
    email: 'jamie@example.com',
    phone: '4435550100',
    class_date: '2026-08-15',
    status: 'confirmed',
    benefit_type: 'free_trial',
    amount_cents: 0,
    class_name: 'Beginner Gymnastics',
    program_name: 'Gymnastics',
    start_time: '09:00',
    end_time: '10:00',
    ...overrides,
  }
  return {
    state,
    async query(sql) {
      if (sql.includes('SELECT d.id')) return { rows: [{ ...row, ...state }] }
      if (sql.includes('member_confirmation_email_sent_at = now()')) state.member_confirmation_email_sent_at = new Date()
      if (sql.includes('team_notification_email_sent_at = now()')) state.team_notification_email_sent_at = new Date()
      return { rows: [] }
    },
  }
}

test('confirmed drop-in sends one member receipt and one team alert exactly once', async () => {
  const pool = notificationPool()
  const deliveries = []
  const send = async (message) => { deliveries.push(message); return { sent: true } }

  await sendDropInConfirmationNotifications(pool, 42, { send, teamEmail: 'team@vortexathletics.com' })
  await sendDropInConfirmationNotifications(pool, 42, { send, teamEmail: 'team@vortexathletics.com' })

  assert.equal(deliveries.length, 2)
  assert.equal(deliveries[0].to, 'jamie@example.com')
  assert.equal(deliveries[0].category, 'enrollment_receipt')
  assert.match(deliveries[0].text, /Saturday, August 15, 2026/)
  assert.equal(deliveries[1].to, 'team@vortexathletics.com')
  assert.equal(deliveries[1].category, 'registration_alert')
  assert.equal(deliveries[1].skipPolicy, true)
})

test('account-required drop-in does not send acceptance notifications', async () => {
  const pool = notificationPool({ status: 'account_required' })
  const deliveries = []
  const result = await sendDropInConfirmationNotifications(pool, 42, {
    send: async (message) => { deliveries.push(message) },
  })
  assert.equal(result.skipped, true)
  assert.equal(deliveries.length, 0)
})

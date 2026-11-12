import test from 'node:test'
import assert from 'node:assert/strict'
import { findPromotionalContent } from '../../email/emailCategories.js'
import { sendDropInConfirmationNotifications } from '../dropInNotificationEmail.js'

function notificationPool(overrides = {}, guardianRows = [], acceptedKeys = []) {
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
    async query(sql, params) {
      if (sql.includes('SELECT d.id')) return { rows: [{ ...row, ...state }] }
      if (sql.includes('FROM parent_guardian_authority')) {
        assert.deepEqual(params, [row.member_id])
        return { rows: guardianRows }
      }
      if (sql.includes('FROM email_delivery')) {
        assert.match(sql, /accepted_at IS NOT NULL/)
        return { rows: acceptedKeys.includes(params[0]) ? [{}] : [] }
      }
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
  assert.match(deliveries[1].text, /Booking email: jamie@example\.com/)
  assert.match(deliveries[1].text, /Booking phone: 4435550100/)
})

test('only the team alert includes guardian outreach details with the class date and time', async () => {
  const pool = notificationPool({
    class_date: new Date('2026-08-15T00:00:00Z'),
    benefit_type: 'promo_code',
    promo_code: 'SUMMER-SALE',
  }, [
    { first_name: 'Morgan', last_name: 'Rivera', email: 'parent@example.com', phone: '4435550101' },
  ])
  const deliveries = []
  await sendDropInConfirmationNotifications(pool, 42, {
    send: async (message) => { deliveries.push(message); return { sent: true } },
  })
  const [receipt, alert] = deliveries
  assert.doesNotMatch(receipt.text, /Morgan|parent@example\.com|4435550101/)
  assert.equal(alert.subject, 'New single-day enrollment: Beginner Gymnastics')
  assert.match(alert.text, /Athlete: Jamie Rivera/)
  assert.match(alert.text, /Parent or guardian: Morgan Rivera/)
  assert.match(alert.text, /Parent or guardian email: parent@example\.com/)
  assert.match(alert.html, /4435550101/)
  assert.match(alert.text, /Class: Beginner Gymnastics \(Gymnastics\)/)
  assert.match(alert.text, /Saturday, August 15, 2026 · 9:00 AM–10:00 AM/)
  assert.deepEqual(findPromotionalContent(receipt.subject, receipt.text, alert.subject, alert.text), [])
})

test('a failed family receipt still allows the team alert and skipped sends do not get a sent timestamp', async () => {
  const pool = notificationPool()
  const categories = []
  await assert.rejects(sendDropInConfirmationNotifications(pool, 42, {
    send: async (message) => {
      categories.push(message.category)
      if (message.category === 'enrollment_receipt') throw new Error('SMTP recipient rejected')
      return { sent: true }
    },
  }), /SMTP recipient rejected/)
  assert.deepEqual(categories, ['enrollment_receipt', 'registration_alert'])
  assert.equal(pool.state.member_confirmation_email_sent_at, null)
  assert.ok(pool.state.team_notification_email_sent_at)

  const result = await sendDropInConfirmationNotifications(pool, 42, {
    send: async (message) => {
      assert.equal(message.category, 'enrollment_receipt')
      return { sent: false, suppressed: true, reason: 'hard_bounce' }
    },
  })
  assert.deepEqual(result, { memberSent: false, teamSent: true, skipped: false })
  assert.equal(pool.state.member_confirmation_email_sent_at, null)
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

test('duplicate drop-in attempts only backfill timestamps for accepted mail', async () => {
  const pool = notificationPool({}, [], ['drop-in-team-notification-42-team@vortexathletics.com'])
  const result = await sendDropInConfirmationNotifications(pool, 42, {
    teamEmail: 'team@vortexathletics.com',
    send: async () => ({ sent: false, reason: 'duplicate' }),
  })

  assert.deepEqual(result, { memberSent: false, teamSent: true, skipped: false })
  assert.equal(pool.state.member_confirmation_email_sent_at, null)
  assert.ok(pool.state.team_notification_email_sent_at)
})

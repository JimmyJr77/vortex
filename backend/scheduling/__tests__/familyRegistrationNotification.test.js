import test from 'node:test'
import assert from 'node:assert/strict'
import {
  notifyFamilyEnrollmentRegistrations,
  sendRegistrationNotification,
} from '../registrationNotificationEmail.js'

test('family alerts group by athlete, ignore missing signup IDs, and isolate failures', async () => {
  const calls = []
  const warnings = []
  await notifyFamilyEnrollmentRegistrations({}, [
    { memberId: 1, schedulingSignupId: 11 },
    { memberId: 1, schedulingSignupId: 12 },
    { memberId: 1, schedulingSignupId: 11 },
    { memberId: 2, schedulingSignupId: 13 },
    { memberId: 3, schedulingSignupId: null },
  ], {
    send: async (_pool, input) => {
      calls.push(input.signupIds)
      if (calls.length === 1) throw new Error('SMTP unavailable')
      return { sent: true }
    },
    logger: { warn: (...args) => warnings.push(args) },
  })
  assert.deepEqual(calls, [[11, 12], [13]])
  assert.equal(warnings.length, 1)
})

function registrationRow(overrides = {}) {
  return {
    id: 11,
    member_id: 7,
    slot_group_id: null,
    first_name: 'Jamie',
    last_name: 'Rivera',
    email: 'athlete@example.com',
    phone: '4435550100',
    class_name: 'Beginner Gymnastics',
    program_name: 'Gymnastics',
    schedule_mode: 'weekly',
    day_of_week: 5,
    start_time: '18:00:00',
    end_time: '19:00:00',
    enrollment_start_date: '2026-11-13',
    status: 'confirmed',
    charged_cents: 1500,
    responses: {},
    ...overrides,
  }
}

function registrationPool({ registrations, slots = [], guardians = [] }) {
  return {
    async query(sql, parameters) {
      if (sql.includes('FROM information_schema.tables')) return { rows: [{ table_name: 'programs' }] }
      if (sql.includes('FROM information_schema.columns')) return { rows: [{ column_name: 'programs_id' }] }
      if (sql.includes('FROM scheduling_signup s')) {
        return { rows: registrations.filter(row => parameters[0].includes(row.id)) }
      }
      if (sql.includes('FROM scheduling_time_slot')) {
        return { rows: slots.filter(row => parameters[0].includes(row.slot_group_id)) }
      }
      if (sql.includes('FROM parent_guardian_authority')) {
        assert.deepEqual(parameters, [7])
        return { rows: guardians }
      }
      assert.fail(`Unexpected registration query: ${sql}`)
    },
  }
}

async function captureRegistrationAlert(pool, signupIds) {
  const messages = []
  const result = await sendRegistrationNotification(pool, {
    signupIds,
    to: 'team@vortexathletics.com',
    send: async message => {
      messages.push(message)
      return { sent: true }
    },
  })
  assert.equal(result.sent, true)
  assert.equal(messages.length, 1)
  return messages[0]
}

test('team registration alert includes canonical guardian and every class occurrence', async () => {
  const pool = registrationPool({
    registrations: [
      registrationRow({
        slot_group_id: 31,
        class_name: 'Tumbling <Level 1>',
        program_name: 'Gymnastics & Movement',
        enrollment_start_date: '2026-11-16',
        responses: { parent_first_name: 'Outdated', parent_email: 'old@example.com' },
      }),
      registrationRow({ id: 12, class_name: 'Balance Basics', status: 'waitlisted', charged_cents: 0 }),
    ],
    slots: [
      { slot_group_id: 31, schedule_mode: 'weekly', day_of_week: 1, start_time: '16:00:00', end_time: '17:00:00' },
      { slot_group_id: 31, schedule_mode: 'weekly', day_of_week: 3, start_time: '17:30:00', end_time: '18:30:00' },
    ],
    guardians: [{ id: 8, first_name: 'Riley', last_name: 'Rivera & Co', email: 'parent@example.com', phone: '4435550101' }],
  })

  const message = await captureRegistrationAlert(pool, [12, 11, 11])
  assert.equal(message.to, 'team@vortexathletics.com')
  assert.equal(message.subject, 'New class registration')
  assert.equal(message.category, 'registration_alert')
  assert.equal(message.idempotencyKey, 'registration-alert-11-12-team@vortexathletics.com')
  assert.match(message.text, /Athlete: Jamie Rivera/)
  assert.match(message.text, /Parent or guardian: Riley Rivera & Co · parent@example\.com · 4435550101/)
  assert.doesNotMatch(message.text, /old@example\.com|athlete@example\.com/)
  assert.match(message.text, /Tumbling <Level 1> \(Gymnastics & Movement\).*Monday · 16:00–17:00; Wednesday · 17:30–18:30.*Starts 2026-11-16.*confirmed/)
  assert.match(message.text, /Balance Basics.*Friday.*6:00 PM–7:00 PM.*waitlisted/)
  assert.match(message.html, /Riley Rivera &amp; Co · parent@example\.com · 4435550101/)
  assert.match(message.html, /Tumbling &lt;Level 1&gt; \(Gymnastics &amp; Movement\)/)
})

test('team registration alert falls back to submitted parent details when no guardian is linked', async () => {
  const pool = registrationPool({
    registrations: [registrationRow({
      member_id: null,
      field_responses: {
        parent_first_name: 'Leslie',
        parent_last_name: 'Rivera',
        parent_email: 'legacy-parent@example.com',
        parent_phone: '4435550102',
      },
    })],
  })

  const message = await captureRegistrationAlert(pool, [11])
  assert.match(message.text, /Parent or guardian: Leslie Rivera · legacy-parent@example\.com · 4435550102/)
  assert.match(message.html, /Leslie Rivera · legacy-parent@example\.com · 4435550102/)
})

test('team registration alert labels the adult signup contact without inventing a guardian', async () => {
  const pool = registrationPool({ registrations: [registrationRow()] })

  const message = await captureRegistrationAlert(pool, [11])
  assert.doesNotMatch(message.text, /Parent or guardian/i)
  assert.match(message.text, /Registration email: athlete@example\.com/)
  assert.match(message.text, /Registration phone: 4435550100/)
  assert.match(message.html, /Registration email.*athlete@example\.com/)
  assert.match(message.html, /Registration phone.*4435550100/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateInTimeZone,
  renderDailyRosterEmail,
  validateRosterDate,
} from '../dailyRoster.js'

test('dateInTimeZone uses the Eastern calendar date', () => {
  assert.equal(dateInTimeZone(new Date('2026-01-01T03:30:00Z')), '2025-12-31')
  assert.equal(dateInTimeZone(new Date('2026-07-31T12:00:00Z')), '2026-07-31')
})

test('validateRosterDate rejects malformed and impossible dates', () => {
  assert.equal(validateRosterDate('2026-07-31'), '2026-07-31')
  assert.equal(validateRosterDate('07/31/2026'), null)
  assert.equal(validateRosterDate('2026-02-30'), null)
})

test('daily roster email groups athletes and escapes roster data', () => {
  const result = renderDailyRosterEmail({
    date: '2026-07-31',
    dateLabel: 'Friday, July 31, 2026',
    classCount: 1,
    athleteCount: 1,
    newRegistrationCount: 1,
    newRegistrations: [{
      name: 'New <Athlete>',
      className: 'Ninja & Tumbling',
      status: 'confirmed',
    }],
    classes: [{
      startTime: '09:00',
      timeLabel: '9:00 AM–10:00 AM',
      className: 'Ninja <Level 1>',
      programName: 'Youth',
      athleteCount: 1,
      athletes: [{ name: 'Sam & Lee' }],
    }],
  })

  assert.match(result.subject, /Friday, July 31, 2026/)
  assert.match(result.text, /Sam & Lee/)
  assert.match(result.html, /Ninja &lt;Level 1&gt;/)
  assert.match(result.html, /Sam &amp; Lee/)
  assert.match(result.html, /New &lt;Athlete&gt;/)
  assert.match(result.text, /New registrations: 1/)
})

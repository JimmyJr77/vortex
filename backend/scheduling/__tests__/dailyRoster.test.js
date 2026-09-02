import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateInTimeZone,
  mergeDailyEnrollmentAthletes,
  renderDailyRosterEmail,
  validateRosterDate,
} from '../dailyRoster.js'

test('dateInTimeZone uses the Eastern calendar date', () => {
  assert.equal(dateInTimeZone(new Date('2026-01-01T03:30:00Z')), '2025-12-31')
  assert.equal(dateInTimeZone(new Date('2026-07-31T12:00:00Z')), '2026-07-31')
})

test('daily enrollments combine monthly and drop-in attendees without duplicating a member', () => {
  const monthly = [
    { signupId: 1, source: 'scheduling', memberId: 9, firstName: 'Alex', lastName: 'Kim', name: 'Alex Kim', email: 'alex@example.com', enrollmentType: 'monthly' },
    { signupId: 2, source: 'scheduling', memberId: 10, firstName: 'Sam', lastName: 'Lee', name: 'Sam Lee', email: 'sam@example.com', enrollmentType: 'temporary_block' },
  ]
  const dropIns = [
    { signupId: 12, source: 'drop_in', memberId: 9, firstName: 'Alex', lastName: 'Kim', name: 'Alex Kim', email: 'alex@example.com', enrollmentType: 'drop_in' },
    { signupId: 13, source: 'drop_in', memberId: 11, firstName: 'Jo', lastName: 'Ng', name: 'Jo Ng', email: 'jo@example.com', enrollmentType: 'drop_in' },
  ]

  const result = mergeDailyEnrollmentAthletes(monthly, dropIns)
  assert.equal(result.length, 3)
  assert.equal(result.find((row) => row.memberId === 9)?.source, 'drop_in')
  assert.deepEqual(result.map((row) => row.name), ['Alex Kim', 'Sam Lee', 'Jo Ng'])
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

test('manual schedule email contains only the selected day roster', () => {
  const result = renderDailyRosterEmail({
    date: '2026-07-31',
    dateLabel: 'Friday, July 31, 2026',
    classCount: 1,
    athleteCount: 1,
    newRegistrationCount: 1,
    newRegistrations: [{ name: 'Unrelated New Athlete', className: 'Another class', status: 'confirmed' }],
    classes: [{
      startTime: '09:00',
      timeLabel: '9:00 AM–10:00 AM',
      className: 'Ninja Level 1',
      programName: 'Youth',
      athleteCount: 1,
      athletes: [{ name: 'Sam Lee' }],
    }],
  }, { includeNewRegistrations: false })

  assert.match(result.text, /Sam Lee/)
  assert.doesNotMatch(result.text, /New registrations|Unrelated New Athlete/)
  assert.doesNotMatch(result.html, /New registrations|Unrelated New Athlete/)
})

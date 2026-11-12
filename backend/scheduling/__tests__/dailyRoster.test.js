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

test('daily report shows inquiry, enrollment and billing details before the highlighted single-day roster', () => {
  const result = renderDailyRosterEmail({
    date: '2026-11-12',
    dateLabel: 'Thursday, November 12, 2026',
    classCount: 1,
    athleteCount: 2,
    report: {
      inquiries: [{
        contactName: 'Nell Silva', contactEmail: 'nell@example.com', contactPhone: '555-0100',
        contactRole: 'parent', children: [{ name: 'Alex', age: 0 }, { name: 'Sam', age: 4 }],
        interest: 'Twisters & Tumbling',
      }],
      enrollees: [{
        name: 'Jaime Liu', age: 7, className: 'Twisters', programName: 'Gymnastics',
        scheduleLabel: 'Monday · 16:00–17:00; Wednesday · 17:00–18:00', enrollmentStartDate: '2026-11-16',
        guardians: [{ name: 'Kim Liu', email: 'kim@example.com', phone: '555-0102' }],
      }],
      adds: [{ name: 'Terry Lee', className: 'Cyclones', status: 'Promoted from waitlist' }],
      drops: [{ name: 'Riley Kim', className: 'Twisters', status: 'Cancelled', effectiveDate: '2026-11-30' }],
      unpaid: [{
        payerName: 'Taylor Mills', remainingCents: 5500,
        charges: [{ memberName: 'Charlie Mills', description: 'Twisters', remainingCents: 5500, reason: 'Card declined' }],
      }],
    },
    classes: [{
      startTime: '16:00', timeLabel: '4:00 PM–5:00 PM', className: 'Twisters', athleteCount: 2,
      athletes: [
        { name: 'Monthly Member', source: 'scheduling' },
        { name: 'Single <Day>', source: 'drop_in', benefitType: 'admin_credit' },
      ],
    }],
  })

  assert.equal(result.subject, 'Vortex Daily Report — Thursday, November 12, 2026')
  assert.match(result.text, /Inquiries[\s\S]*New enrollees and adds[\s\S]*Drops[\s\S]*Unpaid tuition[\s\S]*Today's class roster/)
  assert.match(result.text, /Nell Silva\n\s+parent · nell@example\.com · 555-0100\n\s+Children: Alex \(Age 0\) \/ Sam \(Age 4\)/)
  assert.match(result.text, /Jaime Liu \(Age 7\) — Twisters\n\s+Gymnastics · Monday · 16:00–17:00; Wednesday · 17:00–18:00\n\s+Start date: 2026-11-16\n\s+Parent or guardian: Kim Liu · kim@example\.com · 555-0102/)
  assert.match(result.text, /Taylor Mills — \$55\.00 due\n\s+Charlie Mills · Twisters · \$55\.00 · Card declined/)
  assert.match(result.html, /Twisters &amp; Tumbling/)
  assert.match(result.html, /Monthly Member<\/li>[\s\S]*Drop-ins and make-ups \(1\)[\s\S]*Single &lt;Day&gt; \(Admin credit\)/)
  assert.equal(result.html.split('Single &lt;Day&gt;').length, 2)
})

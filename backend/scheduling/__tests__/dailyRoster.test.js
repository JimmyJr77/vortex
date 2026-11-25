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
        contactType: 'Member', contactRole: 'parent', children: [{ name: 'Alex', age: 0 }, { name: 'Sam', age: 4 }],
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
  assert.match(result.text, /Inquiries[\s\S]*New enrollees and adds[\s\S]*Drops[\s\S]*Unpaid tuition[\s\S]*Class roster for Thursday, November 12, 2026/)
  assert.match(result.text, /Nell Silva\n\s+Member · parent · nell@example\.com · 555-0100\n\s+Children: Alex \(Age 0\) \/ Sam \(Age 4\)/)
  assert.match(result.text, /Jaime Liu \(Age 7\) — Twisters\n\s+Gymnastics · Monday · 16:00–17:00; Wednesday · 17:00–18:00\n\s+Start date: 2026-11-16\n\s+Parent or guardian: Kim Liu · kim@example\.com · 555-0102/)
  assert.match(result.text, /Taylor Mills — \$55\.00 due\n\s+Charlie Mills · Twisters · \$55\.00 · Card declined/)
  assert.match(result.html, /Twisters &amp; Tumbling/)
  assert.match(result.html, /Monthly Member<\/li>[\s\S]*Drop-ins, free trials and make-ups \(1\)[\s\S]*Single &lt;Day&gt; \(Drop-in · Admin credit\)/)
  assert.equal(result.html.split('Single &lt;Day&gt;').length, 2)
})

test('report distinguishes dated trials, recent future bookings, new class members and every drop-in benefit', () => {
  const roster = {
    date: '2026-11-16', dateLabel: 'Monday, November 16, 2026', classCount: 1, athleteCount: 7,
    report: {
      inquiries: [], enrollees: [], adds: [], drops: [], unpaid: [],
      trials: [{ name: 'Future <Trial>', className: 'Tumbling', classDate: '2026-11-20', scheduleLabel: '2026-11-20 · 16:00–17:00' }],
    },
    classes: [{
      startTime: '16:00', timeLabel: '4:00 PM–5:00 PM', className: 'Tumbling', athleteCount: 7,
      athletes: [
        { name: 'Returning Member', source: 'scheduling', isNew: false },
        { name: 'First <Class>', source: 'scheduling', isNew: true },
        { name: 'Booked Earlier', source: 'drop_in', benefitType: 'free_trial', amountCents: 0 },
        { name: 'Paid Visitor', source: 'drop_in', benefitType: null, amountCents: 2500 },
        { name: 'Credit Visitor', source: 'drop_in', benefitType: 'annual_credit', amountCents: 0 },
        { name: 'Pass Visitor', source: 'drop_in', benefitType: 'free_pass', amountCents: 0 },
        { name: 'Promo Visitor', source: 'drop_in', benefitType: 'promo_code', amountCents: 0 },
      ],
    }],
  }
  const { text, html } = renderDailyRosterEmail(roster)
  for (const output of [text, html]) {
    assert.match(output, /Free trials scheduled for Monday, November 16, 2026 \(1\)/)
    assert.match(output, /Booked Earlier \(Free Trial\)/)
    assert.match(output, /Free-trial bookings in the last 24 hours \(1\)/)
    assert.match(output, /2026-11-20/)
    assert.match(output, /Paid Visitor \(Drop-in\)/)
    assert.match(output, /Credit Visitor \(Drop-in · Annual member credit\)/)
    assert.match(output, /Pass Visitor \(Drop-in · Free pass\)/)
    assert.match(output, /Promo Visitor \(Drop-in · Registration code\)/)
    assert.doesNotMatch(output, /Returning Member \(New\)/)
    assert.doesNotMatch(output, /Visitor \(Free Trial\)/)
  }
  assert.match(text, /First <Class> \(New\)/)
  assert.match(html, /First &lt;Class&gt; \(New\)/)
  assert.match(html, /Future &lt;Trial&gt;/)
  assert.doesNotMatch(html, /<Trial>|<Class>/)
  assert.equal(text.split('Booked Earlier (Free Trial)').length, 3, 'appears once in dated trial summary and once in class roster')
  assert.equal(text.split('Future <Trial>').length, 2, 'future booking is activity, not in the recorded day roster')
})

test('daily report explicitly reports no trials for a date without classes or recent bookings', () => {
  const { text, html } = renderDailyRosterEmail({
    date: '2026-11-15', dateLabel: 'Sunday, November 15, 2026', classCount: 0, athleteCount: 0,
    classes: [], report: { inquiries: [], enrollees: [], adds: [], drops: [], unpaid: [] },
  })
  for (const output of [text, html]) {
    assert.match(output, /No free trials scheduled for this date\./)
    assert.match(output, /No new free-trial bookings recorded\./)
    assert.match(output, /No classes are scheduled for this date\./)
  }
})

test('trial summary counts a group booking once across multiple same-day class times', () => {
  const { text, html } = renderDailyRosterEmail({
    date: '2026-11-16', dateLabel: 'Monday, November 16, 2026', classCount: 2, athleteCount: 2,
    report: { inquiries: [], enrollees: [], adds: [], drops: [], unpaid: [] },
    classes: ['4:00 PM–5:00 PM', '5:00 PM–6:00 PM'].map(timeLabel => ({
      className: 'Tumbling', timeLabel, athleteCount: 1,
      athletes: [{ signupId: 9, source: 'drop_in', benefitType: 'free_trial', name: 'One Trial' }],
    })),
  })
  for (const output of [text, html]) {
    assert.match(output, /Free trials scheduled for Monday, November 16, 2026 \(1\)/)
    assert.match(output, /4:00 PM–5:00 PM; 5:00 PM–6:00 PM/)
  }
  assert.equal(text.split('One Trial (Free Trial)').length, 4, 'one summary entry and two scheduled occurrences')
})

test('daily report distinguishes private evaluations from free trials in dated bookings, activity and roster', () => {
  const { text, html } = renderDailyRosterEmail({
    date: '2026-11-19', dateLabel: 'Thursday, November 19, 2026', classCount: 2, athleteCount: 2,
    report: {
      inquiries: [], enrollees: [], adds: [], drops: [], unpaid: [],
      trials: [
        { name: 'Future <Evaluation>', className: 'Gymnastics Evaluation', programName: 'Gymnastics', isTrialAssessment: true,
          classDate: '2026-11-20', scheduleLabel: '2026-11-20 · 19:30–20:00', email: 'parent@example.test', phone: '202-555-0123' },
        { name: 'Future Trial', className: 'Tornadoes', classDate: '2026-11-20' },
      ],
    },
    classes: [
      { startTime: '16:00', timeLabel: '4:00 PM–4:30 PM', className: 'Gymnastics Evaluation', programName: 'Gymnastics',
        isTrialAssessment: true, athleteCount: 1,
        athletes: [{ signupId: 1, name: 'Experienced <Athlete>', source: 'drop_in', benefitType: 'free_trial', email: 'today@example.test', phone: '202-555-0199' }] },
      { startTime: '17:30', timeLabel: '5:30 PM–6:30 PM', className: 'Tornadoes', athleteCount: 1,
        athletes: [{ signupId: 2, name: 'Beginner Athlete', source: 'drop_in', benefitType: 'free_trial' }] },
    ],
  })
  for (const output of [text, html]) {
    assert.match(output, /Free 1:1 evaluations scheduled for Thursday, November 19, 2026 \(1\)/)
    assert.match(output, /Evaluation bookings in the last 24 hours \(1\)/)
    assert.match(output, /30-minute private evaluation · Experienced gymnastics placement/)
    assert.match(output, /4:00 PM–4:30 PM/)
    assert.match(output, /2026-11-20 · 19:30–20:00/)
    assert.match(output, /today@example\.test · 202-555-0199/)
    assert.match(output, /parent@example\.test · 202-555-0123/)
    assert.match(output, /Free trials scheduled for Thursday, November 19, 2026 \(1\)/)
    assert.match(output, /Free-trial bookings in the last 24 hours \(1\)/)
    assert.match(output, /Beginner Athlete \(Free Trial\)/)
    assert.match(output, /Future Trial \(Free Trial\)/)
    assert.match(output, /Free 1:1 evaluations \(1\)/)
    assert.doesNotMatch(output, /Evaluation[^\n<]*\(Free Trial\)|Athlete[^\n<]*\(Free Trial\) — Gymnastics Evaluation/)
  }
  assert.equal(text.split('Experienced <Athlete> (Free 1:1 Evaluation)').length, 3, 'one daily summary and one roster entry')
  assert.equal(text.split('Future <Evaluation> (Free 1:1 Evaluation)').length, 2, 'future evaluation appears only in recent activity')
  assert.match(html, /Experienced &lt;Athlete&gt; \(Free 1:1 Evaluation\)/)
  assert.match(html, /Future &lt;Evaluation&gt; \(Free 1:1 Evaluation\)/)
  assert.doesNotMatch(html, /<Athlete>|<Evaluation>/)
})

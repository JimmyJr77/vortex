import test from 'node:test'
import assert from 'node:assert/strict'
import { bookMemberFreeTrial, filterFreeTrialCatalog, gymnasticsRouting, matchesFreeTrialClass, trialAgeOnDate, validateTrialSelection } from '../freeTrials.js'
import { processExistingFamilyFreeTrial, processFamilySignup } from '../../platform/familySignup.js'

const selection = { program: 'fit-flip', slotGroupId: 17, classDate: '2027-01-12' }
const context = { memberId: 8, facilityId: 1, contactEmail: 'guardian@example.test' }
const younger = { classId: 41, className: 'Tornadoes (8-11)', programName: 'Fit & Flip', sportName: 'Gymnastics', ageMin: 8, ageMax: 11 }
const older = { ...younger, classId: 42, className: 'Cyclones (12-15)', ageMin: 12, ageMax: 15 }

function bookingClient(overrides = {}) {
  const calls = []
  const fixture = {
    member: { id: 8, facility_id: 1, first_name: 'Avery', last_name: 'Test', date_of_birth: '2017-01-12' },
    slot: { slot_group_id: 17, form_id: 7, max_participants: 10, dates_tbd: false, day_of_week: 2, specific_date: null,
      calendar_slot_id: 117, calendar_group_id: 17, calendar_schedule_mode: 'day', calendar_slot_active: true,
      calendar_group_start: '2027-01-01', calendar_group_end: '2027-01-31',
      class_name: 'Tornadoes (8-11)', program_name: 'Fit & Flip', sport_name: 'Gymnastics', age_min: 8, age_max: 11,
      active_start: '2027-01-01', active_end: '2027-01-31', facility_date: '2027-01-01', booking_end_date: '2027-03-01', has_started: false,
      pricing_form: {}, pricing_program: { pricing_slot_cost_monthly_cents: 18000 } },
    requiredWaivers: [{ id: 1, waiver_type: 'RELEASE_OF_LIABILITY', member_id: 8, signature_name: 'Parent Test' }],
    previous: [], counts: { monthly: 4, drop_ins: 1 }, entitlement: { lifetime_trial_granted: 1 }, enrolled: [], upcoming: true,
    ...overrides,
  }
  return { calls, fixture, async query(sql, params) {
    calls.push({ sql, params })
    if (sql.includes('FROM member WHERE')) return { rows: fixture.member ? [fixture.member] : [] }
    if (sql.includes('SELECT lifetime_trial_granted')) return { rows: [fixture.entitlement] }
    if (sql.includes('FROM scheduling_slot_group sg')) return { rows: fixture.slot ? [fixture.slot] : [] }
    if (sql.includes('FROM waiver_template template')) return { rows: fixture.requiredWaivers }
    if (sql.includes('SELECT id, slot_group_id')) return { rows: fixture.previous }
    if (sql.includes('AS overlapping_assessment_id')) return { rows: fixture.overlap || [] }
    if (sql.includes('SELECT id FROM scheduling_signup')) return { rows: fixture.enrolled }
    if (sql.includes('AS monthly')) return { rows: [fixture.counts] }
    if (sql.includes('AS is_upcoming')) return { rows: [{ is_upcoming: fixture.upcoming }] }
    if (sql.includes('INSERT INTO drop_in_registration')) return { rows: [{ id: 90 }] }
    return { rows: [] }
  } }
}

const experiencedSelection = { ...selection, program: 'gymnastics', gymnasticsTrack: 'experienced', experience: 'experienced' }
function privateEvaluationClient(overrides = {}) {
  const client = bookingClient({ counts: { monthly: 0, drop_ins: 0 }, ...overrides })
  Object.assign(client.fixture.slot, { class_name: 'Private Gymnastics Evaluation', program_name: 'Development Gymnastics',
    age_min: 2, age_max: 17, is_trial_assessment: true, start_time: '16:00:00', end_time: '16:30:00', max_participants: 1 })
  return client
}

test('the actual date of birth determines the 8–11 and 12–15 bands on the class date', () => {
  for (const [birth, before, on] of [['2019-01-12', 7, 8], ['2015-01-12', 11, 12], ['2011-01-12', 15, 16]]) {
    assert.equal(trialAgeOnDate(birth, '2027-01-11'), before)
    assert.equal(trialAgeOnDate(birth, '2027-01-12'), on)
  }
  assert.equal(matchesFreeTrialClass(younger, 'fit-flip', 8), true)
  assert.equal(matchesFreeTrialClass(younger, 'fit-flip', 11), true)
  assert.equal(matchesFreeTrialClass(younger, 'fit-flip', 12), false)
  assert.equal(matchesFreeTrialClass(older, 'fit-flip', 12), true)
  assert.equal(matchesFreeTrialClass(older, 'fit-flip', 15), true)
  assert.equal(matchesFreeTrialClass(older, 'fit-flip', 16), false)
})

test('Fit & Flip is distinct from gymnastics despite its Gymnastics sport tag', () => {
  assert.equal(matchesFreeTrialClass(younger, 'gymnastics', 10), false)
  assert.equal(matchesFreeTrialClass({ ...younger, programName: 'Developmental Gymnastics', className: 'Cyclones', ageMin: 6, ageMax: null }, 'fit-flip', 10), false)
  assert.equal(matchesFreeTrialClass({ ...younger, programName: 'Developmental Gymnastics', className: 'Cyclones', ageMin: 6, ageMax: null }, 'gymnastics', 10, { gymnasticsTrack: 'beginner', experience: 'none' }), false)
})

test('Fit & Flip trials accept current Tornadoes and legacy Cyclones introductory cohorts without admitting advanced cohorts', async () => {
  for (const className of ['Tornadoes (8-11)', 'Tornados (8-11)', 'Cyclones (8-11)']) {
    const cohort = { ...younger, className }
    assert.equal(matchesFreeTrialClass(cohort, 'fit-flip', 8), true, className)
    assert.equal(matchesFreeTrialClass(cohort, 'fit-flip', 11), true, className)
    assert.equal(matchesFreeTrialClass(cohort, 'fit-flip', 7), false, className)
    assert.equal(matchesFreeTrialClass(cohort, 'fit-flip', 12), false, className)
  }
  assert.equal(matchesFreeTrialClass({ ...younger, className: 'Tornadoes (12-15)' }, 'fit-flip', 10), true,
    'canonical age metadata takes precedence over an outdated name range')
  const legacy = { ...younger, className: 'Tornadoes (8–11)', ageMin: null, ageMax: null }
  assert.equal(matchesFreeTrialClass(legacy, 'fit-flip', 10), true)
  assert.equal(matchesFreeTrialClass(legacy, 'fit-flip', 13), false)
  for (const className of ['Hurricanes (8-11)', 'Advanced (8-11)', 'Competitive Team (8-11)']) {
    assert.equal(matchesFreeTrialClass({ ...younger, className }, 'fit-flip', 10), false,
      'age metadata alone must not admit another cohort')
    const client = bookingClient()
    client.fixture.slot.class_name = className
    await assert.rejects(bookMemberFreeTrial(client, selection, context), /appropriate class/)
    assert.equal(client.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
  }
})

test('gymnastics routes age and experience to configured class types, including potty training and editable assessment schedules', () => {
  const gym = { programName: 'Development Gymnastics', sportName: 'Gymnastics' }
  const mommy = { ...gym, className: 'Dirt Devils (Mommy & Me / 2-3 yrs old)', ageMin: 2, ageMax: 3 }
  const preschool = { ...gym, className: 'Twisters (Preschool)', ageMin: 4, ageMax: 5 }
  const beginner = { ...gym, className: 'Tornadoes', ageMin: 6, ageMax: null }
  const placement = { ...gym, className: 'Trial Assessment', date: '2027-01-16', startTime: '12:00', ageMin: 6, isTrialAssessment: true }
  assert.deepEqual([1, 2, 4, 6].map(age => gymnasticsRouting(age).track), ['contact', 'mommy-me', 'preschool', 'school-age'])
  assert.equal(matchesFreeTrialClass(mommy, 'gymnastics', 2, { gymnasticsTrack: 'mommy-me', pottyTrained: false }), false)
  assert.equal(matchesFreeTrialClass(mommy, 'gymnastics', 3, { gymnasticsTrack: 'mommy-me', pottyTrained: true }), true)
  assert.equal(matchesFreeTrialClass(preschool, 'gymnastics', 5, { gymnasticsTrack: 'preschool' }), true)
  assert.equal(matchesFreeTrialClass(preschool, 'gymnastics', 6, { gymnasticsTrack: 'preschool' }), false)
  assert.equal(matchesFreeTrialClass(beginner, 'gymnastics', 6, { gymnasticsTrack: 'beginner', experience: 'none' }), true)
  assert.equal(matchesFreeTrialClass(beginner, 'gymnastics', 7, { gymnasticsTrack: 'beginner', experience: 'none' }), true)
  assert.equal(matchesFreeTrialClass(beginner, 'gymnastics', 7, { gymnasticsTrack: 'experienced', experience: 'experienced' }), false)
  assert.equal(matchesFreeTrialClass(placement, 'gymnastics', 9, { gymnasticsTrack: 'experienced', experience: 'experienced' }), true)
  assert.equal(matchesFreeTrialClass({ ...placement, startTime: '13:00' }, 'gymnastics', 9, { gymnasticsTrack: 'experienced', experience: 'experienced' }), true)
  assert.equal(matchesFreeTrialClass({ ...placement, date: '2027-01-17' }, 'gymnastics', 6, { gymnasticsTrack: 'experienced', experience: 'experienced' }), true)
  assert.equal(matchesFreeTrialClass({ ...placement, ageMin: 2 }, 'gymnastics', 4, { gymnasticsTrack: 'experienced', experience: 'experienced' }), true)
  assert.equal(matchesFreeTrialClass(placement, 'gymnastics', 9, { gymnasticsTrack: 'experienced' }), false,'age never implies gymnastics experience')
  assert.equal(matchesFreeTrialClass(preschool, 'gymnastics', 4, { gymnasticsTrack: 'preschool', experience: 'experienced' }), false)
  assert.throws(() => validateTrialSelection({ ...selection, program: 'gymnastics', gymnasticsTrack: 'mommy-me' }), /potty trained/)
  assert.throws(() => validateTrialSelection({ ...selection, program: 'gymnastics', gymnasticsTrack: 'beginner', experience: 'experienced' }), /experience/)
  assert.throws(() => validateTrialSelection({ ...selection, program: 'gymnastics', gymnasticsTrack: 'preschool', experience: 'experienced' }), /private evaluation/)
})

test('experienced gymnastics catalog offers only private half-hour evaluations with one place', () => {
  const base = { programName: 'Development Gymnastics', className: 'Private Gymnastics Evaluation', ageMin: 2, ageMax: 17,
    classId: 1, slotGroupId: 1, date: '2027-01-12', startTime: '16:00', endTime: '16:30', maxParticipants: 1, isTrialAssessment: true }
  const catalog = { classes: [base], sessions: [base,
    { ...base, slotGroupId: 2, endTime: '17:00' }, { ...base, slotGroupId: 3, maxParticipants: 8 },
    { ...base, slotGroupId: 4, isTrialAssessment: false, className: 'Tornadoes' },
  ] }
  const criteria = { program: 'gymnastics', age: 4, gymnasticsTrack: 'experienced', experience: 'experienced', now: new Date('2027-01-01T12:00:00Z') }
  const available = filterFreeTrialCatalog(catalog, criteria)
  assert.deepEqual(available.sessions.map(row => row.slotGroupId), [1])
  assert.equal(available.sessions[0].totalCents, 0)
  assert.deepEqual(filterFreeTrialCatalog(catalog, { ...criteria, experience: 'none' }).sessions, [])
})

test('catalog retains real counts, filters the cohort and omits already-started facility-local classes across UTC midnight', () => {
  const base = { ...younger, slotGroupId: 17, date: '2027-01-11', timeZone: 'America/New_York', enrolledCount: 5, totalAttending: 6, spotsRemaining: 4 }
  const result = filterFreeTrialCatalog({ classes: [younger, older], sessions: [
    { ...base, slotGroupId: 17, startTime: '18:30' }, { ...base, slotGroupId: 18, startTime: '19:30' },
    { ...base, slotGroupId: 19, startTime: '20:00' }, { ...base, ...older, slotGroupId: 20, startTime: '20:30' },
  ] }, { program: 'fit-flip', age: 10, now: new Date('2027-01-12T00:30:00Z') })
  assert.equal(result.sessions.length, 1)
  assert.equal(result.sessions[0].startTime, '20:00')
  assert.equal(result.sessions[0].enrolledCount, 5)
  assert.equal(result.sessions[0].spotsRemaining, 4)
  assert.deepEqual(result.classes, [{ ...younger, benefitType: 'free_trial', totalCents: 0 }])
})

test('ambiguous group/date with more than one start or end time is not offered as a single bookable trial', () => {
  const base = { ...younger, slotGroupId: 17, date: '2027-01-12', timeZone: 'America/New_York' }
  const result = filterFreeTrialCatalog({ classes: [younger], sessions: [
    { ...base, startTime: '16:00', endTime: '17:00' }, { ...base, startTime: '17:00', endTime: '18:00' },
  ] }, { program: 'fit-flip', age: 10, now: new Date('2027-01-01T12:00:00Z') })
  assert.deepEqual(result.sessions, [])
})

test('trial selections reject invalid calendar dates, unsupported tracks and parent member indexes', () => {
  for (const value of [{ ...selection, classDate: '2027-02-30' }, { ...selection, program: 'sports' }, { ...selection, slotGroupId: 0 }]) {
    assert.throws(() => validateTrialSelection(value))
  }
  assert.throws(() => validateTrialSelection({ ...selection, memberIndex: 0 }, { requireMemberIndex: true }), /child/)
})

test('confirmed free trial uses the selected child, slot and a zero amount without billing or monthly enrollment writes', async () => {
  const client = bookingClient()
  assert.deepEqual(await bookMemberFreeTrial(client, selection, context), { id: 90, memberId: 8, status: 'confirmed', benefitType: 'free_trial', totalCents: 0, ...selection })
  const insert = client.calls.find(call => call.sql.includes('INSERT INTO drop_in_registration'))
  assert.deepEqual(insert.params.slice(0, 4), [8, 7, 17, '2027-01-12'])
  assert.match(insert.sql, /0,'confirmed'/)
  assert.equal(client.calls.some(({ sql }) => /INSERT INTO (?:billing_charge|scheduling_signup|member_annual)/.test(sql)), false)
  assert.ok(client.calls.findIndex(({ sql }) => sql.includes('SELECT lifetime_trial_granted')) < client.calls.findIndex(({ sql }) => sql.includes('FOR UPDATE OF sg')))
})

for (const [name, overrides, message] of [
  ['full capacity including holds', { counts: { monthly: 9, drop_ins: 1 } }, /filled up/],
  ['full capacity including pending family invitation holds', { counts: { monthly: 9, drop_ins: 0, registration_holds: 1 } }, /filled up/],
  ['class started while waiting for a lock', { upcoming: false }, /already started/],
  ['used lifetime credit', { previous: [{ id: 20, slot_group_id: 18, class_date: '2026-12-15', status: 'confirmed' }] }, /already used/],
  ['disabled entitlement', { entitlement: { lifetime_trial_granted: 0 } }, /already used/],
  ['missing required signature', { requiredWaivers: [{ id: 1, member_id: null }] }, /waivers must be signed/],
  ['unacknowledged payment policy', { requiredWaivers: [{ id: 1, member_id: 8, signature_name: 'Parent', waiver_type: 'PAYMENT_POLICY', payment_policy_acknowledged: false }] }, /waivers must be signed/],
  ['missing required templates', { requiredWaivers: [] }, /waivers are unavailable/],
  ['inactive or excluded slot', { slot: null }, /no longer available/],
  ['child already enrolled', { enrolled: [{ id: 50 }] }, /already enrolled/],
  ['actual DOB outside selected band', { member: { id: 8, first_name: 'Avery', last_name: 'Test', date_of_birth: '2015-01-12' } }, /age on the trial date/],
]) {
  test(`booking rejects ${name} before creating any reservation`, async () => {
    const client = bookingClient(overrides)
    await assert.rejects(bookMemberFreeTrial(client, selection, context), message)
    assert.equal(client.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
  })
}

test('a repeated successful booking is idempotent even if its reserved seat fills the class', async () => {
  const client = bookingClient({ previous: [{ id: 90, slot_group_id: 17, class_date: selection.classDate, status: 'confirmed', amount_cents: 0 }], counts: { monthly: 9, drop_ins: 1 } })
  assert.equal((await bookMemberFreeTrial(client, selection, context)).id, 90)
  assert.equal(client.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
})

test('a private evaluation is free, marked as an assessment, and locks all overlapping assessment groups before the selected group', async () => {
  const client = privateEvaluationClient()
  const result = await bookMemberFreeTrial(client, experiencedSelection, context)
  assert.equal(result.totalCents, 0)
  assert.equal(result.isTrialAssessment, true)
  const lockIndex = client.calls.findIndex(({ params }) => params?.[0] === 'private-trial-assessment:1:2027-01-12')
  const groupIndex = client.calls.findIndex(({ sql }) => sql.includes('FOR UPDATE OF sg'))
  assert.ok(lockIndex >= 0 && lockIndex < groupIndex)
  const overlap = client.calls.find(({ sql }) => sql.includes('AS overlapping_assessment_id'))
  assert.deepEqual(overlap.params, [1, selection.classDate, 17, '16:00:00', '16:30:00'])
  assert.match(overlap.sql, /time\.start_time<\$5::time AND time\.end_time>\$4::time/)
})

test('private evaluations reject full places, overlapping bookings, group capacity, and non-half-hour schedules', async () => {
  for (const scenario of [
    { overrides: { counts: { monthly: 0, drop_ins: 1 } }, message: /filled up/ },
    { overrides: { overlap: [{ overlapping_assessment_id: 99 }] }, message: /already been booked/ },
    { slot: { max_participants: 2 }, message: /30-minute evaluation for one athlete/ },
    { slot: { end_time: '17:00:00' }, message: /30-minute evaluation for one athlete/ },
  ]) {
    const client = privateEvaluationClient(scenario.overrides)
    Object.assign(client.fixture.slot, scenario.slot)
    await assert.rejects(bookMemberFreeTrial(client, experiencedSelection, context), scenario.message)
    assert.equal(client.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
  }
})

test('experienced athletes cannot submit a regular gymnastics trial, and inexperienced athletes cannot reserve evaluations', async () => {
  const regular = bookingClient()
  Object.assign(regular.fixture.slot, { class_name: 'Tornadoes', program_name: 'Development Gymnastics', age_min: 6, age_max: 17 })
  await assert.rejects(bookMemberFreeTrial(regular, experiencedSelection, context), /age on the trial date/)
  const assessment = privateEvaluationClient()
  await assert.rejects(bookMemberFreeTrial(assessment, { ...experiencedSelection, gymnasticsTrack: 'beginner', experience: 'none' }, context), /age on the trial date/)
  assert.equal(assessment.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
})

test('family trial signup refuses an attached paid enrollment or pending drop-in before creating accounts', async () => {
  for (const extra of [{ enrollments: [{ memberIndex: 1, formId: 4 }] }, { pendingDropInId: 3 }]) {
    const calls = []
    const client = { async query(sql) { calls.push(sql); return { rows: [{ id: 1, facility_date: '2027-01-01' }] } } }
    await assert.rejects(processFamilySignup(client, { freeTrial: { ...selection, memberIndex: 1 }, additionalMembers: [{}], ...extra }), /separately/)
    assert.equal(calls.some(sql => /INSERT|UPDATE/.test(sql)), false)
  }
})

test('existing-family trial rejects parent selection and unrelated children before any waiver or booking writes', async () => {
  for (const memberId of [7, 8]) {
    const calls = []
    const client = { async query(sql) { calls.push(sql); return { rows: sql.includes('facility_date') ? [{ facility_date: '2027-01-01' }] : [] } } }
    await assert.rejects(processExistingFamilyFreeTrial(client, { ...selection, memberId }, { signerMemberId: 7, facilityId: 1 }), /child|guardian/)
    assert.equal(calls.some(sql => /INSERT|UPDATE/.test(sql)), false)
  }
})

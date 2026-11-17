import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { processFamilySignup, processExistingFamilyFreeTrial } from '../../platform/familySignup.js'
import { CANONICAL_WAIVER_TEMPLATES } from '../../platform/canonicalWaiverBodies.js'
import { prepareFamilyEnrollmentCheckout } from '../../platform/familyEnrollmentCheckout.js'
import { listPublicClassesOffered } from '../../programs/listPublicClassesOffered.js'
import { registerDropInRoutes } from '../dropIns.js'
import { buildSignupOrderPreview } from '../orderPricing.js'
import { listAssessmentSchedules, saveAssessmentTime } from '../trialAssessmentSchedule.js'

// Opt in against an already migrated local development/test database only.
// Every fixture, including the facility, is created inside a transaction and rolled back.
function localTestDatabaseUrl(value) {
  const url = new URL(value)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
      || !/^vortex_(?:test|new_admin_dev)(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('TEST_DATABASE_URL must be a loopback vortex_test[_suffix] or vortex_new_admin_dev[_suffix] PostgreSQL URL without overrides.')
  }
  return url.toString()
}
const connectionString = process.env.TEST_DATABASE_URL ? localTestDatabaseUrl(process.env.TEST_DATABASE_URL) : null

function publicCatalog(db) {
  const routes = new Map()
  const app = new Proxy({}, { get: (_, method) => (path, handler) => { if (method === 'get') routes.set(path, handler) } })
  registerDropInRoutes(app, db)
  return async (query, path = '/api/public/free-trials') => {
    let response, status = 200
    const res = { set() { return this }, status(value) { status = value; return this }, json(value) { response = value; return this } }
    await routes.get(path)({ query, headers: {} }, res)
    assert.equal(status, 200, response?.message)
    assert.equal(response.success, true)
    return response.data
  }
}

async function addClass(db, { facilityId, programId, name, min, max, date, assessment = false }) {
  const classId = Number((await db.query(`INSERT INTO program
    (facility_id, category, programs_id, name, display_name, age_min, age_max, is_active, archived, is_trial_assessment)
    VALUES ($1,'GYMNASTICS',$2,$3,$3,$4,$5,TRUE,FALSE,$6) RETURNING id`, [facilityId, programId, name, min, max, assessment])).rows[0].id)
  const formId = Number((await db.query(`INSERT INTO scheduling_form
    (program_id,programs_id,title,is_active,start_date,pricing_overrides_program,class_monthly_price_cents,cost_amount_cents,cost_unit,class_program_pricing)
    VALUES ($1,$2,$3,TRUE,(clock_timestamp() AT TIME ZONE 'America/New_York')::date,TRUE,18000,18000,'per_month','{}'::jsonb) RETURNING id`, [classId, programId, name])).rows[0].id)
  const groupId = Number((await db.query(`INSERT INTO scheduling_slot_group
    (form_id,schedule_mode,max_participants,active_start,inherits_offering_dates,dates_tbd,is_active)
    VALUES ($1,'date',8,(clock_timestamp() AT TIME ZONE 'America/New_York')::date,FALSE,FALSE,TRUE) RETURNING id`, [formId])).rows[0].id)
  const slotId = Number((await db.query(`INSERT INTO scheduling_time_slot
    (form_id,slot_group_id,schedule_mode,specific_date,start_time,end_time,max_participants,active_start,dates_tbd,is_active)
    VALUES ($1,$2,'date',$3,'12:00','13:00',8,(clock_timestamp() AT TIME ZONE 'America/New_York')::date,FALSE,TRUE) RETURNING id`, [formId, groupId, date])).rows[0].id)
  return { classId, formId, groupId, slotId }
}

test('local PostgreSQL: family trials, current waivers, both cohorts, assessment billing guards and editable schedules', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  let facilityId
  try {
    await db.query('BEGIN')
    facilityId = Number((await db.query("INSERT INTO facility(name,timezone) VALUES('Free trial regression fixture','America/New_York') RETURNING id")).rows[0].id)
    await db.query(`INSERT INTO additional_fee (facility_id,name,amount_cents,apply_basis,trigger_type)
      VALUES ($1,'Annual membership',6000,'per_year','once_per_year')`, [facilityId])
    const date = (await db.query("SELECT ((clock_timestamp() AT TIME ZONE 'America/New_York')::date + 14)::text AS date")).rows[0].date
    const today = (await db.query("SELECT (clock_timestamp() AT TIME ZONE 'America/New_York')::date::text AS date")).rows[0].date
    const addProgram = async name => Number((await db.query('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id', [facilityId, name])).rows[0].id)
    const fitFlipId = await addProgram('Fit & Flip')
    const gymnasticsId = await addProgram('Development Gymnastics')
    const younger = await addClass(db, { facilityId, programId: fitFlipId, name: 'Cyclones (8-11)', min: 8, max: 11, date })
    const older = await addClass(db, { facilityId, programId: fitFlipId, name: 'Cyclones (12-15)', min: 12, max: 15, date })
    const assessment = await addClass(db, { facilityId, programId: gymnasticsId, name: 'Trial Assessment', min: 6, max: 17, date, assessment: true })
    await db.query('UPDATE scheduling_time_slot SET exclude_from_drop_ins=TRUE, allow_free_trials=TRUE WHERE id=$1', [younger.slotId])
    const acceptedTemplateIds = []
    for (const template of CANONICAL_WAIVER_TEMPLATES) {
      acceptedTemplateIds.push(Number((await db.query(`INSERT INTO waiver_template
        (facility_id,name,version,body,waiver_type,is_required,active_from) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`,
      [facilityId, template.name, template.version, template.body, template.waiverType, template.isRequired !== false])).rows[0].id))
    }
    const getCatalog = publicCatalog(db)
    const youngCatalog = await getCatalog({ program: 'fit-flip', age: '10' })
    const oldCatalog = await getCatalog({ program: 'fit-flip', age: '13' })
    assert.ok(youngCatalog.sessions.some(row => row.classId === younger.classId))
    assert.equal(youngCatalog.sessions.some(row => row.classId === older.classId), false)
    assert.ok(oldCatalog.sessions.some(row => row.classId === older.classId))
    assert.equal(oldCatalog.sessions.some(row => row.classId === younger.classId), false)
    const waivers = { acceptedTemplateIds, signatureName: 'Parent Regression', paymentPolicyAcknowledged: true }
    const selection = { program: 'fit-flip', slotGroupId: younger.groupId, classDate: date }
    const payload = () => {
      const stamp = crypto.randomBytes(8).toString('hex'), email = `trial-${stamp}@example.test`
      return {
        primaryAdult: { firstName: 'Parent', lastName: 'Regression', email, phone: '2025550123', username: `trial${stamp}`, dateOfBirth: '1990-01-01', password: 'RegressionTrial!123', confirmPassword: 'RegressionTrial!123', addressStreet: '123 Test St', addressCity: 'Bowie', addressState: 'MD', addressZip: '20715' },
        additionalMembers: [10, 13, 9, 9].map((age, index) => ({ firstName: `Athlete${index}`, lastName: 'Regression', dateOfBirth: `${Number(date.slice(0, 4)) - age}-01-01`, email, useParentEmail: true, portalAccessRequested: false })),
        waivers, freeTrial: { ...selection, memberIndex: 1 },
      }
    }
    const missingWaiver = payload()
    missingWaiver.waivers = { ...waivers, acceptedTemplateIds: acceptedTemplateIds.slice(1) }
    await assert.rejects(processFamilySignup(db, missingWaiver, { facilityId }), /required waivers/)
    assert.equal((await db.query('SELECT count(*)::int count FROM member WHERE email=$1', [missingWaiver.primaryAdult.email])).rows[0].count, 0)
    const result = await processFamilySignup(db, payload(), { facilityId })
    assert.equal(result.completedDropIn.totalCents, 0)
    assert.equal(result.completedDropIn.status, 'confirmed')
    assert.equal(result.completedDropIn.memberId, result.memberIds[1])
    const auth = { signerMemberId: result.payerMemberId, facilityId }
    const oldSelection = { program: 'fit-flip', slotGroupId: older.groupId, classDate: date, waivers }
    await assert.rejects(processExistingFamilyFreeTrial(db, { ...oldSelection, memberId: result.memberIds[1] }, auth), /age on the trial date/)
    const oldBooking = await processExistingFamilyFreeTrial(db, { ...oldSelection, memberId: result.memberIds[2] }, auth)
    assert.equal(oldBooking.totalCents, 0)
    assert.equal((await processExistingFamilyFreeTrial(db, { ...oldSelection, memberId: result.memberIds[2] }, auth)).id, oldBooking.id)
    const assessmentSelection = { program: 'gymnastics', gymnasticsTrack: 'experienced', experience: 'experienced', slotGroupId: assessment.groupId, classDate: date, waivers }
    await assert.rejects(processExistingFamilyFreeTrial(db, { ...assessmentSelection, memberId: result.memberIds[2] }, auth), /already used/)
    await assert.rejects(processExistingFamilyFreeTrial(db, { ...assessmentSelection, memberId: result.payerMemberId }, auth), /child/)
    for (const memberId of result.memberIds.slice(3)) {
      const booking = await processExistingFamilyFreeTrial(db, { ...assessmentSelection, memberId }, auth)
      assert.equal(booking.totalCents, 0)
    }
    const acceptances = (await db.query('SELECT count(*)::int count FROM member_waiver_acceptance WHERE member_id=$1', [result.memberIds[1]])).rows[0].count
    assert.equal(acceptances, acceptedTemplateIds.length)
    const attendance = (await getCatalog({ program: 'fit-flip', age: '13' })).sessions.find(row => row.slotGroupId === older.groupId)
    assert.equal(attendance.enrolledCount, 1)
    assert.equal(attendance.spotsRemaining, 7)

    // Rejected account creation rolls back the family, signatures and trial as one unit.
    await db.query('SAVEPOINT failed_family')
    await db.query('UPDATE scheduling_slot_group SET max_participants=1 WHERE id=$1', [younger.groupId])
    const failed = payload()
    await assert.rejects(processFamilySignup(db, failed, { facilityId }), /filled up/)
    await db.query('ROLLBACK TO SAVEPOINT failed_family')
    assert.equal((await db.query('SELECT count(*)::int count FROM member WHERE email=$1', [failed.primaryAdult.email])).rows[0].count, 0)

    await assert.rejects(buildSignupOrderPreview(db, { memberId: result.memberIds[3], newSignups: [{ formId: assessment.formId, slotGroupId: assessment.groupId, enrollmentStartDate: date }] }), error => error.code === 'TRIAL_ASSESSMENT_REQUIRES_FREE_TRIAL')
    for (const tampered of [
      { formId: assessment.formId, slotGroupId: younger.groupId, timeSlotId: younger.slotId },
      { formId: younger.formId, slotGroupId: assessment.groupId, timeSlotId: younger.slotId },
      { formId: younger.formId, slotGroupId: younger.groupId, timeSlotId: assessment.slotId },
    ]) {
      await assert.rejects(buildSignupOrderPreview(db, { memberId: result.memberIds[3], newSignups: [{ ...tampered, enrollmentStartDate: date }] }), error => error.code === 'TRIAL_ASSESSMENT_REQUIRES_FREE_TRIAL')
    }
    const ordinaryPreview = await buildSignupOrderPreview(db, { memberId: result.memberIds[3], newSignups: [{ formId: younger.formId, slotGroupId: younger.groupId, timeSlotId: younger.slotId, enrollmentStartDate: date }] })
    assert.ok(ordinaryPreview.newSignups.some(row => Number(row.formId) === younger.formId))
    await assert.rejects(prepareFamilyEnrollmentCheckout(db, { memberId: result.memberIds[3], enrollment: { classEventId: assessment.classId, schedulingFormId: assessment.formId, slotGroupId: assessment.groupId, timeSlotId: assessment.slotId, enrollmentStartDate: date } }), /no longer available/)
    const paidCatalog = await getCatalog({}, '/api/public/drop-ins')
    assert.equal(paidCatalog.classes.some(row => row.classId === assessment.classId), false)
    assert.equal(paidCatalog.sessions.some(row => row.classId === younger.classId), false)
    const advertised = await listPublicClassesOffered(db)
    assert.equal(advertised.programs.flatMap(program => program.classes).some(row => row.id === assessment.classId), false)
    for (const table of ['billing_charge', 'scheduling_signup', 'additional_fee_redemption']) {
      assert.equal((await db.query(`SELECT count(*)::int count FROM ${table} WHERE member_id=ANY($1::bigint[])`, [result.memberIds])).rows[0].count, 0, `Unexpected ${table} write`)
    }

    const body = { scheduleMode: 'date', specificDate: date, startTime: '12:00', endTime: '13:00', maxParticipants: 8, activeStart: today, activeEnd: null }
    await assert.rejects(saveAssessmentTime(db, { facilityId, formId: younger.formId, body }), /not found/)
    await assert.rejects(saveAssessmentTime(db, { facilityId, formId: assessment.formId, slotGroupId: assessment.groupId, body: { ...body, startTime: '14:00', endTime: '15:00' } }), /already booked/)
    await assert.rejects(saveAssessmentTime(db, { facilityId, formId: assessment.formId, slotGroupId: assessment.groupId, body: { ...body, maxParticipants: 1 } }), /Capacity cannot be lower than 2/)
    await db.query('INSERT INTO scheduling_day_cancellation (facility_id, occurrence_date) VALUES ($1,$2)', [facilityId, date])
    const added = await saveAssessmentTime(db, { facilityId, formId: assessment.formId, body: { ...body, startTime: '14:00', endTime: '15:00' } })
    await saveAssessmentTime(db, { facilityId, formId: assessment.formId, slotGroupId: added.slotGroupId, body: { ...body, startTime: '15:00', endTime: '16:00' } })
    const staffSchedules = await listAssessmentSchedules(db, facilityId)
    assert.equal(staffSchedules.find(form => form.id === assessment.formId).schedules.find(row => row.slotGroupId === added.slotGroupId).startTime, '15:00')
    const experiencedTrial = { program: 'gymnastics', age: '9', gymnasticsTrack: 'experienced', experience: 'experienced' }
    const closedSchedules = await getCatalog(experiencedTrial)
    assert.equal(closedSchedules.sessions.some(row => row.classId === assessment.classId && row.date === date), false)
    const { rows: [existingReservations] } = await db.query(`SELECT count(*)::int AS count FROM drop_in_registration
      WHERE slot_group_id=$1 AND class_date=$2 AND status='confirmed'`, [assessment.groupId, date])
    assert.equal(existingReservations.count, 2)
    await db.query('DELETE FROM scheduling_day_cancellation WHERE facility_id=$1 AND occurrence_date=$2', [facilityId, date])
    const publicSchedules = await getCatalog(experiencedTrial)
    assert.equal(publicSchedules.sessions.find(row => row.slotGroupId === added.slotGroupId).startTime, '15:00')
  } finally {
    await db.query('ROLLBACK')
    try {
      if (facilityId) assert.equal((await db.query('SELECT count(*)::int count FROM facility WHERE id=$1', [facilityId])).rows[0].count, 0)
    } finally { await db.end() }
  }
})

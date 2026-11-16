import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import pg from 'pg'
import { registerDropInRoutes } from '../dropIns.js'
import { bookMemberFreeTrial } from '../freeTrials.js'
import { listPublicClassesOffered } from '../../programs/listPublicClassesOffered.js'

const url = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (url && (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)
    || !new URL(url).pathname.startsWith('/vortex_new_admin_dev'))) {
  throw new Error('Isolated local test database required')
}

function routesFor(db) {
  const client = {
    release() {},
    query(sql, values) {
      return db.query(sql === 'BEGIN' ? 'SAVEPOINT drop_in_booking'
        : sql === 'COMMIT' ? 'RELEASE SAVEPOINT drop_in_booking'
          : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT drop_in_booking' : sql, values)
    },
  }
  const pool = { query: (...args) => db.query(...args), connect: async () => client }
  const handlers = new Map()
  const app = new Proxy({}, { get: (_, method) => (path, handler) => handlers.set(`${method}:${path}`, handler) })
  registerDropInRoutes(app, pool)
  return async (method, path, body = {}) => {
    let status = 200, payload
    const res = { set() { return this }, status(code) { status = code; return this }, json(value) { payload = value; return this } }
    await handlers.get(`${method}:${path}`)({ body, query: {}, headers: {} }, res)
    return { status, ...payload }
  }
}

test('drop-in readers honor program, class and individual schedule eligibility without a sibling-day booking bypass', { skip: !url }, async () => {
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  try {
    await db.query('BEGIN')
    // All fixtures and optional schema preparation roll back at the end.
    for (const migration of ['848_class_owned_pricing.sql', '858_enrollment_catalog_order.sql', '860_trial_assessment_booking_policy.sql', '863_class_schedule_drop_in_overrides.sql']) {
      await db.query(await fs.readFile(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8'))
    }
    const one = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const facilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES('Drop-in scope reader test','America/New_York') RETURNING id")).id)
    const programId = Number((await one("INSERT INTO programs(facility_id,name,display_name,exclude_from_drop_ins) VALUES($1,'DROP_IN_SCOPE_READERS','Fit & Flip',TRUE) RETURNING id", [facilityId])).id)
    const classId = Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,age_min,age_max,is_active,archived)
      VALUES($1,'GYMNASTICS',$2,'DROP_IN_SCOPE_CLASS','Cyclones (8-11)',8,11,TRUE,FALSE) RETURNING id`, [facilityId, programId])).id)
    const formId = Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,class_monthly_price_cents,cost_amount_cents,cost_unit)
      VALUES($1,$2,'Cyclones (8-11)',TRUE,18000,18000,'per_month') RETURNING id`, [classId, programId])).id)
    const groupId = Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,inherits_offering_dates,dates_tbd,is_active)
      VALUES($1,'date',8,FALSE,FALSE,TRUE) RETURNING id`, [formId])).id)
    const dates = await one("SELECT ((now() AT TIME ZONE 'America/New_York')::date + 14)::text AS blocked, ((now() AT TIME ZONE 'America/New_York')::date + 15)::text AS allowed")
    const addSlot = async (date, excluded) => Number((await one(`INSERT INTO scheduling_time_slot
      (form_id,slot_group_id,schedule_mode,specific_date,start_time,end_time,max_participants,dates_tbd,is_active,exclude_from_drop_ins)
      VALUES($1,$2,'date',$3,'12:00','13:00',8,FALSE,TRUE,$4) RETURNING id`, [formId, groupId, date, excluded])).id)
    const blockedSlot = await addSlot(dates.blocked, null)
    const allowedSlot = await addSlot(dates.allowed, false)
    const request = routesFor(db)
    const catalog = async () => {
      const result = await request('get', '/api/public/drop-ins')
      assert.equal(result.status, 200, result.message)
      return result.data
    }
    const advertisedClass = async () => (await listPublicClassesOffered(db)).programs.find(row => row.id === programId)?.classes.find(row => row.id === classId)

    assert.deepEqual((await catalog()).sessions.filter(row => row.classId === classId).map(row => row.date), [dates.allowed])
    assert.equal((await advertisedClass()).excludeFromDropIns, false, 'an allowed schedule must remain visible beneath an excluded program')
    const admin = await request('get', '/api/admin/scheduling/drop-ins/overview')
    assert.equal(admin.status, 200, admin.message)
    assert.equal(admin.data.classes.find(row => row.classId === classId).excludedFromDropIns, false)
    assert.equal(admin.data.classInventory.find(row => Number(row.classId) === classId).excludedFromDropIns, false)
    assert.equal(admin.data.sessions.find(row => row.classId === classId && row.date === dates.blocked).excludedFromDropIns, true)

    const guest = { firstName: 'Reader', lastName: 'Test', email: `drop-in-scope-${facilityId}@example.test`, slotGroupId: groupId, useFreeTrial: true }
    const denied = await request('post', '/api/public/drop-ins/register', { ...guest, classDate: dates.blocked })
    assert.equal(denied.status, 400, denied.message)
    assert.match(denied.message, /not an active occurrence/)
    assert.equal(Number((await one('SELECT count(*) FROM drop_in_registration WHERE slot_group_id=$1', [groupId])).count), 0)
    const accepted = await request('post', '/api/public/drop-ins/register', { ...guest, classDate: dates.allowed })
    assert.equal(accepted.status, 201, accepted.message)
    assert.equal(accepted.data.status, 'account_required')

    const memberId = Number((await one(`INSERT INTO member(facility_id,first_name,last_name,date_of_birth,is_active)
      VALUES($1,'Trial','Scope',($2::date - INTERVAL '10 years')::date,TRUE) RETURNING id`, [facilityId, dates.blocked])).id)
    await assert.rejects(bookMemberFreeTrial(db, { program: 'fit-flip', slotGroupId: groupId, classDate: dates.blocked }, {
      memberId, facilityId, contactEmail: guest.email,
    }), /no longer available/)
    assert.equal(Number((await one('SELECT count(*) FROM drop_in_registration WHERE member_id=$1', [memberId])).count), 0)

    // Group/date reservations cannot distinguish two times on the same day.
    // An excluded sibling must not disappear before eligibility is evaluated.
    const mixedSlot = await addSlot(dates.allowed, true)
    await db.query("UPDATE scheduling_time_slot SET start_time='14:00',end_time='15:00' WHERE id=$1", [mixedSlot])
    assert.equal((await catalog()).sessions.some(row => row.slotGroupId === groupId && row.date === dates.allowed), false)
    const registrationsBefore = (await db.query('SELECT * FROM drop_in_registration WHERE slot_group_id=$1 ORDER BY id', [groupId])).rows
    const mixedDenied = await request('post', '/api/public/drop-ins/register', { ...guest, email: `mixed-${facilityId}@example.test`, classDate: dates.allowed })
    assert.equal(mixedDenied.status, 400, mixedDenied.message)
    await assert.rejects(bookMemberFreeTrial(db, { program: 'fit-flip', slotGroupId: groupId, classDate: dates.allowed }, {
      memberId, facilityId, contactEmail: guest.email,
    }), /no longer available/)
    assert.deepEqual((await db.query('SELECT * FROM drop_in_registration WHERE slot_group_id=$1 ORDER BY id', [groupId])).rows, registrationsBefore)
    await db.query('DELETE FROM scheduling_time_slot WHERE id=$1', [mixedSlot])

    // A class override can allow inherited slots under an excluded program.
    await db.query('UPDATE program SET exclude_from_drop_ins=FALSE WHERE id=$1', [classId])
    assert.deepEqual((await catalog()).sessions.filter(row => row.classId === classId).map(row => row.date), [dates.blocked, dates.allowed])
    // An individual exclusion always wins over an allowed class.
    await db.query('UPDATE scheduling_time_slot SET exclude_from_drop_ins=TRUE WHERE id=$1', [blockedSlot])
    assert.deepEqual((await catalog()).sessions.filter(row => row.classId === classId).map(row => row.date), [dates.allowed])
    await db.query('UPDATE scheduling_time_slot SET exclude_from_drop_ins=TRUE WHERE id=$1', [allowedSlot])
    assert.equal((await catalog()).classes.some(row => row.classId === classId), false)
    assert.equal((await advertisedClass()).excludeFromDropIns, true)

    // An excluded or inactive A/B sibling remains part of rotation context.
    const rotationDates = await one(`SELECT ($1::date + ((8-EXTRACT(DOW FROM $1::date)::int)%7))::text AS a,
      ($1::date + ((8-EXTRACT(DOW FROM $1::date)::int)%7) + 7)::text AS b`, [dates.blocked])
    const rotatingGroup = Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,max_participants,active_start,inherits_offering_dates,dates_tbd,is_active)
      VALUES($1,'day',8,$2,FALSE,FALSE,TRUE) RETURNING id`, [formId, rotationDates.a])).id)
    const addRotatingSlot = async (letter, excluded) => Number((await one(`INSERT INTO scheduling_time_slot
      (form_id,slot_group_id,schedule_mode,day_of_week,week_letter,start_time,end_time,max_participants,dates_tbd,is_active,exclude_from_drop_ins)
      VALUES($1,$2,'day',1,$3,'12:00','13:00',8,FALSE,TRUE,$4) RETURNING id`, [formId, rotatingGroup, letter, excluded])).id)
    const aSlot = await addRotatingSlot('A', false), bSlot = await addRotatingSlot('B', true)
    const rotatingSessions = (await catalog()).sessions.filter(row => row.slotGroupId === rotatingGroup)
    assert.ok(rotatingSessions.some(row => row.date === rotationDates.a))
    assert.equal(rotatingSessions.some(row => row.date === rotationDates.b), false)
    const rotationDenied = await request('post', '/api/public/drop-ins/register', { ...guest, slotGroupId: rotatingGroup, classDate: rotationDates.b })
    assert.equal(rotationDenied.status, 400, rotationDenied.message)
    await assert.rejects(bookMemberFreeTrial(db, { program: 'fit-flip', slotGroupId: rotatingGroup, classDate: rotationDates.b }, {
      memberId, facilityId, contactEmail: guest.email,
    }), /no longer available/)
    assert.equal(Number((await one('SELECT count(*) FROM drop_in_registration WHERE slot_group_id=$1', [rotatingGroup])).count), 0)
    const rotationAccepted = await request('post', '/api/public/drop-ins/register', { ...guest, email: `rotation-${facilityId}@example.test`, slotGroupId: rotatingGroup, classDate: rotationDates.a })
    assert.equal(rotationAccepted.status, 201, rotationAccepted.message)

    await db.query('UPDATE scheduling_time_slot SET is_active=FALSE WHERE id=$1', [aSlot])
    await db.query('UPDATE scheduling_time_slot SET exclude_from_drop_ins=FALSE WHERE id=$1', [bSlot])
    const inactiveSiblingSessions = (await catalog()).sessions.filter(row => row.slotGroupId === rotatingGroup)
    assert.equal(inactiveSiblingSessions.some(row => row.date === rotationDates.a), false)
    assert.ok(inactiveSiblingSessions.some(row => row.date === rotationDates.b))
    const inactiveDenied = await request('post', '/api/public/drop-ins/register', { ...guest, slotGroupId: rotatingGroup, classDate: rotationDates.a })
    assert.equal(inactiveDenied.status, 400, inactiveDenied.message)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})

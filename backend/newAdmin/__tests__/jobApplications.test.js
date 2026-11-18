import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import express from 'express'
import pg from 'pg'
import { jobApplicationInput, registerPublicJobApplicationRoutes } from '../jobApplications.js'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { registerNewAdminRoutes } from '../registerRoutes.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

const sharedRatings = {
  plyometrics: 1, strengthTraining: 2, speedAgility: 2, hiit: 1, tumbling: 5, trampoline: 4, acro: 1, dance: 1,
}

const legacyRatings = { ...sharedRatings, womensArtisticGymnastics: 3, mensArtisticGymnastics: 2 }
const currentRatings = {
  ...sharedRatings, beam: 4, bar: 3, parallelBars: 2, unevenBars: 4, vault: 4,
  rings: 2, pommelHorse: 1, floor: 5, parkour: 3, ninja: 2,
}

function application(ratings = currentRatings) {
  return {
    requestId: randomUUID(), firstName: 'Taylor', lastName: 'Morgan', email: 'taylor@example.com',
    phone: '+1 (202) 555-0101', role: 'both', availability: 'Saturday mornings', coachedChildren: true,
    ageGroups: ['8_11', '5_7'], youthCoachingDetails: 'Taught beginner tumbling and youth strength classes.',
    ratings,
    certificationKeys: ['first_aid', 'cpr_aed'], certifications: 'Local coaching course',
    employmentType: 'part_time', earliestStartDate: '2030-08-15', resumeUrl: 'https://example.com/resume',
  }
}

test('job application validation requires the youth coaching details that apply and integer ratings for every discipline', () => {
  const body = application()
  const input = jobApplicationInput(body)
  assert.equal(input.phone, '202-555-0101')
  assert.deepEqual(input.ageGroups, ['5_7', '8_11'])
  assert.deepEqual(input.certificationKeys, ['cpr_aed', 'first_aid'])

  for (const invalid of [
    { ageGroups: [] },
    { youthCoachingDetails: '  ' },
    { coachedChildren: 'true' },
    { ratings: { ...body.ratings, acro: undefined } },
    { ratings: { ...body.ratings, acro: 6 } },
    { ratings: { ...body.ratings, acro: '3' } },
    { certificationKeys: ['unknown'] },
    { earliestStartDate: '2030-02-30' },
    { resumeUrl: 'https://user:password@example.com/resume' },
    { availability: 'a'.repeat(1001) },
    { facilityId: 2 },
  ]) assert.throws(() => jobApplicationInput({ ...body, ...invalid }), { statusCode: 400 })

  const newCoach = jobApplicationInput({ ...body, coachedChildren: false, ageGroups: undefined,
    youthCoachingDetails: undefined, certificationKeys: undefined, certifications: undefined })
  assert.deepEqual(newCoach.ageGroups, [])
  assert.equal(newCoach.youthCoachingDetails, null)
  assert.deepEqual(newCoach.certificationKeys, [])
})

test('job applications require a complete current or previous ratings catalog', () => {
  assert.deepEqual(jobApplicationInput(application(currentRatings)).ratings, currentRatings)
  assert.deepEqual(jobApplicationInput(application(legacyRatings)).ratings, legacyRatings)

  for (const ratings of [
    sharedRatings,
    { ...currentRatings, unevenBars: undefined },
    { ...currentRatings, ninja: 2.5 },
    { ...currentRatings, rings: 0 },
    { ...currentRatings, womensArtisticGymnastics: 3 },
    { ...legacyRatings, mensArtisticGymnastics: undefined },
    { ...legacyRatings, mensArtisticGymnastics: '2' },
    { ...legacyRatings, parkour: 3 },
  ]) assert.throws(() => jobApplicationInput(application(ratings)), { statusCode: 400 })
})

test('job applications are replay-safe and staff can read/update only their own facility', { skip: !connectionString }, async (t) => {
  const schema = `job_applications_${randomBytes(6).toString('hex')}`
  const adminDb = new pg.Client({ connectionString })
  await adminDb.connect()
  t.after(async () => {
    await adminDb.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await adminDb.end()
  })
  await adminDb.query(`CREATE SCHEMA ${schema}`)
  const db = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  t.after(() => db.end())
  await db.query(`
    CREATE TABLE facility (id BIGINT PRIMARY KEY);
    INSERT INTO facility VALUES (1), (2);
    CREATE TABLE new_admin_public_lead_facility (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
      facility_id BIGINT NOT NULL REFERENCES facility(id)
    );
  `)
  await db.query(await readFile(new URL('../../migrations/876_job_applications.sql', import.meta.url), 'utf8'))

  const app = express()
  registerPublicJobApplicationRoutes(app, db)
  app.use(express.json())
  // Provide canonical identities at the authorization boundary, as server.js does after sign-in.
  app.use('/api/admin/new-admin', (req, _res, next) => {
    req.canonicalAccess = { facilityId: req.get('x-test-facility') === '2' ? 2 : 1, portalAccess: { admin: true } }
    req.newAdminPermissions = new Map([['admin_access.manage', req.get('x-test-role') === 'manager']])
    next()
  })
  registerNewAdminRoutes(app, db, { jwtSecret: 'job-application-test-secret' })
  const server = await new Promise((resolve, reject) => {
    const handle = app.listen(0, '127.0.0.1', () => resolve(handle))
    handle.on('error', reject)
  })
  t.after(() => new Promise(resolve => server.close(resolve)))

  const origin = `http://127.0.0.1:${server.address().port}`
  const headers = { 'Content-Type': 'application/json' }
  const submit = body => fetch(`${origin}/api/public/job-applications`, { method: 'POST', headers, body: JSON.stringify(body) })
  const staff = (path, options = {}) => fetch(`${origin}/api/admin/new-admin/job-applications${path}`, {
    ...options,
    headers: { ...headers, 'x-test-role': 'manager', ...options.headers },
  })

  const body = application()
  assert.equal((await submit(body)).status, 503)
  await db.query('INSERT INTO new_admin_public_lead_facility(facility_id) VALUES(1)')
  assert.equal((await submit({ ...body, availability: 'a'.repeat(70_000) })).status, 413)
  const responses = await Promise.all([submit(body), submit(body)])
  assert.deepEqual(responses.map(response => response.status), [200, 200])
  const receipts = await Promise.all(responses.map(response => response.json()))
  const { id } = receipts[0].data
  assert.deepEqual(receipts, [{ success: true, data: { id } }, { success: true, data: { id } }])
  assert.equal((await submit({ ...body, availability: 'Sunday' })).status, 409)

  const olderFormResponse = await submit(application(legacyRatings))
  assert.equal(olderFormResponse.status, 200)
  const { data: { id: olderFormId } } = await olderFormResponse.json()
  assert.deepEqual((await (await staff(`/${olderFormId}`)).json()).data.ratings, legacyRatings)

  assert.equal((await staff('', { headers: { 'x-test-role': 'viewer' } })).status, 403)
  const list = await staff('?pageSize=1')
  assert.equal(list.headers.get('Cache-Control'), 'private, no-store')
  const { data: page } = await list.json()
  assert.equal(page.total, 2)
  assert.equal(page.rows[0].status, 'new')
  assert.equal(Object.hasOwn(page.rows[0], 'ratings'), false)
  assert.equal((await staff(`/${id}`, { headers: { 'x-test-facility': '2' } })).status, 404)
  assert.deepEqual((await (await staff('', { headers: { 'x-test-facility': '2' } })).json()).data.rows, [])

  const edit = { method: 'PATCH', body: JSON.stringify({ status: 'interview' }) }
  assert.equal((await staff(`/${id}`, { ...edit, headers: { 'x-test-facility': '2' } })).status, 404)
  assert.equal((await staff(`/${id}`, { ...edit, headers: { 'x-test-role': 'viewer' } })).status, 403)
  const updated = await staff(`/${id}`, edit)
  assert.equal(updated.headers.get('Cache-Control'), 'private, no-store')
  const { data: detail } = await updated.json()
  assert.equal(detail.status, 'interview')
  assert.deepEqual(detail.ratings, body.ratings)
  assert.deepEqual(detail.certificationKeys, ['cpr_aed', 'first_aid'])
  assert.equal(detail.certifications, body.certifications)
  assert.equal(Object.hasOwn(detail, 'requestId'), false)
  assert.equal((await (await staff(`/${id}`)).json()).data.status, 'interview')
})

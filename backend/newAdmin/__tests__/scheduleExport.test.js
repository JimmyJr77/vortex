import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import { PDFDocument } from 'pdf-lib'
import { registerAdminAccountReadRoutes } from '../../accounts/adminAccountReadRoutes.js'
import { scheduleExportPdf, scheduleExportSections } from '../scheduleExport.js'
import { registerNewAdminRoutes } from '../registerRoutes.js'

export const scheduleFixture = {
  facilityName: 'Vortex Athletics', timezone: 'America/New_York', asOf: '2026-11-16',
  rows: Array.from({ length: 36 }, (_, i) => ({ classId: i % 6 + 1, className: ['Foundations', 'Advanced Tumbling', 'Strength & Explosiveness', 'Trampoline', 'Youth Athleticism', 'Gymnastics - Intermediate'][i % 6],
    programName: i % 2 ? 'Athletic Training' : 'Gymnastics', groupId: i + 1, slotId: i + 1, dayOfWeek: i % 7,
    startTime: i % 2 ? '16:30:00' : '09:00:00', endTime: i % 2 ? '17:30:00' : '10:00:00',
    specificDate: i === 0 ? '2026-11-22' : null, weekLetter: i === 3 ? 'A' : null,
    activeStart: '2026-11-01', activeEnd: i % 4 ? null : '2027-03-31',
    capacity: 12, enrolled: i % 3 ? 5 : 10, reserved: 2, available: i % 3 ? 5 : 0,
  })),
}

test('day and class views use the same slots, ordered Monday-Sunday and by time', () => {
  const sections = scheduleExportSections(scheduleFixture.rows)
  assert.deepEqual(sections.byDay.map(group => group.name), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  const ids = groups => groups.flatMap(group => group.rows.map(row => row.slotId)).sort((a,b) => a-b)
  assert.deepEqual(ids(sections.byDay), ids(sections.byClass))
  assert.equal(ids(sections.byDay).length, 36)
  for (const day of sections.byDay) assert.deepEqual(day.rows.map(row => row.startTime), day.rows.map(row => row.startTime).sort())
  assert.equal(sections.byClass[0].name, 'Advanced Tumbling')
})

test('PDF export creates paginated day and class sections, including an empty schedule', async () => {
  const bytes = await scheduleExportPdf(scheduleFixture)
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() >= 4)
  assert.equal(pdf.getTitle(), 'Vortex Athletics - Class schedule')
  const empty = await PDFDocument.load(await scheduleExportPdf({ ...scheduleFixture, rows: [] }))
  assert.equal(empty.getPageCount(), 3)
})

test('schedule download is protected by class viewing permission and responds as a PDF', async () => {
  let route
  const app = { use() {}, post() {}, put() {}, patch() {}, delete() {}, get(path, ...chain) { if (path.endsWith('/classes/schedule.pdf')) route = chain } }
  const db = { query: async (sql, params) => {
    assert.equal(params[0], 7)
    return { rows: sql.includes('FROM facility WHERE') ? [{ name: 'Test facility', timezone: 'America/New_York', today: '2026-11-16' }] : [] }
  } }
  registerNewAdminRoutes(app, db, { jwtSecret: 'test-only' })
  const req = { canonicalAccess: { portalAccess: { admin: true }, facilityId: 7 }, newAdminPermissions: new Map([['classes.view', Promise.resolve(false)]]) }
  const res = { headersSent: false, status(code) { this.statusCode = code; return this }, json(body) { this.body = body }, set(headers) { this.headers = headers; return this }, send(bytes) { this.bytes = bytes; this.headersSent = true } }
  await route[0](req, res, () => assert.fail('Denied users cannot download'))
  assert.equal(res.statusCode, 403)
  req.newAdminPermissions.set('classes.view', Promise.resolve(true))
  await route[0](req, res, () => { res.statusCode = 200 })
  await route[1](req, res)
  assert.equal(res.headers['Content-Type'], 'application/pdf')
  assert.match(res.headers['Content-Disposition'], /attachment; filename="vortex-class-schedule-2026-11-16.pdf"/)
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.equal(res.bytes.subarray(0, 4).toString(), '%PDF')
})

test('schedule download reaches the PDF route with account reads registered first', async t => {
  const secret = 'schedule-routing-test-only'
  const permissions = new Set(['classes.view', 'members.view'])
  const db = { query: async (sql, params) => {
    if (sql.includes('FROM v_app_user_access_context')) return { rows: [{
      user_id: 1, facility_id: 7, storage_roles: ['ADMIN'], is_active: true,
      is_owner: false, can_access_admin_portal: true,
    }] }
    if (sql.includes('WITH base_permissions')) return { rows: [{ base_allowed: permissions.has(params[2]) }] }
    if (sql.includes('FROM facility WHERE')) {
      assert.equal(params[0], 7)
      return { rows: [{ name: 'Test facility', timezone: 'America/New_York', today: '2026-11-16' }] }
    }
    if (sql.includes('WHERE p.id=$1 AND p.facility_id=$2')) {
      assert.deepEqual(params, [42, 7])
      return { rows: [] }
    }
    assert.ok(sql.includes('FROM program p JOIN facility loc'))
    assert.deepEqual(params, [7])
    return { rows: [] }
  } }
  const app = express()
  // Match server.js registration order so earlier dynamic routes cannot hide the export.
  registerAdminAccountReadRoutes(app, db, { jwtSecret: secret })
  registerNewAdminRoutes(app, db, { jwtSecret: secret })
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => error ? reject(error) : resolve())
  }))
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api/admin/new-admin/classes`
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, secret, { expiresIn: '5m' })}` }

  for (const membersAllowed of [true, false]) {
    await t.test(`exports a PDF with members.view ${membersAllowed ? 'granted' : 'denied'}`, async () => {
      if (!membersAllowed) permissions.delete('members.view')
      const response = await fetch(`${base}/schedule.pdf`, { headers })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /^application\/pdf/)
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="vortex-class-schedule-2026-11-16.pdf"')
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const bytes = Buffer.from(await response.arrayBuffer())
      assert.equal(bytes.subarray(0, 4).toString(), '%PDF')
      assert.equal((await PDFDocument.load(bytes)).getTitle(), 'Vortex Athletics - Class schedule')
    })
  }

  await t.test('numeric class details still require member viewing and facility scoping', async () => {
    const denied = await fetch(`${base}/42`, { headers })
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).message, 'Missing permission: members.view')
    permissions.add('members.view')
    const missing = await fetch(`${base}/42`, { headers })
    assert.equal(missing.status, 404)
    assert.equal((await missing.json()).message, 'Class not found.')
  })

  await t.test('export still requires authentication and class viewing', async () => {
    const anonymous = await fetch(`${base}/schedule.pdf`)
    assert.equal(anonymous.status, 401)
    await anonymous.json()
    permissions.delete('classes.view')
    const denied = await fetch(`${base}/schedule.pdf`, { headers })
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).message, 'Missing permission: classes.view')
  })
})

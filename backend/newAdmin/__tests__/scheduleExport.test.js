import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
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

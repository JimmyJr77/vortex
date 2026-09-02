import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import {
  calendarDateInTimeZone,
  calendarDateParts,
  isAdultInTimeZone,
  isAdultOnDate,
  isValidCalendarDate,
} from '../dateOnlyAge.js'

test('adult status compares calendar dates without parsing a birthday as an instant', () => {
  assert.equal(isAdultOnDate('2008-09-02', '2026-09-01'), false)
  assert.equal(isAdultOnDate('2008-09-01', '2026-09-01'), true)
  assert.equal(isAdultOnDate('2008-08-31', '2026-09-01'), true)
  assert.equal(isAdultOnDate('2009-01-01', '2026-09-01'), false)
})

test('calendar-date parsing validates real dates and preserves their written day', () => {
  assert.deepEqual(calendarDateParts('2008-09-02'), { year: 2008, month: 9, day: 2 })
  assert.deepEqual(calendarDateParts('2008-09-02T00:00:00.000Z'), { year: 2008, month: 9, day: 2 })
  assert.equal(isValidCalendarDate('2008-02-29'), true)
  assert.equal(isValidCalendarDate('2007-02-29'), false)
  assert.equal(isValidCalendarDate('2008-09-31'), false)
  assert.equal(isValidCalendarDate('not-a-date'), false)
})

test('facility timezone supplies the current calendar date near a UTC boundary', () => {
  const instant = 1_788_314_400_000 // 2026-09-02T02:00:00.000Z
  assert.equal(calendarDateInTimeZone('America/New_York', instant), '2026-09-01')
  assert.equal(calendarDateInTimeZone('UTC', instant), '2026-09-02')
  assert.equal(isAdultInTimeZone('2008-09-02', 'America/New_York', instant), false)
  assert.equal(isAdultInTimeZone('2008-09-02', 'UTC', instant), true)
})

test('household add uses facility-scoped date-only adulthood calculation', async () => {
  const source = await fs.readFile(new URL('../../server.js', import.meta.url), 'utf8')
  const helperStart = source.indexOf('// Helper function to check if member is adult')
  const helperEnd = source.indexOf('// Helper function to generate unique family username', helperStart)
  const helper = source.slice(helperStart, helperEnd)
  const routeStart = source.indexOf("app.post('/api/members/family'")
  const routeEnd = source.indexOf('// Update family member', routeStart)
  const route = source.slice(routeStart, routeEnd)
  const familyContextStart = source.indexOf('const getUserFamilyContext')
  const familyContextEnd = source.indexOf('const getHouseholdAccessForUser', familyContextStart)
  const familyContext = source.slice(familyContextStart, familyContextEnd)

  assert.match(helper, /isAdultInTimeZone\(dateOfBirth, timeZone\)/)
  assert.doesNotMatch(helper, /new Date/)
  assert.match(route, /isValidCalendarDate\(dateOfBirth\)/)
  assert.match(route, /isAdultInTimeZone\(dateOfBirth, familyContext\.facility_timezone\)/)
  assert.doesNotMatch(route, /new Date\(dateOfBirth\)/)
  assert.match(familyContext, /facility_row\.timezone AS facility_timezone/)
})

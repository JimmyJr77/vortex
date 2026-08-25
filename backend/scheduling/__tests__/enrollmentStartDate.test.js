import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEnrollmentStartDate,
  requireEnrollmentStartDate,
} from '../enrollmentStartDate.js'

test('normalizeEnrollmentStartDate accepts real date-only values', () => {
  assert.equal(normalizeEnrollmentStartDate('2026-09-14'), '2026-09-14')
  assert.equal(normalizeEnrollmentStartDate(' 2028-02-29 '), '2028-02-29')
})

test('normalizeEnrollmentStartDate rejects missing, malformed, and impossible dates', () => {
  assert.equal(normalizeEnrollmentStartDate(''), null)
  assert.equal(normalizeEnrollmentStartDate('09/14/2026'), null)
  assert.equal(normalizeEnrollmentStartDate('2026-02-29'), null)
  assert.equal(normalizeEnrollmentStartDate('2026-13-01'), null)
})

test('requireEnrollmentStartDate returns a normalized date or a user-facing error', () => {
  assert.equal(requireEnrollmentStartDate('2026-09-14'), '2026-09-14')
  assert.throws(
    () => requireEnrollmentStartDate(null),
    (error) => {
      assert.equal(error.code, 'ENROLLMENT_START_DATE_REQUIRED')
      assert.equal(error.message, 'Enrollment start date is required.')
      return true
    },
  )
})

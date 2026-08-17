import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../scripts/check-canonical-release-readiness.mjs', import.meta.url))

test('release readiness script emits a machine-readable blocked result when database configuration is missing', () => {
  const result = spawnSync(process.execPath, [script, '--facility=9', '--require-coach-opt-in'], {
    env: { PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.equal(result.stderr, '')
  const output = JSON.parse(result.stdout)
  assert.equal(output.report, null)
  assert.equal(output.readiness.status, 'blocked')
  assert.deepEqual(output.readiness.failures[0], {
    code: 'RELEASE_READINESS_DATABASE_URL_MISSING',
    message: 'Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL before checking release readiness.',
    evidence: { requireCoachOptIn: true },
    humanGate: false,
  })
})

test('release readiness script rejects malformed facility input before opening a database connection', () => {
  const result = spawnSync(process.execPath, [script, '--facility=not-a-number'], {
    env: { PATH: process.env.PATH ?? '', DATABASE_URL: 'postgresql://unused.invalid/vortex' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  const output = JSON.parse(result.stdout)
  assert.equal(output.readiness.failures[0].code, 'RELEASE_READINESS_FACILITY_INVALID')
  assert.equal(output.readiness.failures[0].evidence.facilityId, null)
})

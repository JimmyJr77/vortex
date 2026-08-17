import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../scripts/report-canonical-structured-profile-queue.mjs', import.meta.url))

test('structured-profile queue script fails before database access when configuration is missing', () => {
  const result = spawnSync(process.execPath, [script, '--facility=9'], {
    env: { PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL/)
  assert.equal(result.stdout, '')
})

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../../migrations/802_retire_legacy_member_status_derivation.sql',
  import.meta.url,
)

test('legacy member status derivation is retired without deleting member data', async () => {
  const sql = await fs.readFile(migrationUrl, 'utf8')

  assert.match(sql, /DROP TRIGGER IF EXISTS trigger_update_athlete_status ON member/)
  assert.match(sql, /DROP TRIGGER IF EXISTS trigger_update_status_on_enrollment ON member_program/)
  assert.match(sql, /DROP FUNCTION IF EXISTS update_member_athlete_status/)
  assert.match(sql, /DROP FUNCTION IF EXISTS update_athlete_status_on_enrollment/)
  assert.match(sql, /information_schema\.columns/)
  assert.match(sql, /column_name = 'has_completed_waivers'/)
  assert.match(sql, /participation is derived from enrollment records/)
  assert.match(sql, /member_waiver_acceptance/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN status DROP DEFAULT/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN status DROP NOT NULL/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN parent_guardian_ids DROP DEFAULT/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN parent_guardian_ids DROP NOT NULL/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN has_completed_waivers DROP DEFAULT/)
  assert.match(sql, /ALTER TABLE member ALTER COLUMN has_completed_waivers DROP NOT NULL/)
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+member\b/i)
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|COLUMN)\b/i)
})
